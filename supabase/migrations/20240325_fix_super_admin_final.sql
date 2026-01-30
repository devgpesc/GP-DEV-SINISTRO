
-- MIGRATION: CORREÇÃO DEFINITIVA SUPER ADMIN (FORCE UPDATE)
-- Data: 2024-03-25

BEGIN;

-- 1. REMOVER RESTRIÇÕES ANTIGAS (Constraint Check)
-- Isso resolve o erro "violates check constraint" que impedia o cargo 'super_admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS "profiles_role_check";

-- 2. RECRIAR RESTRIÇÃO PERMITINDO 'super_admin'
ALTER TABLE public.profiles 
ADD CONSTRAINT "profiles_role_check" 
CHECK (role IN ('super_admin', 'Admin', 'Gerente', 'Usuário'));

-- 3. FORÇAR ATUALIZAÇÃO DO USUÁRIO
UPDATE public.profiles
SET 
    role = 'super_admin',
    full_name = 'Super Admin (Dev)', -- Garante que tenha um nome para não travar
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

-- 4. CORRIGIR POLÍTICAS DE SEGURANÇA (RLS)
-- Garante que o Super Admin possa VER e EDITAR tudo, evitando telas de carregamento infinito

-- Tabela PROFILES
DROP POLICY IF EXISTS "Super Admin Everything" ON public.profiles;
CREATE POLICY "Super Admin Everything" ON public.profiles
FOR ALL USING (
    (select role from public.profiles where id = auth.uid()) = 'super_admin'
);

-- Tabela SAAS_SETTINGS (Garante acesso ao painel SaaS)
DROP POLICY IF EXISTS "Super Admin Settings" ON public.saas_settings;
CREATE POLICY "Super Admin Settings" ON public.saas_settings
FOR ALL USING (
    (select role from public.profiles where id = auth.uid()) = 'super_admin'
);

-- Tabela SAAS_TENANTS
DROP POLICY IF EXISTS "Super Admin Tenants" ON public.saas_tenants;
CREATE POLICY "Super Admin Tenants" ON public.saas_tenants
FOR ALL USING (
    (select role from public.profiles where id = auth.uid()) = 'super_admin'
);

COMMIT;

-- Forçar recarregamento da API
NOTIFY pgrst, 'reload config';
