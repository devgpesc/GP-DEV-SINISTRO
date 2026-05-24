BEGIN;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = check_user_id
       AND p.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_root_platform_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = check_user_id
       AND p.role = 'super_admin'
       AND lower(p.email) = 'devgpesc@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_super_admin(check_user_id)
      OR EXISTS (
        SELECT 1
          FROM public.organization_members om
          JOIN public.profiles p ON p.id = om.user_id
         WHERE om.tenant_id = check_tenant_id
           AND om.user_id = check_user_id
           AND (
             om.role IN ('owner', 'admin')
             OR p.role IN ('Admin', 'Gerente')
             OR coalesce((p.permissions ->> 'manage_users')::boolean, false)
           )
      );
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_members(target_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  permissions jsonb,
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
    p.permissions,
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

CREATE OR REPLACE FUNCTION public.update_tenant_member_profile(
  target_tenant_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_role text,
  target_permissions jsonb DEFAULT '{}'::jsonb,
  target_membership_role text DEFAULT 'member'
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
    SELECT 1
      FROM public.organization_members
     WHERE tenant_id = target_tenant_id
       AND user_id = target_user_id
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
         permissions = coalesce(target_permissions, '{}'::jsonb),
         updated_at = now()
   WHERE id = target_user_id;

  UPDATE public.organization_members
     SET role = normalized_membership_role
   WHERE tenant_id = target_tenant_id
     AND user_id = target_user_id;

  RETURN json_build_object('status', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_tenant_member(target_tenant_id uuid, target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tenant_admin(target_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da empresa podem remover usuarios.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Voce nao pode remover o proprio acesso por aqui.';
  END IF;

  DELETE FROM public.organization_members
   WHERE tenant_id = target_tenant_id
     AND user_id = target_user_id;

  RETURN json_build_object('status', 'detached');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_platform_super_admin(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_root_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente devgpesc@gmail.com pode conceder Super Admin.';
  END IF;

  UPDATE public.profiles
     SET role = 'super_admin',
         permissions = jsonb_build_object(
           'saas_admin', true,
           'financial_view', true,
           'approve_purchases', true,
           'manage_users', true,
           'delete_records', true,
           'view_reports', true
         ),
         updated_at = now()
   WHERE id = target_user_id;

  RETURN json_build_object('status', 'super_admin_assigned');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_owner_summary(target_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_record record;
BEGIN
  IF NOT public.is_platform_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT p.id, p.full_name, p.email, om.role
    INTO owner_record
    FROM public.organization_members om
    JOIN public.profiles p ON p.id = om.user_id
   WHERE om.tenant_id = target_tenant_id
   ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, p.created_at ASC
   LIMIT 1;

  IF owner_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', owner_record.id,
    'full_name', owner_record.full_name,
    'email', owner_record.email,
    'membership_role', owner_record.role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_registration(company_name text, full_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
    requested_company text := nullif(trim(company_name), '');
    requested_name text := nullif(trim(full_name), '');
    default_plan_id uuid;
    tenant_record public.saas_tenants%ROWTYPE;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
    END IF;

    IF requested_company IS NULL THEN
        RAISE EXCEPTION 'Nome da empresa obrigatorio.';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.organization_members
       WHERE user_id = current_user_id
    ) OR EXISTS (
      SELECT 1
        FROM public.saas_tenants
       WHERE owner_id = current_user_id
    ) THEN
        RAISE EXCEPTION 'Este e-mail ja esta vinculado a uma empresa. Use outro e-mail ou solicite convite.';
    END IF;

    SELECT id INTO default_plan_id
      FROM public.saas_plans
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1;

    INSERT INTO public.saas_tenants (
        name,
        status,
        owner_id,
        plan_id,
        document,
        subscription_status,
        trial_ends_at
    )
    VALUES (
        requested_company,
        'active',
        current_user_id,
        default_plan_id,
        '00.000.000/0001-00',
        'trial',
        now() + interval '14 days'
    )
    RETURNING * INTO tenant_record;

    INSERT INTO public.organization_members (tenant_id, user_id, role)
    VALUES (tenant_record.id, current_user_id, 'owner');

    INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
    VALUES (
        current_user_id,
        current_email,
        coalesce(requested_name, split_part(current_email, '@', 1)),
        'Admin',
        jsonb_build_object(
            'financial_view', true,
            'approve_purchases', true,
            'manage_users', true,
            'delete_records', true,
            'view_reports', true
        ),
        now()
    )
    ON CONFLICT (id)
    DO UPDATE SET
        email = coalesce(EXCLUDED.email, public.profiles.email),
        full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name),
        role = 'Admin',
        permissions = EXCLUDED.permissions,
        updated_at = now();

    RETURN json_build_object(
        'tenant_id', tenant_record.id,
        'tenant_name', tenant_record.name,
        'role', 'owner',
        'status', 'configured'
    );
END;
$$;

DROP POLICY IF EXISTS "Acesso total logado" ON public.profiles;
DROP POLICY IF EXISTS "Acesso total logado" ON public.saas_tenants;
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Read All Profiles" ON public.profiles;

REVOKE ALL ON FUNCTION public.is_platform_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_root_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tenant_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detach_tenant_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_platform_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tenant_owner_summary(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_root_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detach_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_owner_summary(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_registration(text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
