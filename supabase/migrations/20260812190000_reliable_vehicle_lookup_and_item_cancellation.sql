BEGIN;

-- Remove somente a assinatura exata usada pelo antigo retorno ficticio do cadastro rapido.
UPDATE public.vehicles
   SET brand = NULL,
       model = NULL,
       year_fab = NULL,
       year_model = NULL,
       color = NULL,
       fuel = NULL
 WHERE upper(coalesce(brand, '')) = 'TOYOTA'
   AND upper(coalesce(model, '')) = 'COROLLA XEI'
   AND upper(coalesce(color, '')) = 'BRANCA'
   AND upper(coalesce(fuel, '')) = 'FLEX'
   AND year_fab::text = extract(year FROM created_at)::integer::text
   AND year_model::text = extract(year FROM created_at)::integer::text;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Ativo',
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_order_status
  ON public.purchase_order_items(purchase_order_id, status);

CREATE OR REPLACE FUNCTION public.record_purchase_order_financial_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reversal_kind text;
BEGIN
  IF NEW.status NOT IN ('Cancelada', 'Devolvida') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  reversal_kind := CASE WHEN NEW.status = 'Devolvida' THEN 'devolucao' ELSE 'cancelamento' END;
  NEW.reversed_amount := CASE
    WHEN OLD.status IN ('Cancelada', 'Devolvida') THEN coalesce(NEW.reversed_amount, OLD.reversed_amount, 0)
    ELSE greatest(
      coalesce(NEW.reversed_amount, 0),
      coalesce(OLD.reversed_amount, 0) + coalesce(OLD.total, 0)
    )
  END;
  NEW.reversed_at := coalesce(NEW.reversed_at, now());
  NEW.reversal_type := reversal_kind;

  INSERT INTO public.purchase_order_reversals (
    purchase_order_id, tenant_id, reversal_type, amount, reason, created_by, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.tenant_id, reversal_kind, NEW.reversed_amount, NEW.cancellation_reason, auth.uid(), now(), now()
  )
  ON CONFLICT (purchase_order_id)
  DO UPDATE SET
    reversal_type = EXCLUDED.reversal_type,
    amount = EXCLUDED.amount,
    reason = coalesce(EXCLUDED.reason, public.purchase_order_reversals.reason),
    created_by = EXCLUDED.created_by,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_purchase_order_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_approve boolean;
  can_delete boolean;
  item_cancellation boolean := coalesce(current_setting('app.purchase_item_cancellation', true), '') = 'on';
  auto_authorization boolean := coalesce(current_setting('app.purchase_auto_authorization', true), '') = 'on';
BEGIN
  can_approve := public.user_has_permission('approve_purchases');
  can_delete := public.user_has_permission('delete_records');

  IF TG_OP = 'DELETE' THEN
    IF NOT can_delete THEN
      RAISE EXCEPTION 'Permissão negada para excluir ordem de compra.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'Aprovada'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NOT can_approve
       AND NOT auto_authorization THEN
      RAISE EXCEPTION 'Permissão negada para aprovar ordem de compra.';
    END IF;

    IF NEW.status IN ('Cancelada', 'Devolvida')
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NOT can_approve
       AND NOT item_cancellation THEN
      RAISE EXCEPTION 'Permissão negada para cancelar ou devolver ordem de compra.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order_item(
  p_purchase_order_item_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  item_row public.purchase_order_items%ROWTYPE;
  order_row public.purchase_orders%ROWTYPE;
  cancel_reason text := btrim(coalesce(p_reason, ''));
  cancelled_amount numeric(14,2);
  remaining_total numeric(14,2);
  remaining_count integer;
  cumulative_reversal numeric(14,2);
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF length(cancel_reason) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento da peça ou serviço.';
  END IF;

  SELECT * INTO item_row
    FROM public.purchase_order_items
   WHERE id = p_purchase_order_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da ordem de compra não encontrado.';
  END IF;

  SELECT * INTO order_row
    FROM public.purchase_orders
   WHERE id = item_row.purchase_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de compra não encontrada.';
  END IF;

  IF NOT public.is_platform_super_admin(actor)
     AND order_row.tenant_id NOT IN (SELECT public.get_my_tenant_ids()) THEN
    RAISE EXCEPTION 'Acesso negado para esta empresa.';
  END IF;

  IF order_row.status IN ('Cancelada', 'Devolvida', 'Recebida') THEN
    RAISE EXCEPTION 'Este item não pode ser cancelado no status atual da compra.';
  END IF;

  IF item_row.status = 'Cancelado' THEN
    RETURN jsonb_build_object(
      'orderId', order_row.id,
      'itemId', item_row.id,
      'reversedAmount', coalesce(item_row.total_price, 0),
      'remainingTotal', coalesce(order_row.total, 0),
      'alreadyProcessed', true
    );
  END IF;

  cancelled_amount := coalesce(item_row.total_price, 0);

  UPDATE public.purchase_order_items
     SET status = 'Cancelado',
         cancellation_reason = cancel_reason,
         cancelled_at = now(),
         cancelled_by = actor
   WHERE id = item_row.id;

  SELECT coalesce(sum(total_price), 0), count(*)
    INTO remaining_total, remaining_count
    FROM public.purchase_order_items
   WHERE purchase_order_id = order_row.id
     AND status <> 'Cancelado';

  cumulative_reversal := coalesce(order_row.reversed_amount, 0) + cancelled_amount;
  PERFORM set_config('app.purchase_item_cancellation', 'on', true);

  UPDATE public.purchase_orders
     SET total = remaining_total,
         status = CASE WHEN remaining_count = 0 THEN 'Cancelada' ELSE status END,
         cancellation_reason = CASE WHEN remaining_count = 0 THEN cancel_reason ELSE cancellation_reason END,
         reversed_amount = cumulative_reversal,
         reversed_at = now(),
         reversal_type = 'cancelamento'
   WHERE id = order_row.id;

  INSERT INTO public.purchase_order_reversals (
    purchase_order_id, tenant_id, reversal_type, amount, reason, created_by, created_at, updated_at
  ) VALUES (
    order_row.id, order_row.tenant_id, 'cancelamento', cumulative_reversal, cancel_reason, actor, now(), now()
  )
  ON CONFLICT (purchase_order_id)
  DO UPDATE SET
    reversal_type = 'cancelamento',
    amount = cumulative_reversal,
    reason = cancel_reason,
    created_by = actor,
    updated_at = now();

  IF order_row.quotation_id IS NOT NULL AND item_row.quotation_item_id IS NOT NULL THEN
    INSERT INTO public.quotation_item_releases (
      quotation_id, quotation_item_id, reason, status, created_by, created_at, updated_at
    ) VALUES (
      order_row.quotation_id, item_row.quotation_item_id, cancel_reason, 'released', actor, now(), now()
    )
    ON CONFLICT (quotation_id, quotation_item_id)
    DO UPDATE SET reason = EXCLUDED.reason, status = 'released', created_by = actor, updated_at = now();

    UPDATE public.quotation_purchase_selections
       SET status = 'Cancelado', updated_at = now()
     WHERE quotation_id = order_row.quotation_id
       AND quotation_item_id = item_row.quotation_item_id;

    UPDATE public.quotations
       SET status = 'Compra Autorizada', updated_at = now()
     WHERE id = order_row.quotation_id;
  END IF;

  IF order_row.event_id IS NOT NULL THEN
    UPDATE public.events SET status = 'Em Cotação', updated_at = now() WHERE id = order_row.event_id;
  END IF;

  INSERT INTO public.purchase_order_history (
    purchase_order_id, tenant_id, action, comment, details, user_id, created_at
  ) VALUES (
    order_row.id,
    order_row.tenant_id,
    'item_cancelled',
    cancel_reason,
    jsonb_build_object(
      'item_id', item_row.id,
      'quotation_item_id', item_row.quotation_item_id,
      'item_name', item_row.name,
      'reversed_amount', cancelled_amount,
      'remaining_total', remaining_total
    ),
    actor,
    now()
  );

  RETURN jsonb_build_object(
    'orderId', order_row.id,
    'itemId', item_row.id,
    'itemName', item_row.name,
    'reversedAmount', cancelled_amount,
    'remainingTotal', remaining_total,
    'orderCancelled', remaining_count = 0,
    'alreadyProcessed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_purchase_order_item(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_order_item(uuid, text) TO authenticated;

-- O fluxo de compra passa a ser autorizado no momento em que a decisão é confirmada.
SELECT set_config('app.purchase_auto_authorization', 'on', true);

UPDATE public.purchase_orders
   SET status = 'Aprovada',
       approved_at = coalesce(approved_at, now()),
       approval_note = coalesce(approval_note, 'Compra autorizada automaticamente pelo fluxo operacional.')
 WHERE status = 'Gerada';

UPDATE public.quotations q
   SET status = 'Compra Autorizada', updated_at = now()
 WHERE q.status = 'Aguardando Aprovação'
   AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.quotation_id = q.id)
   AND NOT EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.quotation_id = q.id AND po.status = 'Gerada');

UPDATE public.events e
   SET status = 'Aprovado', updated_at = now()
 WHERE e.status = 'Aguardando Aprovação'
   AND EXISTS (
     SELECT 1
       FROM public.purchase_orders po
      WHERE po.event_id = e.id
        AND po.status = 'Aprovada'
   );

NOTIFY pgrst, 'reload schema';

COMMIT;
