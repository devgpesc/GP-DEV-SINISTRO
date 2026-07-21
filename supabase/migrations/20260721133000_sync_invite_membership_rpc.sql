-- Sincronizar membership a partir do convite do e-mail logado (corrige convite aceito sem vinculo)

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_invite_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
    invite_record public.invitations%ROWTYPE;
    already_member boolean := false;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
    END IF;

    IF current_email = '' THEN
        RAISE EXCEPTION 'E-mail do usuario nao encontrado na sessao.';
    END IF;

    SELECT i.*
      INTO invite_record
      FROM public.invitations i
     WHERE lower(i.email) = current_email
     ORDER BY i.created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF invite_record.id IS NULL THEN
        RETURN json_build_object('status', 'no_invite');
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM public.organization_members om
         WHERE om.tenant_id = invite_record.tenant_id
           AND om.user_id = current_user_id
    ) INTO already_member;

    IF already_member THEN
        RETURN json_build_object(
            'status', 'already_member',
            'tenant_id', invite_record.tenant_id,
            'role', coalesce(invite_record.role, 'member')
        );
    END IF;

    INSERT INTO public.organization_members (tenant_id, user_id, role)
    VALUES (invite_record.tenant_id, current_user_id, coalesce(invite_record.role, 'member'))
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET role = excluded.role;

    IF invite_record.role = 'owner' THEN
        UPDATE public.saas_tenants
           SET owner_id = current_user_id
         WHERE id = invite_record.tenant_id;
    END IF;

    UPDATE public.invitations
       SET status = 'accepted'
     WHERE id = invite_record.id;

    INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
    VALUES (
        current_user_id,
        current_email,
        nullif(invite_record.name, ''),
        'Usuário',
        '{}'::jsonb,
        now()
    )
    ON CONFLICT (id)
    DO UPDATE SET
        full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name),
        email = EXCLUDED.email,
        updated_at = now();

    RETURN json_build_object(
        'status', 'linked',
        'tenant_id', invite_record.tenant_id,
        'role', coalesce(invite_record.role, 'member')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_invite_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_invite_membership() TO authenticated;

COMMIT;
