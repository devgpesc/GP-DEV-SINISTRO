-- Garante schema completo de event_attachments (coluna name ausente em alguns ambientes)

CREATE TABLE IF NOT EXISTS public.event_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  url text NOT NULL,
  name text,
  type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_attachments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Compatibilidade com schemas legados (ex.: filename / file_name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'filename'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.event_attachments RENAME COLUMN filename TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'file_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.event_attachments RENAME COLUMN file_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'mime_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_attachments' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.event_attachments RENAME COLUMN mime_type TO type;
  END IF;
END $$;

UPDATE public.event_attachments
   SET name = COALESCE(name, split_part(url, '/', array_length(string_to_array(url, '/'), 1)))
 WHERE name IS NULL AND url IS NOT NULL;

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total logado" ON public.event_attachments;
DROP POLICY IF EXISTS "Tenant scoped event attachments" ON public.event_attachments;

CREATE POLICY "Tenant scoped event attachments"
ON public.event_attachments
FOR ALL TO authenticated
USING (
  public.is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
     WHERE e.id = event_attachments.event_id
       AND e.tenant_id IN (SELECT public.get_my_tenant_ids())
  )
)
WITH CHECK (
  public.is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
     WHERE e.id = event_attachments.event_id
       AND e.tenant_id IN (SELECT public.get_my_tenant_ids())
  )
);

NOTIFY pgrst, 'reload config';
