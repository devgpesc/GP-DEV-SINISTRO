-- Migration to allow super_admin to delete users completely

CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificação de segurança: apenas super_admin ou Admin podem executar
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'Admin')) THEN
        RAISE EXCEPTION 'Acesso Negado: Apenas administradores podem excluir usuários.';
    END IF;

    -- Deleta o usuário da auth.users. O ON DELETE CASCADE cuidará de profiles, organization_members, etc.
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN true;
END;
$$;
