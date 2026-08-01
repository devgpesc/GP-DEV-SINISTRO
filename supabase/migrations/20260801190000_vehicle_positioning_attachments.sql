BEGIN;

-- Completa posicionamentos antigos com os vinculos ja presentes no sinistro.
UPDATE public.vehicle_positionings vp
   SET vehicle_id = coalesce(vp.vehicle_id, e."vehicleId"),
       insured_name = coalesce(nullif(btrim(vp.insured_name), ''), a.name),
       client_name = coalesce(nullif(btrim(vp.client_name), ''), nullif(btrim(vp.insured_name), ''), a.name)
  FROM public.events e
  LEFT JOIN public.associates a ON a.id = e."associateId"
 WHERE e.id = vp.event_id;

CREATE OR REPLACE FUNCTION public.hydrate_vehicle_positioning_from_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_vehicle_id uuid;
  event_associate_name text;
BEGIN
  SELECT e."vehicleId", a.name
    INTO event_vehicle_id, event_associate_name
    FROM public.events e
    LEFT JOIN public.associates a ON a.id = e."associateId"
   WHERE e.id = NEW.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sinistro nao encontrado para o posicionamento.';
  END IF;

  NEW.vehicle_id := coalesce(NEW.vehicle_id, event_vehicle_id);
  NEW.insured_name := coalesce(nullif(btrim(NEW.insured_name), ''), event_associate_name);
  NEW.client_name := coalesce(nullif(btrim(NEW.client_name), ''), NEW.insured_name, event_associate_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hydrate_vehicle_positioning ON public.vehicle_positionings;
CREATE TRIGGER trg_hydrate_vehicle_positioning
BEFORE INSERT OR UPDATE OF event_id ON public.vehicle_positionings
FOR EACH ROW EXECUTE FUNCTION public.hydrate_vehicle_positioning_from_event();

CREATE TABLE IF NOT EXISTS public.vehicle_positioning_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  positioning_id uuid NOT NULL REFERENCES public.vehicle_positionings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positioning_attachments_positioning
  ON public.vehicle_positioning_attachments(positioning_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_positioning_attachments_tenant
  ON public.vehicle_positioning_attachments(tenant_id);

CREATE OR REPLACE FUNCTION public.guard_vehicle_positioning_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  positioning_record record;
  attachment_count integer;
  expected_prefix text;
BEGIN
  SELECT event_id, tenant_id
    INTO positioning_record
    FROM public.vehicle_positionings
   WHERE id = NEW.positioning_id;

  IF positioning_record.event_id IS NULL THEN
    RAISE EXCEPTION 'Posicionamento invalido para o anexo.';
  END IF;

  NEW.event_id := positioning_record.event_id;
  NEW.tenant_id := positioning_record.tenant_id;
  expected_prefix := NEW.event_id::text || '/positioning/' || NEW.positioning_id::text || '/';

  IF NEW.file_path IS NULL OR left(NEW.file_path, length(expected_prefix)) <> expected_prefix THEN
    RAISE EXCEPTION 'Caminho do anexo invalido para o posicionamento.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO attachment_count
      FROM public.vehicle_positioning_attachments
     WHERE positioning_id = NEW.positioning_id;
    IF attachment_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 anexos por posicionamento atingido.';
    END IF;
  END IF;

  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  ELSIF auth.uid() IS NOT NULL AND NEW.uploaded_by <> auth.uid() THEN
    RAISE EXCEPTION 'Autor do anexo invalido.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vehicle_positioning_attachment ON public.vehicle_positioning_attachments;
CREATE TRIGGER trg_guard_vehicle_positioning_attachment
BEFORE INSERT OR UPDATE ON public.vehicle_positioning_attachments
FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_positioning_attachment();

ALTER TABLE public.vehicle_positioning_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select positioning attachments" ON public.vehicle_positioning_attachments;
DROP POLICY IF EXISTS "Tenant insert positioning attachments" ON public.vehicle_positioning_attachments;
DROP POLICY IF EXISTS "Tenant update positioning attachments" ON public.vehicle_positioning_attachments;
DROP POLICY IF EXISTS "Tenant delete positioning attachments" ON public.vehicle_positioning_attachments;

CREATE POLICY "Tenant select positioning attachments"
ON public.vehicle_positioning_attachments FOR SELECT TO authenticated
USING (public.can_access_event_attachment(event_id));

CREATE POLICY "Tenant insert positioning attachments"
ON public.vehicle_positioning_attachments FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_event_attachment(event_id)
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);

CREATE POLICY "Tenant update positioning attachments"
ON public.vehicle_positioning_attachments FOR UPDATE TO authenticated
USING (public.can_access_event_attachment(event_id))
WITH CHECK (
  public.can_access_event_attachment(event_id)
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);

CREATE POLICY "Tenant delete positioning attachments"
ON public.vehicle_positioning_attachments FOR DELETE TO authenticated
USING (public.can_access_event_attachment(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_positioning_attachments TO authenticated;

CREATE OR REPLACE FUNCTION public.record_positioning_attachment_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vehicle_positioning_timeline (
    tenant_id, positioning_id, event_type, title, description, actor_id
  ) VALUES (
    NEW.tenant_id,
    NEW.positioning_id,
    'anexo',
    'Anexo adicionado',
    NEW.file_name,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_positioning_attachment_timeline ON public.vehicle_positioning_attachments;
CREATE TRIGGER trg_positioning_attachment_timeline
AFTER INSERT ON public.vehicle_positioning_attachments
FOR EACH ROW EXECUTE FUNCTION public.record_positioning_attachment_timeline();

NOTIFY pgrst, 'reload schema';

COMMIT;
