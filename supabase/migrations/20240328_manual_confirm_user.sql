
-- MIGRATION: CONFIRMAÇÃO MANUAL DE USUÁRIO & HELPER
-- Objetivo: Liberar acesso imediato para 'escinformaticago@gmail.com' e criar função para evitar problema futuro.

BEGIN;

-- 1. Forçar confirmação de e-mail para o usuário travado
UPDATE auth.users
SET email_confirmed_at = now(),
    confirmed_at = now(),
    last_sign_in_at = now(),
    raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email = 'escinformaticago@gmail.com';

-- 2. Garantir que o perfil exista e seja Admin (Fallback de segurança)
INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Esc Informatica Admin'), 
    'Admin', 
    '{"financial_view": true, "approve_purchases": true, "manage_users": true}'::jsonb,
    now()
FROM auth.users 
WHERE email = 'escinformaticago@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'Admin',
    updated_at = now();

COMMIT;

-- 3. Criar função utilitária para o Super Admin confirmar usuários via SQL no futuro se necessário
CREATE OR REPLACE FUNCTION public.force_confirm_user(user_email text)
RETURNS void AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = now(), confirmed_at = now()
    WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
