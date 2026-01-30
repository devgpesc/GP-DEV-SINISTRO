
-- MIGRATION: FIX RLS RECURSION & SUPER ADMIN ACCESS
-- Data: 2024-03-26
-- Objetivo: Criar função segura para verificação de admin e corrigir políticas que causam travamento (loop infinito).

BEGIN;

-- 1. FUNÇÃO SECURITY DEFINER
-- Esta função verifica se é admin ignorando as políticas RLS da tabela profiles.
-- Isso quebra o ciclo de recursão (Policy -> Query -> Policy -> Query...).
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND (role = 'super_admin' OR role = 'Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CORRIGIR POLÍTICAS DA TABELA PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas antigas que podem estar causando conflito
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin Everything" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all" ON public.profiles;
DROP POLICY IF EXISTS "Read Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Update Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin Manage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Read Others Profiles" ON public.profiles;

-- Nova Política 1: Ler o próprio perfil (Essencial para login)
CREATE POLICY "Read Own Profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Nova Política 2: Ler perfis de outros (Necessário para listar usuários na gestão, ver quem criou eventos, etc)
-- Permitimos leitura para todos os autenticados para evitar complexidade e bloqueios de UI
CREATE POLICY "Read All Profiles" ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- Nova Política 3: Editar próprio perfil
CREATE POLICY "Update Own Profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Nova Política 4: Admins podem fazer tudo (Usando a função segura)
CREATE POLICY "Admins Full Access" ON public.profiles
FOR ALL USING (public.check_is_admin());


-- 3. CORRIGIR POLÍTICAS DE SAAS (Settings e Tenants)
-- Usa a função segura para garantir acesso ao painel SaaS

DROP POLICY IF EXISTS "Super Admin Settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Super Admin Manage Settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Auth Read Settings" ON public.saas_settings;

-- Leitura de configurações globais (Logo, Nome) permitida para todos logados
CREATE POLICY "Read Settings" ON public.saas_settings
FOR SELECT USING (auth.role() = 'authenticated');

-- Edição apenas para Super Admin
CREATE POLICY "Admin Manage Settings" ON public.saas_settings
FOR ALL USING (public.check_is_admin());


DROP POLICY IF EXISTS "Super Admin Tenants" ON public.saas_tenants;
DROP POLICY IF EXISTS "Super Admin Manage Tenants" ON public.saas_tenants;

-- Gestão de Tenants apenas para Admin
CREATE POLICY "Admin Manage Tenants" ON public.saas_tenants
FOR ALL USING (public.check_is_admin());


-- 4. FORÇAR ATUALIZAÇÃO DO USUÁRIO
-- Garante que o usuário específico seja super_admin
UPDATE public.profiles
SET 
    role = 'super_admin',
    full_name = COALESCE(full_name, 'Super Admin'),
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

COMMIT;

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload config';
