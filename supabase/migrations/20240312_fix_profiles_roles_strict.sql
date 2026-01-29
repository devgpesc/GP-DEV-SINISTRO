
-- CORREÇÃO DEFINITIVA DE PERFIS E ROLES (Respeitando CHECK CONSTRAINT)
-- Valores permitidos: 'Admin', 'Gerente', 'Usuário'

DO $$
BEGIN
    -- 1. GARANTIR ESTRUTURA DA TABELA PROFILES
    -- Verifica se as colunas essenciais existem
    CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        email text,
        role text DEFAULT 'Usuário', -- Valor padrão corrigido
        full_name text,
        avatar_url text,
        permissions jsonb DEFAULT '{}'::jsonb,
        updated_at timestamp with time zone DEFAULT now()
    );

    -- 2. RECRIAR TRIGGER DE SINCRONIZAÇÃO (Ajustado para 'Usuário')
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url, role, permissions, updated_at)
        VALUES (
            new.id,
            new.email,
            COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
            new.raw_user_meta_data->>'avatar_url',
            'Usuário', -- <== CORREÇÃO CRÍTICA: Respeita constraint
            '{}'::jsonb,
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();
        RETURN new;
    END;
    $trigger$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Reiniciar o trigger
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- 3. BACKFILL: CORRIGIR USUÁRIOS EXISTENTES SEM PERFIL
    INSERT INTO public.profiles (id, email, role, permissions, updated_at, full_name)
    SELECT 
        id, 
        email, 
        'Usuário', -- <== CORREÇÃO CRÍTICA
        '{}'::jsonb, 
        created_at,
        COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles);

    -- 4. PROMOVER SEU USUÁRIO A ADMIN (Respeitando 'Admin')
    UPDATE public.profiles
    SET 
        role = 'Admin', -- <== CORREÇÃO CRÍTICA (Maiúscula)
        permissions = '{
            "financial_view": true, 
            "approve_purchases": true, 
            "manage_users": true, 
            "delete_records": true,
            "view_reports": true
        }'::jsonb
    WHERE email ILIKE '%devgpesc@gmail.com%' OR email ILIKE '%admin%';

    -- 5. REVISÃO DE POLÍTICAS RLS (Garantir acesso)
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Profiles are viewable by users" ON public.profiles;
    CREATE POLICY "Profiles are viewable by users" ON public.profiles
        FOR SELECT USING (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = id);
    
    -- Política para Admin poder editar qualquer usuário
    DROP POLICY IF EXISTS "Admins can update all" ON public.profiles;
    CREATE POLICY "Admins can update all" ON public.profiles
        FOR UPDATE USING (
            exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'Admin' -- <== Ajustado
            )
        );

END $$;

-- Recarrega configurações
NOTIFY pgrst, 'reload config';
