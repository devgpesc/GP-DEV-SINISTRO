
-- Tabela de Histórico de Avaliações
CREATE TABLE IF NOT EXISTS public.supplier_reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.supplier_reviews ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Auth Users Read Reviews" ON public.supplier_reviews FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Insert Reviews" ON public.supplier_reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Delete Reviews" ON public.supplier_reviews FOR DELETE USING (auth.role() = 'authenticated');

-- Recarregar schema
NOTIFY pgrst, 'reload config';
