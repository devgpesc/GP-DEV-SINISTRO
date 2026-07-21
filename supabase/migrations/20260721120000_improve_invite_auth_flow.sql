-- Melhorias no fluxo de convites e autenticacao multi-tenant

BEGIN;

-- Criar convite com token seguro (server-side)
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

    -- Cancela convites pendentes anteriores para o mesmo e-mail neste tenant
    UPDATE public.invitations
       SET status = 'accepted'
     WHERE tenant_id = target_tenant_id
       AND lower(email) = normalized_email
       AND status = 'pending';

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

REVOKE ALL ON FUNCTION public.create_invitation(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid) TO authenticated;

-- Buscar convite pendente para o e-mail do usuario logado
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
       AND i.status = 'pending'
     ORDER BY i.created_at DESC
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

REVOKE ALL ON FUNCTION public.get_my_pending_invite() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invite() TO authenticated;

COMMIT;
