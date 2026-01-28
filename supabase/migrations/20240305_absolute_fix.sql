
-- SCRIPT DE CORREÇÃO ABSOLUTA - VEÍCULOS (V2)
DO $$
BEGIN
    -- 1. Garante colunas snake_case
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS associate_id uuid REFERENCES public.associates(id) ON DELETE SET NULL;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year_fab text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year_model text;
    
    -- 2. Relaxa constraints em TUDO que pode dar erro
    -- Colunas padrão snake_case
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

    -- 3. Colunas LEGACY (CamelCase) - Onde o bicho pega
    -- Verifica versão com aspas (Case Sensitive)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateId') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "associateId" DROP NOT NULL;
    END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearFab') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "yearFab" DROP NOT NULL;
    END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'yearModel') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "yearModel" DROP NOT NULL;
    END IF;

    -- Verifica versão lowercase (se foi criado sem aspas, mas com nome camelCase na cabeça do dev)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateid') THEN
        ALTER TABLE public.vehicles ALTER COLUMN associateid DROP NOT NULL;
    END IF;

END $$;

-- 4. Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
