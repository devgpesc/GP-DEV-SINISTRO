
-- SCRIPT DE CORREÇÃO ABSOLUTA - VEÍCULOS
-- Executar no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. Garante que as colunas existam (evita erro se tabela for antiga)
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS associate_id uuid REFERENCES public.associates(id) ON DELETE SET NULL;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS type text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fuel text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS version text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS uf text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS city text;
    
    -- 2. REMOVE OBRIGATORIEDADE DE TUDO (Exceto ID e Placa)
    ALTER TABLE public.vehicles ALTER COLUMN associate_id DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN renavam DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN chassi DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN type DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN fuel DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN brand DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN model DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN color DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN year_fab DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN year_model DROP NOT NULL;
    
    -- Se colunas antigas (CamelCase) existirem, também relaxa a restrição
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateId') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "associateId" DROP NOT NULL;
    END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearFab') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "yearFab" DROP NOT NULL;
    END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearModel') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "yearModel" DROP NOT NULL;
    END IF;

END $$;

-- 3. Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
