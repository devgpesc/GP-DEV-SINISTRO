-- Permitir consultar convite por token mesmo apos aceito (re-vinculo)

BEGIN;

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
     ORDER BY created_at DESC
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
        'tenant_name', tenant_name_val,
        'status', invite_record.status,
        'token', invite_record.token
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_pending_invite()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
    invite_record public.invitations%ROWTYPE;
    tenant_name text;
BEGIN
    IF current_email = '' THEN
        RETURN NULL;
    END IF;

    SELECT i.*
      INTO invite_record
      FROM public.invitations i
     WHERE lower(i.email) = current_email
     ORDER BY
        CASE WHEN i.status = 'pending' THEN 0 ELSE 1 END,
        i.created_at DESC
     LIMIT 1;

    IF invite_record.id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT t.name INTO tenant_name
      FROM public.saas_tenants t
     WHERE t.id = invite_record.tenant_id;

    RETURN json_build_object(
        'id', invite_record.id,
        'email', invite_record.email,
        'name', invite_record.name,
        'role', invite_record.role,
        'tenant_id', invite_record.tenant_id,
        'tenant_name', coalesce(tenant_name, 'Empresa'),
        'status', invite_record.status,
        'token', invite_record.token
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_pending_invite() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invite() TO authenticated;

COMMIT;
