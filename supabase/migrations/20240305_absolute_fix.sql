
-- SCRIPT DE CORREÇÃO ABSOLUTA - VEÍCULOS (V3 - Final)
DO $$
BEGIN
    -- 1. Garante colunas snake_case modernas
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS associate_id uuid REFERENCES public.associates(id) ON DELETE SET NULL;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year_fab text;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year_model text;
    
    -- 2. Relaxa constraints em colunas PADRÃO
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

    -- 3. Relaxa constraints em colunas LEGADO (CamelCase)
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

    -- 4. CORREÇÃO ESPECÍFICA DO ERRO "year"
    -- Algumas bases legadas têm uma coluna genérica chamada 'year' que está como NOT NULL
    -- Se ela não existir, criamos e deixamos anulável para evitar erros de select *
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'year') THEN
        ALTER TABLE public.vehicles ADD COLUMN "year" text;
    END IF;
    
    -- Agora removemos a obrigatoriedade com certeza
    ALTER TABLE public.vehicles ALTER COLUMN "year" DROP NOT NULL;

    -- 5. Outras variações lowercase
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateid') THEN
        ALTER TABLE public.vehicles ALTER COLUMN associateid DROP NOT NULL;
    END IF;

END $$;

-- Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
