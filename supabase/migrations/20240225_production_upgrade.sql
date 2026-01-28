
-- 1. TABELA DE FORNECEDORES (Substituindo LocalStorage)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    cnpj text UNIQUE NOT NULL,
    segment text,
    whatsapp text,
    email text,
    city text,
    address text,
    status text DEFAULT 'Ativo',
    rating numeric DEFAULT 5,
    "contactName" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE ORDENS DE SERVIÇO (OS) - Vinculada ao Evento
CREATE TABLE IF NOT EXISTS public.service_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    code text NOT NULL, -- Ex: OS-2024-001
    status text DEFAULT 'Aberta', -- Aberta, Em Andamento, Concluída
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE TRANSAÇÕES FINANCEIRAS
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_id uuid NOT NULL, -- ID da OS ou do Evento
    reference_type text NOT NULL, -- 'OS' ou 'EVENTO'
    type text NOT NULL, -- 'Receita' (Franquia) ou 'Despesa' (Peças)
    description text,
    amount numeric DEFAULT 0,
    status text DEFAULT 'Previsto', -- Previsto, Realizado
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. HABILITAR RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for auth users" ON public.suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for auth users" ON public.service_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for auth users" ON public.financial_transactions FOR ALL USING (auth.role() = 'authenticated');

-- 5. AUTOMAÇÃO (TRIGGER): EVENTO -> OS -> FINANCEIRO
CREATE OR REPLACE FUNCTION public.handle_new_event()
RETURNS TRIGGER AS $$
DECLARE
    new_os_code text;
    event_count int;
BEGIN
    -- Gerar código da OS (Ex: OS-2024-0001)
    SELECT count(*) INTO event_count FROM public.events;
    new_os_code := 'OS-' || to_char(now(), 'YYYY') || '-' || lpad((event_count + 1)::text, 4, '0');

    -- 1. Criar Ordem de Serviço Automática
    INSERT INTO public.service_orders (event_id, code, status)
    VALUES (NEW.id, new_os_code, 'Aberta');

    -- 2. Criar Previsão Financeira (Ex: Custo administrativo inicial)
    INSERT INTO public.financial_transactions (reference_id, reference_type, type, description, amount, status)
    VALUES (NEW.id, 'EVENTO', 'Despesa', 'Abertura de Sinistro - Taxa Adm', 0.00, 'Previsto');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparado APÓS inserir um evento
DROP TRIGGER IF EXISTS on_event_created ON public.events;
CREATE TRIGGER on_event_created
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_event();
