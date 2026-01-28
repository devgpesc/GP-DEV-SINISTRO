
-- CORREÇÃO DEFINITIVA DE COLUNAS DE VEÍCULOS
-- Executar no SQL Editor do Supabase

-- 1. Renomear colunas CamelCase para snake_case (Padrão Supabase)
DO $$
BEGIN
  -- Renomear associateId -> associate_id
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateId') THEN
    ALTER TABLE public.vehicles RENAME COLUMN "associateId" TO associate_id;
  END IF;

  -- Renomear yearFab -> year_fab
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearFab') THEN
    ALTER TABLE public.vehicles RENAME COLUMN "yearFab" TO year_fab;
  END IF;

  -- Renomear yearModel -> year_model
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearModel') THEN
    ALTER TABLE public.vehicles RENAME COLUMN "yearModel" TO year_model;
  END IF;
END $$;

-- 2. Garantir que Renavam e Chassi NÃO sejam obrigatórios
ALTER TABLE public.vehicles ALTER COLUMN renavam DROP NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN chassi DROP NOT NULL;

-- 3. Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
