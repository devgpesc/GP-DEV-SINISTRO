
-- MIGRATION: CONFIRMAÇÃO EM MASSA (CORRIGIDO)
-- Objetivo: Confirmar os usuários travados sem violar colunas geradas.

BEGIN;

-- 1. Confirma todos os usuários pendentes atualizando apenas o email_confirmed_at
UPDATE auth.users
SET 
    email_confirmed_at = now(),
    last_sign_in_at = now(),
    raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email_confirmed_at IS NULL;

-- 2. Garante que os perfis existam para esses usuários
INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
    'Admin', -- Assume Admin para quem cria a conta
    '{"financial_view": true, "approve_purchases": true, "manage_users": true}'::jsonb,
    now()
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
