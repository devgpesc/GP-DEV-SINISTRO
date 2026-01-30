
-- MIGRATION: RESTAURAR ACESSO SUPER ADMIN
-- Data: 2024-03-24

DO $$
BEGIN
    -- 1. Forçar atualização do perfil do usuário específico
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

    -- 2. Garantir que a política de RLS permita que o Super Admin veja tudo
    -- Isso previne que a tela fique carregando infinitamente por falta de permissão de leitura
    DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;
    
    CREATE POLICY "Admins can do everything" ON public.profiles
    FOR ALL USING (
        role IN ('super_admin', 'Admin')
    );

END $$;

-- Recarregar configurações para aplicar imediatamente
NOTIFY pgrst, 'reload config';
