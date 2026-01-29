
-- SCRIPT DE EMERGÊNCIA - CORREÇÃO DE ERRO "CAMPO OBRIGATÓRIO VAZIO"
-- Executar no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. Tenta renomear a coluna antiga se ela existir e a nova não
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateId') 
       AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associate_id') THEN
        ALTER TABLE public.vehicles RENAME COLUMN "associateId" TO associate_id;
    END IF;

    -- 2. Se a coluna associate_id não existir (caso o rename falhe ou não tenha antiga), cria ela
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associate_id') THEN
        ALTER TABLE public.vehicles ADD COLUMN associate_id uuid REFERENCES public.associates(id) ON DELETE SET NULL;
    END IF;

    -- 3. REMOVER OBRIGATORIEDADE DE TODOS OS CAMPOS (EXCETO PLACA)
    -- Isso previne o erro "null value in column violates not-null constraint"
    
    -- Para coluna antiga (se ainda existir)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associateId') THEN
        ALTER TABLE public.vehicles ALTER COLUMN "associateId" DROP NOT NULL;
    END IF;

    -- Para coluna nova
    ALTER TABLE public.vehicles ALTER COLUMN associate_id DROP NOT NULL;

    -- Para outros campos que podem estar causando o erro
    ALTER TABLE public.vehicles ALTER COLUMN renavam DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN chassi DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN brand DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN model DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN color DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN "yearFab" DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN "yearModel" DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN year_fab DROP NOT NULL;
    ALTER TABLE public.vehicles ALTER COLUMN year_model DROP NOT NULL;

END $$;

-- 4. Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
