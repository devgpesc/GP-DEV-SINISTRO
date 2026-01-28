
-- LIMPEZA E PADRONIZAÇÃO DE COLUNAS DE VEÍCULOS
-- Executar no SQL Editor do Supabase

DO $$
BEGIN
  -- 1. Garantir que as colunas snake_case existam
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'associate_id') THEN
    ALTER TABLE public.vehicles ADD COLUMN associate_id uuid REFERENCES public.associates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'year_fab') THEN
    ALTER TABLE public.vehicles ADD COLUMN year_fab text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'year_model') THEN
    ALTER TABLE public.vehicles ADD COLUMN year_model text;
  END IF;

  -- 2. Migrar dados de legacy (camelCase) para snake_case se ainda existirem e estiverem vazios
  -- (Esta parte é opcional e depende se há dados para migrar, aqui apenas garantimos que associate_id tenha valor)
  -- UPDATE public.vehicles SET associate_id = "associateId" WHERE associate_id IS NULL AND "associateId" IS NOT NULL;

  -- 3. Relaxar restrições NOT NULL para evitar erros durante a transição
  ALTER TABLE public.vehicles ALTER COLUMN renavam DROP NOT NULL;
  ALTER TABLE public.vehicles ALTER COLUMN chassi DROP NOT NULL;
  ALTER TABLE public.vehicles ALTER COLUMN associate_id DROP NOT NULL; 
  -- (A validação de associate_id obrigatório deve ser feita no Frontend)

END $$;

-- 4. Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
