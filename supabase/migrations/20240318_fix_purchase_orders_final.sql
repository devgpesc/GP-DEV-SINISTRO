
-- MIGRATION: FIX PURCHASE ORDERS (FINAL)
-- Objetivo: Garantir que OCs possam ser criadas e visualizadas por usuários autenticados.

-- 1. Garantir colunas obrigatórias com nomes corretos (snake_case)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL,
    event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Gerada',
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. RESETAR POLÍTICAS DE SEGURANÇA (RLS)
-- Muitas vezes o INSERT falha silenciosamente se a política não for explícita
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.purchase_orders;
DROP POLICY IF EXISTS "Auth Users Read All Orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Auth Users Insert Orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Auth Users Update Orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Auth Users Delete Orders" ON public.purchase_orders;

-- Cria uma política unificada e permissiva para usuários logados
CREATE POLICY "Allow all for authenticated"
ON public.purchase_orders
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. GARANTIR INTEGRIDADE DE DADOS
-- Se quotation_items não tiver catalog_item_id, adiciona para garantir rastreabilidade
ALTER TABLE public.quotation_items 
ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

-- 4. ÍNDICES PARA PERFORMANCE NA TELA DE COMPRAS
CREATE INDEX IF NOT EXISTS idx_po_created_by ON public.purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_po_quotation ON public.purchase_orders(quotation_id);

NOTIFY pgrst, 'reload config';
