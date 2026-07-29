-- Corrige duplicacao de itens na matriz de cotacao:
-- 1) Permite DELETE via RLS (editar cotacao falhava silenciosamente e reinseria tudo)
-- 2) Remove duplicatas existentes (mesmo nome/tipo na mesma cotacao), preservando itens com OC

BEGIN;

-- RLS: DELETE em quotation_items e quotation_suppliers
DROP POLICY IF EXISTS "Auth Delete Items" ON public.quotation_items;
CREATE POLICY "Auth Delete Items"
  ON public.quotation_items
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Delete QS" ON public.quotation_suppliers;
CREATE POLICY "Auth Delete QS"
  ON public.quotation_suppliers
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Limpeza: remove copias sem OC quando ja existe outra linha equivalente na mesma cotacao
WITH ranked AS (
  SELECT
    qi.id,
    EXISTS (
      SELECT 1
        FROM public.purchase_order_items poi
       WHERE poi.quotation_item_id = qi.id
    ) AS has_po,
    ROW_NUMBER() OVER (
      PARTITION BY
        qi.quotation_id,
        lower(trim(qi.name)),
        COALESCE(qi.item_type, 'Peça')
      ORDER BY
        EXISTS (
          SELECT 1
            FROM public.purchase_order_items poi
           WHERE poi.quotation_item_id = qi.id
        ) DESC,
        qi.created_at ASC,
        qi.id ASC
    ) AS rn
  FROM public.quotation_items qi
),
to_remove AS (
  SELECT id
    FROM ranked
   WHERE rn > 1
     AND NOT has_po
)
DELETE FROM public.quotation_supplier_prices qsp
 WHERE qsp.quotation_item_id IN (SELECT id FROM to_remove);

WITH ranked AS (
  SELECT
    qi.id,
    EXISTS (
      SELECT 1
        FROM public.purchase_order_items poi
       WHERE poi.quotation_item_id = qi.id
    ) AS has_po,
    ROW_NUMBER() OVER (
      PARTITION BY
        qi.quotation_id,
        lower(trim(qi.name)),
        COALESCE(qi.item_type, 'Peça')
      ORDER BY
        EXISTS (
          SELECT 1
            FROM public.purchase_order_items poi
           WHERE poi.quotation_item_id = qi.id
        ) DESC,
        qi.created_at ASC,
        qi.id ASC
    ) AS rn
  FROM public.quotation_items qi
)
DELETE FROM public.quotation_items qi
 USING ranked r
 WHERE qi.id = r.id
   AND r.rn > 1
   AND NOT r.has_po;

COMMIT;
