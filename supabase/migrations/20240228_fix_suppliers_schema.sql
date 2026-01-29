
-- CORREÇÃO DEFINITIVA TABELA FORNECEDORES
-- Executar no SQL Editor do Supabase

-- 1. Tentar renomear colunas antigas (camelCase -> snake_case) se existirem
DO $$
BEGIN
  -- Corrige contactName para contact_name
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contactName') THEN
    ALTER TABLE suppliers RENAME COLUMN "contactName" TO contact_name;
  END IF;
  
  -- Corrige createdAt para created_at
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'createdAt') THEN
    ALTER TABLE suppliers RENAME COLUMN "createdAt" TO created_at;
  END IF;
END $$;

-- 2. Garantir que todas as colunas necessárias existem
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 3. Recarregar cache de esquema do Supabase (Essencial para o erro sumir)
NOTIFY pgrst, 'reload config';
