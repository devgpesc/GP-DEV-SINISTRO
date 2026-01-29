
-- Executar no SQL Editor do Supabase

-- 1. Cria a tabela saas_settings se não existir (para garantir)
CREATE TABLE IF NOT EXISTS public.saas_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text,
  cnpj text,
  address text,
  email text,
  phone text,
  updated_at timestamp with time zone,
  -- Novas colunas
  logo_url text,
  apibrasil_token text,
  detran_key text,
  openai_key text,
  gemini_key text,
  anthropic_key text,
  groq_key text
);

-- 2. Habilita RLS
ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas (Permissiva para teste, ajustar em prod)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.saas_settings;
DROP POLICY IF EXISTS "Enable insert/update for all users" ON public.saas_settings;

CREATE POLICY "Enable read access for all users" ON public.saas_settings FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for all users" ON public.saas_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. Adiciona colunas se a tabela já existir sem elas
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'logo_url') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN logo_url text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'apibrasil_token') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN apibrasil_token text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'detran_key') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN detran_key text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'openai_key') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN openai_key text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'gemini_key') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN gemini_key text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'anthropic_key') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN anthropic_key text; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'groq_key') THEN 
    ALTER TABLE public.saas_settings ADD COLUMN groq_key text; 
  END IF;
END $$;
