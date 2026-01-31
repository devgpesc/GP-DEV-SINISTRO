
-- MIGRATION: SAAS MULTI-TENANT ARCHITECTURE (CORRECTED & IDEMPOTENT)
-- Data: 2024-04-01
-- Objetivo: Implementar multi-tenancy respeitando estruturas existentes, garantindo RLS seguro e compatibilidade.

BEGIN;

-- ==============================================================================
-- 1. FUNÇÕES AUXILIARES E EXTENSÕES
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função auxiliar para verificar existência de coluna (para lógica condicional limpa)
CREATE OR REPLACE FUNCTION public.column_exists(tname text, cname text)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tname AND column_name = cname);
END;
$$;

-- ==============================================================================
-- 2. ESTRUTURA BASE (Tenants e Membros)
-- ==============================================================================

-- 2.1. Tabela de Planos
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    price numeric DEFAULT 0,
    max_users integer DEFAULT 5,
    max_events integer DEFAULT 100,
    features jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 2.2. Tabela de Tenants (Empresas)
CREATE TABLE IF NOT EXISTS public.saas_tenants (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    document text,
    slug text UNIQUE,
    status text DEFAULT 'active',
    plan_id uuid REFERENCES public.saas_plans(id),
    owner_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.saas_tenants ENABLE ROW LEVEL SECURITY;

-- 2.3. Tabela de Membros (Join Table)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id uuid REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'member', -- owner, admin, member
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. PERFIS DE USUÁRIO (Compatibilidade com Legado)
-- ==============================================================================

-- 3.1. Garantir tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text,
    full_name text,
    avatar_url text,
    role text DEFAULT 'user', -- Role do SISTEMA (Global)
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.2. Garantir colunas (Idempotente)
DO $$
BEGIN
    IF NOT public.column_exists('profiles', 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name text;
    END IF;
    -- Se a coluna 'name' antiga existir e for NOT NULL, removemos a obrigatoriedade para evitar erros
    IF public.column_exists('profiles', 'name') THEN
        ALTER TABLE public.profiles ALTER COLUMN "name" DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. MIGRAÇÃO DE DADOS (BACKFILL SEGURO)
-- ==============================================================================

DO $$
DECLARE
    v_default_tenant_id uuid;
    v_count integer;
    t_name text;
BEGIN
    -- 4.1. Criar/Recuperar Tenant Padrão
    -- Tenta encontrar um tenant existente para usar como padrão
    SELECT id INTO v_default_tenant_id FROM public.saas_tenants ORDER BY created_at ASC LIMIT 1;
    
    IF v_default_tenant_id IS NULL THEN
        INSERT INTO public.saas_tenants (name, document, status)
        VALUES ('Minha Organização (Padrão)', '00000000000', 'active')
        RETURNING id INTO v_default_tenant_id;
    END IF;

    -- 4.2. Vincular usuários existentes ao Tenant Padrão como Admin
    INSERT INTO public.organization_members (tenant_id, user_id, role)
    SELECT v_default_tenant_id, id, 'admin'
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.organization_members)
    ON CONFLICT DO NOTHING;

    -- 4.3. Migrar Tabelas de Negócio (Events, Vehicles, Suppliers, etc)
    -- Adiciona coluna tenant_id e preenche com default
    
    FOREACH t_name IN ARRAY ARRAY['events', 'vehicles', 'suppliers', 'purchase_orders', 'quotations', 'catalog_items', 'associates', 'deliveries', 'audit_logs', 'notifications', 'supplier_reviews'] LOOP
        
        -- Verifica se tabela existe antes de alterar
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            IF NOT public.column_exists(t_name, 'tenant_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.saas_tenants(id)', t_name);
                -- Popula dados antigos
                EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL', t_name) USING v_default_tenant_id;
            END IF;
        END IF;

    END LOOP;

    -- 4.4. Migrar SAAS_SETTINGS para Multi-tenant
    IF public.column_exists('saas_settings', 'id') THEN
        IF NOT public.column_exists('saas_settings', 'tenant_id') THEN
            ALTER TABLE public.saas_settings ADD COLUMN tenant_id uuid REFERENCES public.saas_tenants(id);
            UPDATE public.saas_settings SET tenant_id = v_default_tenant_id WHERE id = 1;
        END IF;
    END IF;

END $$;

-- ==============================================================================
-- 5. FUNÇÕES DE SEGURANÇA (RLS HELPER)
-- ==============================================================================

-- Função rápida para obter os IDs de tenant que o usuário pode acessar
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS TABLE (tenant_id uuid) 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM public.saas_tenants WHERE owner_id = auth.uid();
$$;

-- Função Trigger para auto-atribuir tenant_id (FALLBACK PARA FRONTEND ANTIGO)
-- Isso permite que o frontend atual continue funcionando sem enviar tenant_id
CREATE OR REPLACE FUNCTION public.set_default_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM public.organization_members
        WHERE user_id = auth.uid()
        LIMIT 1; -- Pega o primeiro tenant encontrado
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 6. APLICAÇÃO DE POLÍTICAS (RLS) E TRIGGERS
-- ==============================================================================

DO $$
DECLARE
    t_name text;
BEGIN
    FOREACH t_name IN ARRAY ARRAY['events', 'vehicles', 'suppliers', 'purchase_orders', 'quotations', 'catalog_items', 'associates', 'deliveries', 'audit_logs', 'notifications', 'supplier_reviews'] LOOP
        
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            
            -- 1. Habilita RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- 2. Limpa Policy Antiga
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation %I" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I', t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.%I', t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for auth users" ON public.%I', t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Secure: Authenticated Read Only" ON public.%I', t_name);
            
            -- 3. Cria Nova Policy Multi-tenant
            EXECUTE format('
                CREATE POLICY "Tenant Isolation %I" ON public.%I
                FOR ALL USING (
                    tenant_id IN (SELECT public.get_my_tenant_ids())
                ) WITH CHECK (
                    tenant_id IN (SELECT public.get_my_tenant_ids())
                )
            ', t_name, t_name);

            -- 4. Trigger de Fallback (Auto-assign tenant_id)
            EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_%I ON public.%I', t_name, t_name);
            EXECUTE format('
                CREATE TRIGGER trg_set_tenant_%I
                BEFORE INSERT ON public.%I
                FOR EACH ROW
                EXECUTE FUNCTION public.set_default_tenant_id()
            ', t_name, t_name);

        END IF;
    END LOOP;
END $$;

-- Políticas Específicas: PROFILES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Read Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users" ON public.profiles;

-- Permitir leitura do próprio perfil
CREATE POLICY "Read Own Profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Permitir leitura de membros do mesmo tenant
CREATE POLICY "Read Tenant Members" ON public.profiles FOR SELECT USING (
    id IN (
        SELECT user_id FROM public.organization_members 
        WHERE tenant_id IN (SELECT public.get_my_tenant_ids())
    )
);
-- Permitir update do próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Update Own Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- Políticas Específicas: SAAS_SETTINGS
DROP POLICY IF EXISTS "Authenticated Users Full Access Settings" ON public.saas_settings;
DROP POLICY IF EXISTS "Tenant Settings Access" ON public.saas_settings;

CREATE POLICY "Tenant Settings Access" ON public.saas_settings
FOR ALL USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
) WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids())
);

-- Trigger de fallback também para settings
DROP TRIGGER IF EXISTS trg_set_tenant_settings ON public.saas_settings;
CREATE TRIGGER trg_set_tenant_settings
BEFORE INSERT ON public.saas_settings
FOR EACH ROW EXECUTE FUNCTION public.set_default_tenant_id();


-- Políticas Específicas: ORGANIZATION_MEMBERS
DROP POLICY IF EXISTS "View Own Memberships" ON public.organization_members;
CREATE POLICY "View Own Memberships" ON public.organization_members
FOR SELECT USING (
    user_id = auth.uid() OR 
    tenant_id IN (SELECT public.get_my_tenant_ids())
);

-- ==============================================================================
-- 7. TRIGGER DE CRIAÇÃO DE USUÁRIO (Robustez)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
BEGIN
  -- Fallbacks para encontrar o nome
  v_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
  VALUES (
    new.id, 
    new.email, 
    v_name, 
    'Usuário', 
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload config';
