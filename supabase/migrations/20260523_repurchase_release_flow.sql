-- Fluxo de liberação de recompra por item já processado
-- Permite registrar motivo e liberar item para nova compra sem perder histórico.

CREATE TABLE IF NOT EXISTS public.quotation_item_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    quotation_item_id uuid NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'released',
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_qir_quote_item UNIQUE (quotation_id, quotation_item_id)
);

ALTER TABLE public.quotation_item_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth Users Manage Quotation Item Releases" ON public.quotation_item_releases;
CREATE POLICY "Auth Users Manage Quotation Item Releases"
ON public.quotation_item_releases
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qir_quotation ON public.quotation_item_releases(quotation_id);
CREATE INDEX IF NOT EXISTS idx_qir_item ON public.quotation_item_releases(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_qir_status ON public.quotation_item_releases(status);

