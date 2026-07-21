-- Corrigir convite consumido antes da confirmacao de e-mail e permitir reconvite

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
    already_member boolean := false;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
    END IF;

    SELECT *
      INTO invite_record
      FROM public.invitations
     WHERE token = invite_token
     LIMIT 1
     FOR UPDATE;

    IF invite_record.id IS NULL THEN
        RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
    END IF;

    IF lower(coalesce(invite_record.email, '')) <> current_email THEN
        RAISE EXCEPTION 'Este convite pertence a outro e-mail.';
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM public.organization_members om
         WHERE om.tenant_id = invite_record.tenant_id
           AND om.user_id = current_user_id
    ) INTO already_member;

    IF invite_record.status = 'accepted' THEN
        IF already_member THEN
            RETURN json_build_object(
                'tenant_id', invite_record.tenant_id,
                'role', coalesce(invite_record.role, 'member'),
                'status', 'already_member'
            );
        END IF;
    ELSIF invite_record.status <> 'pending' THEN
        RAISE EXCEPTION 'Convite invalido ou ja utilizado.';
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
        'status', CASE WHEN already_member THEN 'already_member' ELSE 'accepted' END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email text,
    p_name text,
    p_role text DEFAULT 'member',
    p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    invite_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    normalized_email text := lower(trim(coalesce(p_email, '')));
    normalized_name text := trim(coalesce(p_name, ''));
    target_tenant_id uuid := p_tenant_id;
    new_invite_id uuid;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio.';
    END IF;

    IF normalized_email = '' OR normalized_name = '' THEN
        RAISE EXCEPTION 'Nome e e-mail sao obrigatorios.';
    END IF;

    IF target_tenant_id IS NULL THEN
        SELECT om.tenant_id
          INTO target_tenant_id
          FROM public.organization_members om
         WHERE om.user_id = current_user_id
           AND om.role IN ('owner', 'admin')
         LIMIT 1;
    END IF;

    IF target_tenant_id IS NULL OR NOT public.is_tenant_admin(target_tenant_id, current_user_id) THEN
        RAISE EXCEPTION 'Sem permissao para convidar membros nesta empresa.';
    END IF;

    DELETE FROM public.invitations
     WHERE tenant_id = target_tenant_id
       AND lower(email) = normalized_email;

    INSERT INTO public.invitations (email, name, role, status, token, tenant_id, created_by)
    VALUES (normalized_email, normalized_name, coalesce(nullif(trim(p_role), ''), 'member'), 'pending', invite_token, target_tenant_id, current_user_id)
    RETURNING id INTO new_invite_id;

    RETURN json_build_object(
        'id', new_invite_id,
        'token', invite_token,
        'email', normalized_email,
        'tenant_id', target_tenant_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_tenant_member(target_tenant_id uuid, target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_email text;
BEGIN
    IF NOT public.is_tenant_admin(target_tenant_id, auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores da empresa podem remover usuarios.';
    END IF;

    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Voce nao pode remover o proprio acesso por aqui.';
    END IF;

    SELECT lower(coalesce(p.email, ''))
      INTO target_email
      FROM public.profiles p
     WHERE p.id = target_user_id;

    DELETE FROM public.organization_members
     WHERE tenant_id = target_tenant_id
       AND user_id = target_user_id;

    IF target_email <> '' THEN
        DELETE FROM public.invitations
         WHERE tenant_id = target_tenant_id
           AND lower(email) = target_email;
    END IF;

    RETURN json_build_object('status', 'detached');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_invitation(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.detach_tenant_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detach_tenant_member(uuid, uuid) TO authenticated;

COMMIT;
