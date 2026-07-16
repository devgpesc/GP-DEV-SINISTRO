-- Suporte a servicos (mao de obra) nos itens de cotacao
BEGIN;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'Peça';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'quotation_items_item_type_check'
       AND conrelid = 'public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_item_type_check
      CHECK (item_type IN ('Peça', 'Serviço'));
  END IF;
END $$;

-- Itens do catalogo de servico herdam o tipo
UPDATE public.quotation_items qi
   SET item_type = 'Serviço'
  FROM public.catalog_items ci
 WHERE qi.catalog_item_id = ci.id
   AND ci.type = 'Serviço'
   AND qi.item_type = 'Peça';

COMMIT;
