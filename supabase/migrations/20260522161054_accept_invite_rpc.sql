-- Accept an invitation using the currently authenticated user.
-- Keeps tenant membership creation server-side, instead of trusting client-side IDs.

BEGIN;

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
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
    END IF;

    SELECT *
      INTO invite_record
      FROM public.invitations
     WHERE token = invite_token
       AND status = 'pending'
     LIMIT 1
     FOR UPDATE;

    IF invite_record.id IS NULL THEN
        RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
    END IF;

    IF lower(coalesce(invite_record.email, '')) <> current_email THEN
        RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
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
        updated_at = now();

    RETURN json_build_object(
        'tenant_id', invite_record.tenant_id,
        'role', coalesce(invite_record.role, 'member'),
        'status', 'accepted'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

COMMIT;
