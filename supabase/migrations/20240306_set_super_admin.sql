
-- SCRIPT DE PROMOÇÃO DE ADMIN E CORREÇÃO DE PERFIL
-- Execute este script no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. CORREÇÃO DE CONSTRAINT: Remove a obrigatoriedade da coluna 'name' na tabela profiles
    -- Isso resolve o erro "null value in column 'name' violates not-null constraint"
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
        ALTER TABLE public.profiles ALTER COLUMN "name" DROP NOT NULL;
    END IF;

    -- 2. ATUALIZAÇÃO DE SUPER ADMIN
    -- Define o email devgpesc@gmail.com como 'super_admin'
    UPDATE public.profiles
    SET role = 'super_admin'
    WHERE email = 'devgpesc@gmail.com';

END $$;

-- Recarrega o cache para aplicar mudanças
NOTIFY pgrst, 'reload config';
