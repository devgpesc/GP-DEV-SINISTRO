-- Permissões por empresa + correção event_attachments (file_name NOT NULL)

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Copia permissões globais legadas para a membership (por empresa)
UPDATE public.organization_members om
   SET permissions = COALESCE(p.permissions, '{}'::jsonb)
  FROM public.profiles p
 WHERE p.id = om.user_id
   AND (om.permissions = '{}'::jsonb OR om.permissions IS NULL)
   AND COALESCE(p.permissions, '{}'::jsonb) <> '{}'::jsonb;

-- Membros existentes: módulos liberados por padrão (compatibilidade)
UPDATE public.organization_members
   SET module_permissions = jsonb_build_object(
     'dashboard', true,
     'eventos', true,
     'cotacoes', true,
     'compras', true,
     'entregas', true,
     'associados', true,
     'fornecedores', true,
     'veiculos', true,
     'catalogo', true,
     'relatorios', true,
     'configuracoes', true,
     'notificacoes', true
   )
 WHERE module_permissions = '{}'::jsonb OR module_permissions IS NULL;

-- event_attachments: garantir name + file_name sincronizados
ALTER TABLE public.event_attachments
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS mime_type text;

UPDATE public.event_attachments
   SET name = COALESCE(name, file_name, split_part(url, '/', array_length(string_to_array(url, '/'), 1)), 'Anexo')
 WHERE name IS NULL;

UPDATE public.event_attachments
   SET file_name = COALESCE(file_name, name, 'Anexo')
 WHERE file_name IS NULL;

ALTER TABLE public.event_attachments
  ALTER COLUMN file_name DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_event_attachment_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := COALESCE(NULLIF(trim(NEW.name), ''), NULLIF(trim(NEW.file_name), ''), 'Anexo');
  NEW.file_name := COALESCE(NULLIF(trim(NEW.file_name), ''), NEW.name, 'Anexo');
  IF NEW.type IS NULL AND NEW.mime_type IS NOT NULL THEN
    NEW.type := NEW.mime_type;
  END IF;
  IF NEW.mime_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.mime_type := NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_attachment_names ON public.event_attachments;
CREATE TRIGGER trg_sync_event_attachment_names
BEFORE INSERT OR UPDATE ON public.event_attachments
FOR EACH ROW EXECUTE FUNCTION public.sync_event_attachment_names();

CREATE OR REPLACE FUNCTION public.next_event_protocol(p_tenant_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part text := to_char(now(), 'YYYY');
  next_num integer := 1;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN protocol ~ ('^EVT-' || year_part || '-[0-9]+$')
      THEN NULLIF(regexp_replace(protocol, '^EVT-' || year_part || '-', ''), '')::integer
      ELSE NULL
    END
  ), 0) + 1
    INTO next_num
    FROM public.events e
   WHERE (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
     AND protocol LIKE 'EVT-' || year_part || '-%';

  RETURN 'EVT-' || year_part || '-' || lpad(next_num::text, 4, '0');
END;
$$;

DROP FUNCTION IF EXISTS public.get_tenant_members(uuid);

CREATE OR REPLACE FUNCTION public.get_tenant_members(target_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  permissions jsonb,
  module_permissions jsonb,
  created_at timestamptz,
  membership_role text,
  tenant_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa obrigatoria.';
  END IF;

  IF NOT (
    public.is_platform_super_admin(auth.uid())
    OR target_tenant_id IN (SELECT public.get_my_tenant_ids())
  ) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.role,
    om.permissions,
    om.module_permissions,
    p.created_at,
    om.role AS membership_role,
    om.tenant_id
  FROM public.organization_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.tenant_id = target_tenant_id
  ORDER BY
    CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    p.created_at ASC;
END;
$$;

DROP FUNCTION IF EXISTS public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_tenant_member_profile(
  target_tenant_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_role text,
  target_permissions jsonb DEFAULT '{}'::jsonb,
  target_membership_role text DEFAULT 'member',
  target_module_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_role text := coalesce(nullif(trim(target_role), ''), 'Usuario');
  normalized_membership_role text := coalesce(nullif(trim(target_membership_role), ''), 'member');
BEGIN
  IF target_tenant_id IS NULL OR target_user_id IS NULL THEN
    RAISE EXCEPTION 'Empresa e usuario sao obrigatorios.';
  END IF;

  IF NOT public.is_tenant_admin(target_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da empresa podem alterar usuarios.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE tenant_id = target_tenant_id AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Usuario nao pertence a esta empresa.';
  END IF;

  IF normalized_role = 'super_admin' AND NOT public.is_root_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o super admin da plataforma pode conceder este nivel.';
  END IF;

  IF normalized_role NOT IN ('super_admin', 'Admin', 'Gerente', 'Usuario', 'Usuário') THEN
    RAISE EXCEPTION 'Nivel de acesso invalido.';
  END IF;

  IF normalized_membership_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Papel na empresa invalido.';
  END IF;

  UPDATE public.profiles
     SET full_name = nullif(trim(target_full_name), ''),
         role = CASE WHEN normalized_role = 'Usuario' THEN 'Usuário' ELSE normalized_role END,
         updated_at = now()
   WHERE id = target_user_id;

  UPDATE public.organization_members
     SET role = normalized_membership_role,
         permissions = coalesce(target_permissions, '{}'::jsonb),
         module_permissions = coalesce(target_module_permissions, '{}'::jsonb)
   WHERE tenant_id = target_tenant_id
     AND user_id = target_user_id;

  RETURN json_build_object('status', 'updated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_event_protocol(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload config';
