BEGIN;

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

    SELECT st.*
      INTO tenant_record
      FROM public.saas_tenants st
     WHERE st.owner_id = current_user_id
     ORDER BY st.created_at ASC
     LIMIT 1;

    IF tenant_record.id IS NULL THEN
        SELECT st.*
          INTO tenant_record
          FROM public.organization_members om
          JOIN public.saas_tenants st ON st.id = om.tenant_id
         WHERE om.user_id = current_user_id
         ORDER BY om.created_at ASC
         LIMIT 1;
    END IF;

    IF tenant_record.id IS NULL THEN
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
    END IF;

    INSERT INTO public.organization_members (tenant_id, user_id, role)
    VALUES (tenant_record.id, current_user_id, 'owner')
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET role = 'owner';

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

REVOKE ALL ON FUNCTION public.complete_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_registration(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invite_details(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite_record record;
    tenant_name_val text;
BEGIN
    SELECT *
      INTO invite_record
      FROM public.invitations
     WHERE token = invite_token
       AND status = 'pending'
     LIMIT 1;

    IF invite_record IS NULL THEN
        RETURN NULL;
    END IF;

    IF invite_record.tenant_id IS NOT NULL THEN
        SELECT name INTO tenant_name_val
          FROM public.saas_tenants
         WHERE id = invite_record.tenant_id;
    ELSE
        tenant_name_val := 'Empresa Convidada';
    END IF;

    RETURN json_build_object(
        'id', invite_record.id,
        'email', invite_record.email,
        'name', invite_record.name,
        'tenant_id', invite_record.tenant_id,
        'role', invite_record.role,
        'tenant_name', tenant_name_val
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
