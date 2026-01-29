
-- MIGRATION: PURCHASE ORDER ITEMS (RELATIONAL MODEL)
-- Data: 2024-03-19
-- Objetivo: Normalizar os itens da OC, removendo a dependência de JSONB na tabela pai.

-- 1. Criar tabela relacional de itens
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    quotation_item_id uuid REFERENCES public.quotation_items(id) ON DELETE SET NULL,
    catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
    
    name text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit text DEFAULT 'UN',
    unit_price numeric NOT NULL DEFAULT 0,
    total_price numeric NOT NULL DEFAULT 0,
    
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar RLS (Segurança)
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
-- Leitura: Usuários autenticados podem ver itens
CREATE POLICY "Auth Users Read PO Items" 
ON public.purchase_order_items FOR SELECT 
USING (auth.role() = 'authenticated');

-- Escrita: Usuários autenticados podem inserir itens
CREATE POLICY "Auth Users Insert PO Items" 
ON public.purchase_order_items FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Edição/Exclusão
CREATE POLICY "Auth Users Update PO Items" 
ON public.purchase_order_items FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Auth Users Delete PO Items" 
ON public.purchase_order_items FOR DELETE 
USING (auth.role() = 'authenticated');

-- 4. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_po_items_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_catalog_id ON public.purchase_order_items(catalog_item_id);

-- 5. Limpeza opcional (Remove coluna items da tabela pai se existir e estiver causando confusão)
-- DO $$ 
-- BEGIN
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'items') THEN
--         ALTER TABLE public.purchase_orders DROP COLUMN items;
--     END IF;
-- END $$;

-- Recarregar schema
NOTIFY pgrst, 'reload config';
