
-- CRIAÇÃO DA TABELA DE VEÍCULOS
-- Executar no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Campos de Identificação
    plate text NOT NULL UNIQUE,
    "associateId" uuid REFERENCES public.associates(id) ON DELETE SET NULL,
    
    -- Campos Técnicos
    brand text,
    model text,
    version text,
    "yearFab" text,
    "yearModel" text,
    color text,
    fuel text,
    type text,
    chassi text,
    renavam text,
    uf text,
    city text,
    
    -- Campos de Gestão
    status text DEFAULT 'Ativo',
    km numeric DEFAULT 0,
    notes text
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_associate ON public.vehicles("associateId");

-- Habilitar Segurança (RLS)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Permitir tudo para usuários autenticados por enquanto)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.vehicles;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.vehicles;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.vehicles;

CREATE POLICY "Enable read access for all users" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.vehicles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.vehicles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.vehicles FOR DELETE USING (auth.role() = 'authenticated');
