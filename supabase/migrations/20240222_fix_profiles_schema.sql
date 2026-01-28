
-- CORREÇÃO DA TABELA PROFILES (Versão Atualizada)
-- Executar no SQL Editor do Supabase para corrigir erros de colunas faltantes (avatar_url, role, updated_at)

-- 1. Garante que a tabela existe com a estrutura básica
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  website text,
  email text,
  role text DEFAULT 'user'::text
);

-- 2. Adiciona colunas individualmente caso a tabela já exista mas as colunas não
DO $$ 
BEGIN 
  -- Adiciona updated_at (Correção do erro atual)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN 
    ALTER TABLE public.profiles ADD COLUMN updated_at timestamp with time zone DEFAULT now(); 
  END IF;

  -- Adiciona avatar_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN 
    ALTER TABLE public.profiles ADD COLUMN avatar_url text; 
  END IF;

  -- Adiciona role
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN 
    ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user'; 
  END IF;

  -- Adiciona full_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN 
    ALTER TABLE public.profiles ADD COLUMN full_name text; 
  END IF;
    
  -- Adiciona email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN 
    ALTER TABLE public.profiles ADD COLUMN email text; 
  END IF;
END $$;

-- 3. Habilita RLS (Row Level Security) e define Políticas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar duplicidade/conflito
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Cria novas políticas
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Gatilho para criar perfil automaticamente no cadastro (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, role, updated_at)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    new.email, 
    'user',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
