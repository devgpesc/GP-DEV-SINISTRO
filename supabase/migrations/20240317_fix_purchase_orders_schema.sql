
-- MIGRATION: FIX PURCHASE ORDERS SCHEMA (Emergency Fix)
-- Data: 2024-03-17
-- Objetivo: Garantir que a tabela purchase_orders tenha as colunas created_by e quotation_id para o fluxo de aprovação.

DO $$
BEGIN
    -- 1. Adicionar created_by se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'created_by') THEN
        ALTER TABLE public.purchase_orders 
        ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- 2. Adicionar quotation_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'quotation_id') THEN
        ALTER TABLE public.purchase_orders 
        ADD COLUMN quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL;
    END IF;

    -- 3. Garantir defaults e constraints
    ALTER TABLE public.purchase_orders ALTER COLUMN status SET DEFAULT 'Gerada';
    ALTER TABLE public.purchase_orders ALTER COLUMN total SET DEFAULT 0;
    
    -- 4. Criar índices para performance (Opcional, mas recomendado)
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON public.purchase_orders(created_by);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_quotation_id ON public.purchase_orders(quotation_id);

END $$;

-- Forçar recarregamento do cache de schema da API
NOTIFY pgrst, 'reload config';
