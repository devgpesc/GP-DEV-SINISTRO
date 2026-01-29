
-- SOLUÇÃO DEFINITIVA: SINCRONIZAÇÃO DE PERFIS E CORREÇÃO DE FK
-- Execute este script no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. GARANTIR ESTRUTURA DA TABELA PROFILES
    -- Verifica se as colunas essenciais existem
    CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        email text,
        role text DEFAULT 'user',
        full_name text,
        avatar_url text,
        permissions jsonb DEFAULT '{}'::jsonb,
        updated_at timestamp with time zone DEFAULT now()
    );

    -- 2. RECRIAR TRIGGER DE SINCRONIZAÇÃO (Blindado)
    -- Esta função roda sempre que um usuário é criado no Auth
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url, role, permissions, updated_at)
        VALUES (
            new.id,
            new.email,
            COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
            new.raw_user_meta_data->>'avatar_url',
            'user', -- Padrão é user
            '{}'::jsonb,
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();
        RETURN new;
    END;
    $trigger$ LANGUAGE plpgsql SECURITY DEFINER; -- Security Definer é crucial para permisions

    -- Remove trigger antigo se existir e recria
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- 3. BACKFILL: CORRIGIR USUÁRIOS EXISTENTES SEM PERFIL (A Causa do seu erro)
    -- Insere perfil para qualquer usuário do Auth que não tenha registro na tabela profiles
    INSERT INTO public.profiles (id, email, role, permissions, updated_at)
    SELECT 
        id, 
        email, 
        'user', 
        '{}'::jsonb, 
        created_at
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles);

    -- 4. PROMOVER SEU USUÁRIO A ADMIN (Hardcodado para segurança)
    -- Substitua o email abaixo pelo seu email de login exato se for diferente
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
    WHERE email ILIKE '%devgpesc@gmail.com%' OR email ILIKE '%admin%';

    -- 5. REVISÃO DE POLÍTICAS RLS (Segurança)
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Política: Todos podem ver perfis básicos (necessário para listar usuários na gestão)
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
    CREATE POLICY "Profiles are viewable by users" ON public.profiles
        FOR SELECT USING (auth.role() = 'authenticated');

    -- Política: Usuário pode editar o próprio perfil
    DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = id);
    
    -- Política: Admin pode fazer tudo (Gerenciar usuários)
    -- (Opcional, depende da lógica de app, mas garante que o admin não seja bloqueado)
    DROP POLICY IF EXISTS "Admins can update all" ON public.profiles;
    CREATE POLICY "Admins can update all" ON public.profiles
        FOR ALL USING (
            exists (
                select 1 from public.profiles
                where id = auth.uid() and role in ('admin', 'super_admin')
            )
        );

END $$;

-- Recarrega configurações
NOTIFY pgrst, 'reload config';
