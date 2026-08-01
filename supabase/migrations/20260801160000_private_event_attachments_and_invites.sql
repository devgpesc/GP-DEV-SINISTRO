BEGIN;

-- Anexos de sinistro podem conter documentos pessoais e nunca devem ser publicos.
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp',
         'application/pdf',
         'video/mp4',
         'video/quicktime',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]::text[]
 WHERE id = 'event-attachments';

CREATE OR REPLACE FUNCTION public.can_access_event_attachment(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.events e
        WHERE e.id = p_event_id
          AND (
            public.is_platform_super_admin(auth.uid())
            OR e.tenant_id IN (SELECT public.get_my_tenant_ids())
          )
     );
$$;

CREATE OR REPLACE FUNCTION public.can_access_event_attachment_path(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_segment text := split_part(coalesce(p_object_name, ''), '/', 1);
BEGIN
  IF event_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  RETURN public.can_access_event_attachment(event_segment::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_event_attachment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_event_attachment_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_event_attachment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_event_attachment_path(text) TO authenticated;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND (
         coalesce(qual, '') ILIKE '%event-attachments%'
         OR coalesce(with_check, '') ILIKE '%event-attachments%'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
  END LOOP;
END $$;

CREATE POLICY "Tenant read event attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-attachments'
  AND public.can_access_event_attachment_path(name)
);

CREATE POLICY "Tenant upload event attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-attachments'
  AND public.can_access_event_attachment_path(name)
);

CREATE POLICY "Tenant update event attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-attachments'
  AND public.can_access_event_attachment_path(name)
)
WITH CHECK (
  bucket_id = 'event-attachments'
  AND public.can_access_event_attachment_path(name)
);

CREATE POLICY "Tenant delete event attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-attachments'
  AND public.can_access_event_attachment_path(name)
);

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attachments ALTER COLUMN event_id SET NOT NULL;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'event_attachments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_attachments', policy_record.policyname);
  END LOOP;
END $$;

CREATE POLICY "Tenant select event attachments"
ON public.event_attachments FOR SELECT TO authenticated
USING (public.can_access_event_attachment(event_id));

CREATE POLICY "Tenant insert event attachments"
ON public.event_attachments FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_event_attachment(event_id)
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);

CREATE POLICY "Tenant update event attachments"
ON public.event_attachments FOR UPDATE TO authenticated
USING (public.can_access_event_attachment(event_id))
WITH CHECK (
  public.can_access_event_attachment(event_id)
  AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
);

CREATE POLICY "Tenant delete event attachments"
ON public.event_attachments FOR DELETE TO authenticated
USING (public.can_access_event_attachment(event_id));

CREATE OR REPLACE FUNCTION public.guard_event_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attachment_count integer;
BEGIN
  IF NEW.event_id IS NULL OR split_part(NEW.file_path, '/', 1) <> NEW.event_id::text THEN
    RAISE EXCEPTION 'Caminho do anexo invalido para o sinistro.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO attachment_count
      FROM public.event_attachments ea
     WHERE ea.event_id = NEW.event_id;

    IF attachment_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 anexos por sinistro atingido.';
    END IF;
  END IF;

  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  ELSIF auth.uid() IS NOT NULL AND NEW.uploaded_by <> auth.uid() THEN
    RAISE EXCEPTION 'Autor do anexo invalido.';
  END IF;

  -- URLs assinadas expiram e nunca devem ser persistidas.
  NEW.url := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_event_attachment ON public.event_attachments;
CREATE TRIGGER trg_guard_event_attachment
BEFORE INSERT OR UPDATE ON public.event_attachments
FOR EACH ROW EXECUTE FUNCTION public.guard_event_attachment();

UPDATE public.event_attachments SET url = NULL WHERE url IS NOT NULL;

-- Convites passam a ser de uso unico, vinculados ao usuario e e-mail da sessao.
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record public.invitations%ROWTYPE;
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF current_user_id IS NULL OR current_email = '' THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
  END IF;

  IF length(btrim(coalesce(invite_token, ''))) < 20 THEN
    RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
  END IF;

  SELECT * INTO invite_record
    FROM public.invitations
   WHERE token = btrim(invite_token)
     AND status = 'pending'
   LIMIT 1
   FOR UPDATE;

  IF invite_record.id IS NULL OR invite_record.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
  END IF;

  IF lower(coalesce(invite_record.email, '')) <> current_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
  END IF;

  INSERT INTO public.organization_members (tenant_id, user_id, role)
  VALUES (invite_record.tenant_id, current_user_id, coalesce(invite_record.role, 'member'))
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  IF invite_record.role = 'owner' THEN
    UPDATE public.saas_tenants
       SET owner_id = current_user_id
     WHERE id = invite_record.tenant_id
       AND owner_id IS NULL;
  END IF;

  UPDATE public.invitations
     SET status = 'accepted'
   WHERE id = invite_record.id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
  VALUES (
    current_user_id,
    current_email,
    nullif(invite_record.name, ''),
    'Usuário',
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  INSERT INTO public.audit_logs (action, entity, entity_id, details, user_id, tenant_id)
  VALUES (
    'invite_accepted',
    'invitation',
    invite_record.id::text,
    jsonb_build_object('role', coalesce(invite_record.role, 'member')),
    current_user_id,
    invite_record.tenant_id
  );

  RETURN json_build_object(
    'status', 'accepted',
    'tenant_id', invite_record.tenant_id,
    'role', coalesce(invite_record.role, 'member')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_invite_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  membership_record record;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
  END IF;

  SELECT tenant_id, role INTO membership_record
    FROM public.organization_members
   WHERE user_id = current_user_id
   ORDER BY created_at
   LIMIT 1;

  IF membership_record.tenant_id IS NULL THEN
    RETURN json_build_object('status', 'no_invite');
  END IF;

  RETURN json_build_object(
    'status', 'already_member',
    'tenant_id', membership_record.tenant_id,
    'role', coalesce(membership_record.role, 'member')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_invite_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_invite_membership() TO authenticated;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) < 32 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_rate_limits (key_hash, window_started_at, request_count, updated_at)
  VALUES (p_key_hash, now(), 1, now())
  ON CONFLICT (key_hash) DO UPDATE SET
    request_count = CASE
      WHEN public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
        THEN 1
      ELSE public.api_rate_limits.request_count + 1
    END,
    window_started_at = CASE
      WHEN public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now()
        THEN now()
      ELSE public.api_rate_limits.window_started_at
    END,
    updated_at = now()
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
