
-- MIGRATION: GERENCIAMENTO DE PERMISSÕES E ADMINISTRAÇÃO
-- Execute este script no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. Adicionar coluna JSONB para permissões granulares (funcionalidades)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN
        ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- 2. Atualizar seu usuário para ADMIN e dar TODAS as permissões
    -- Substitua 'devgpesc@gmail.com' pelo seu email se for diferente
    UPDATE public.profiles
    SET 
        role = 'admin',
        permissions = '{
            "financial_view": true, 
            "approve_purchases": true, 
            "manage_users": true, 
            "delete_records": true,
            "view_reports": true
        }'::jsonb
    WHERE email = 'devgpesc@gmail.com'; -- Coloque seu email aqui se necessário

END $$;

-- Recarregar configurações
NOTIFY pgrst, 'reload config';
