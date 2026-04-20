-- Migration to securely fetch invitation details without exposing the table to public RLS

BEGIN;

CREATE OR REPLACE FUNCTION public.get_invite_details(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator privileges, bypassing RLS wrapper
SET search_path = public
AS $$
DECLARE
    invite_record record;
    tenant_name_val text;
BEGIN
    -- Busca o convite correspondente
    SELECT * INTO invite_record FROM public.invitations WHERE token = invite_token LIMIT 1;
    
    -- Se não encontrar, retorna nulo para o client tratar
    IF invite_record IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se tiver tenant atrelado, busca o nome da empresa
    IF invite_record.tenant_id IS NOT NULL THEN
        SELECT name INTO tenant_name_val FROM public.saas_tenants WHERE id = invite_record.tenant_id;
    ELSE
        tenant_name_val := 'Empresa Convidada';
    END IF;

    -- Retorna os dados agrupados
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

-- Permite uso não-autenticado para a tela de Registro/Login
GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO authenticated;

COMMIT;
