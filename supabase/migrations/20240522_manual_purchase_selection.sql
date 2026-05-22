-- Manual purchase decision layer for the quotation matrix.
-- Keeps the existing KompraX tables and adds explicit human decisions.

ALTER TABLE public.quotation_supplier_prices
ADD COLUMN IF NOT EXISTS delivery_days integer;

CREATE TABLE IF NOT EXISTS public.quotation_purchase_selections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    quotation_item_id uuid REFERENCES public.quotation_items(id) ON DELETE CASCADE NOT NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL NOT NULL,
    selected_price numeric NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    justification text,
    status text NOT NULL DEFAULT 'Selecionado',
    selected_by uuid REFERENCES auth.users(id),
    selected_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (quotation_id, quotation_item_id)
);

CREATE TABLE IF NOT EXISTS public.quotation_decision_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quotation_purchase_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_decision_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth Users Manage Quotation Purchase Selections" ON public.quotation_purchase_selections;
CREATE POLICY "Auth Users Manage Quotation Purchase Selections"
ON public.quotation_purchase_selections
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Users Read Quotation Decision History" ON public.quotation_decision_history;
CREATE POLICY "Auth Users Read Quotation Decision History"
ON public.quotation_decision_history
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Users Insert Quotation Decision History" ON public.quotation_decision_history;
CREATE POLICY "Auth Users Insert Quotation Decision History"
ON public.quotation_decision_history
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_qps_quotation ON public.quotation_purchase_selections(quotation_id);
CREATE INDEX IF NOT EXISTS idx_qps_item ON public.quotation_purchase_selections(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_qdh_quotation ON public.quotation_decision_history(quotation_id);

NOTIFY pgrst, 'reload config';
