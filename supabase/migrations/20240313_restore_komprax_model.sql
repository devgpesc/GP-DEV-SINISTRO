
-- MIGRATION: RESTORE KOMPRAX MODEL (Matriz Inteligente)
-- Data: 2024-03-13

-- 1. TABELA DE ITENS DA COTAÇÃO (Granularidade)
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    category text,
    quantity numeric DEFAULT 1,
    unit text DEFAULT 'UN',
    target_price numeric, -- Preço alvo/referência
    status text DEFAULT 'Pendente', -- Pendente, Cotado, Comprado, Cancelado
    created_at timestamp with time zone DEFAULT now()
);

-- 2. TABELA DE PREÇOS (Matriz Cruzada)
-- Armazena o preço que CADA fornecedor deu para CADA item
CREATE TABLE IF NOT EXISTS public.quotation_supplier_prices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_item_id uuid REFERENCES public.quotation_items(id) ON DELETE CASCADE NOT NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    price numeric NOT NULL,
    availability boolean DEFAULT true,
    obs text,
    is_winner boolean DEFAULT false, -- Se este preço foi o escolhido
    created_at timestamp with time zone DEFAULT now(),
    
    -- Garante que um fornecedor só tenha um preço por item
    UNIQUE(quotation_item_id, supplier_id)
);

-- 3. VÍNCULO COTAÇÃO <-> FORNECEDORES CONVIDADOS
CREATE TABLE IF NOT EXISTS public.quotation_suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'Aguardando', -- Aguardando, Respondido, Recusado
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(quotation_id, supplier_id)
);

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth Read Items" ON public.quotation_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Insert Items" ON public.quotation_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Items" ON public.quotation_items FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth Read Prices" ON public.quotation_supplier_prices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Insert Prices" ON public.quotation_supplier_prices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Prices" ON public.quotation_supplier_prices FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth Read QS" ON public.quotation_suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Insert QS" ON public.quotation_suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Recarregar schema
NOTIFY pgrst, 'reload config';
