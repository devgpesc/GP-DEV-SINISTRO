
-- CORREÇÃO DEFINITIVA: PURCHASE ORDERS
-- Execute no SQL Editor do Supabase

-- 1. Recriar tabela com nomes de colunas padronizados (snake_case)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL,
    event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Gerada', -- Gerada, Aprovada, Enviada, Cancelada, Recebida
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. Migração de dados legados (se houver colunas antigas camelCase)
DO $$
BEGIN
    -- Se existir eventId e não event_id, renomear
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'eventId') THEN
        ALTER TABLE public.purchase_orders RENAME COLUMN "eventId" TO event_id;
    END IF;
    
    -- Se existir supplierId e não supplier_id, renomear
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierId') THEN
        ALTER TABLE public.purchase_orders RENAME COLUMN "supplierId" TO supplier_id;
    END IF;

    -- Se existir createdAt e não created_at, renomear
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'createdAt') THEN
        ALTER TABLE public.purchase_orders RENAME COLUMN "createdAt" TO created_at;
    END IF;
END $$;

-- 3. Habilitar RLS e Criar Políticas
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Enable read access for all users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.purchase_orders;

-- Política de Leitura: Usuários autenticados podem ver todas as OCs (Necessário para Admin/Gerente ver OCs criadas por outros)
CREATE POLICY "Auth Users Read All Orders" 
ON public.purchase_orders FOR SELECT 
USING (auth.role() = 'authenticated');

-- Política de Escrita: Usuários autenticados podem criar
CREATE POLICY "Auth Users Insert Orders" 
ON public.purchase_orders FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Política de Edição: Usuários autenticados podem atualizar (status, etc)
CREATE POLICY "Auth Users Update Orders" 
ON public.purchase_orders FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Política de Exclusão: Usuários autenticados podem deletar
CREATE POLICY "Auth Users Delete Orders" 
ON public.purchase_orders FOR DELETE 
USING (auth.role() = 'authenticated');

-- 4. Criar índices para performance na listagem
CREATE INDEX IF NOT EXISTS idx_po_created_at ON public.purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);

NOTIFY pgrst, 'reload config';
