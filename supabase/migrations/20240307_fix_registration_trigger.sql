
-- SOLUÇÃO DEFINITIVA PARA ERRO DE CADASTRO (Database error saving new user)
-- Execute este script no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. CORREÇÃO DE COLUNA: Relaxar restrição da coluna 'name' (caso exista)
    -- Isso impede que o banco rejeite o cadastro se o campo 'name' não for enviado
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
        ALTER TABLE public.profiles ALTER COLUMN "name" DROP NOT NULL;
    END IF;
END $$;

-- 2. RECRIAR TRIGGER COM LÓGICA BLINDADA (SQL DINÂMICO)
-- Esta função funciona independente se a coluna 'name' existe ou não, e se 'full_name' existe ou não.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
BEGIN
  -- Obtém o nome de várias fontes possíveis (Metadados ou Email)
  v_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- Tenta inserir usando SQL Dinâmico para se adaptar à estrutura atual da tabela
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
      -- Se a coluna 'name' (legado) existir, preenchemos ela também para manter compatibilidade
      EXECUTE format('
          INSERT INTO public.profiles (id, full_name, name, avatar_url, email, role, updated_at)
          VALUES ($1, $2, $2, $3, $4, ''user'', now())
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, name = EXCLUDED.name, email = EXCLUDED.email
      ') USING new.id, v_name, new.raw_user_meta_data->>'avatar_url', new.email;
  ELSE
      -- Se for a estrutura nova (apenas full_name), inserimos normal
      INSERT INTO public.profiles (id, full_name, avatar_url, email, role, updated_at)
      VALUES (
        new.id, 
        v_name, 
        new.raw_user_meta_data->>'avatar_url', 
        new.email, 
        'user',
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECONECTAR O GATILHO
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Confirmação visual
NOTIFY pgrst, 'reload config';
