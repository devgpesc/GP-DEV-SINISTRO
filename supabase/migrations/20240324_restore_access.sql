
-- MIGRATION: RESTAURAR ACESSO SUPER ADMIN (CORREÇÃO DE CONSTRAINT)
-- Data: 2024-03-24

DO $$
BEGIN
    -- 1. CORREÇÃO DA CONSTRAINT "profiles_role_check"
    -- O erro 23514 ocorre porque a tabela tem uma validação que não aceita 'super_admin'.
    -- Precisamos recriar essa validação aceitando o novo cargo.

    -- Remove a restrição antiga se existir
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS "profiles_role_check";

    -- Adiciona a nova restrição incluindo 'super_admin'
    ALTER TABLE public.profiles 
    ADD CONSTRAINT "profiles_role_check" 
    CHECK (role IN ('super_admin', 'Admin', 'Gerente', 'Usuário'));

    -- 2. Forçar atualização do perfil do usuário específico
    UPDATE public.profiles
    SET 
        role = 'super_admin',
        permissions = '{
            "financial_view": true, 
            "approve_purchases": true, 
            "manage_users": true, 
            "delete_records": true,
            "view_reports": true,
            "saas_admin": true
        }'::jsonb,
        updated_at = now()
    WHERE email = 'devgpesc@gmail.com';

    -- 3. Garantir que a política de RLS permita que o Super Admin veja tudo
    DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;
    
    CREATE POLICY "Admins can do everything" ON public.profiles
    FOR ALL USING (
        role IN ('super_admin', 'Admin')
    );

END $$;

-- Recarregar configurações para aplicar imediatamente
NOTIFY pgrst, 'reload config';
