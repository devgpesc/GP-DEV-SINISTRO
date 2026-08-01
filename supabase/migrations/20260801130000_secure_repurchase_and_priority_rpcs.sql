BEGIN;

-- Tabelas filhas da cotacao herdam o tenant da cotacao pai.
DO $$
DECLARE
  target_table text;
  policy_record record;
  tenant_predicate text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'quotation_items',
    'quotation_suppliers',
    'quotation_supplier_prices',
    'quotation_purchase_selections',
    'quotation_decision_history',
    'quotation_item_releases'
  ] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR policy_record IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;

    tenant_predicate := CASE target_table
      WHEN 'quotation_supplier_prices' THEN
        'EXISTS (
          SELECT 1
            FROM public.quotation_items qi
            JOIN public.quotations q ON q.id = qi.quotation_id
           WHERE qi.id = quotation_item_id
             AND (public.is_platform_super_admin(auth.uid()) OR q.tenant_id IN (SELECT public.get_my_tenant_ids()))
        )'
      ELSE
        'EXISTS (
          SELECT 1
            FROM public.quotations q
           WHERE q.id = quotation_id
             AND (public.is_platform_super_admin(auth.uid()) OR q.tenant_id IN (SELECT public.get_my_tenant_ids()))
        )'
    END;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'Tenant scoped quotation access',
      target_table,
      tenant_predicate,
      tenant_predicate
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order_and_release_for_repurchase(
  p_purchase_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  order_row public.purchase_orders%ROWTYPE;
  release_reason text := btrim(coalesce(p_reason, ''));
  released_count integer := 0;
  already_released_count integer := 0;
  item_ids uuid[] := ARRAY[]::uuid[];
  item_names text[] := ARRAY[]::text[];
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  IF length(release_reason) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento e da recompra.';
  END IF;

  SELECT * INTO order_row
    FROM public.purchase_orders
   WHERE id = p_purchase_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de compra nao encontrada.';
  END IF;

  IF NOT public.is_platform_super_admin(actor)
     AND order_row.tenant_id NOT IN (SELECT public.get_my_tenant_ids()) THEN
    RAISE EXCEPTION 'Acesso negado para esta empresa.';
  END IF;

  IF NOT public.user_has_permission('approve_purchases', actor) THEN
    RAISE EXCEPTION 'Permissao negada para cancelar ordem de compra.';
  END IF;

  SELECT coalesce(array_agg(poi.quotation_item_id), ARRAY[]::uuid[]),
         coalesce(array_agg(poi.name) FILTER (WHERE poi.name IS NOT NULL), ARRAY[]::text[])
    INTO item_ids, item_names
    FROM public.purchase_order_items poi
   WHERE poi.purchase_order_id = order_row.id
     AND poi.quotation_item_id IS NOT NULL;

  IF order_row.quotation_id IS NOT NULL AND cardinality(item_ids) > 0 THEN
    SELECT count(*) INTO already_released_count
      FROM public.quotation_item_releases qir
     WHERE qir.quotation_id = order_row.quotation_id
       AND qir.quotation_item_id = ANY(item_ids)
       AND qir.status = 'released';
  END IF;

  IF order_row.status = 'Cancelada'
     AND already_released_count = cardinality(item_ids) THEN
    RETURN jsonb_build_object(
      'orderId', order_row.id,
      'quotationId', order_row.quotation_id,
      'eventId', order_row.event_id,
      'releasedItems', already_released_count,
      'quotationStatus', CASE WHEN order_row.quotation_id IS NULL THEN NULL ELSE 'Compra Autorizada' END,
      'eventStatus', CASE WHEN order_row.event_id IS NULL THEN NULL ELSE 'Em Cotação' END,
      'alreadyProcessed', true
    );
  END IF;

  UPDATE public.purchase_orders
     SET status = 'Cancelada'
   WHERE id = order_row.id
     AND status IS DISTINCT FROM 'Cancelada';

  IF order_row.quotation_id IS NOT NULL AND cardinality(item_ids) > 0 THEN
    INSERT INTO public.quotation_item_releases (
      quotation_id, quotation_item_id, reason, status,
      created_by, created_at, updated_at
    )
    SELECT order_row.quotation_id, item_id, release_reason, 'released', actor, now(), now()
      FROM unnest(item_ids) AS item_id
    ON CONFLICT (quotation_id, quotation_item_id)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      status = 'released',
      created_by = EXCLUDED.created_by,
      updated_at = now();

    GET DIAGNOSTICS released_count = ROW_COUNT;

    UPDATE public.quotation_purchase_selections
       SET status = 'Cancelado', updated_at = now()
     WHERE quotation_id = order_row.quotation_id
       AND quotation_item_id = ANY(item_ids);

    INSERT INTO public.quotation_decision_history (
      quotation_id, action, details, user_id, created_at
    ) VALUES (
      order_row.quotation_id,
      'purchase_cancelled_repurchase_released',
      jsonb_build_object(
        'purchase_order_id', order_row.id,
        'purchase_order_code', order_row.code,
        'released_item_ids', to_jsonb(item_ids),
        'released_item_names', to_jsonb(item_names),
        'reason', release_reason
      ),
      actor,
      now()
    );

    UPDATE public.quotations
       SET status = 'Compra Autorizada', updated_at = now()
     WHERE id = order_row.quotation_id;
  END IF;

  IF order_row.event_id IS NOT NULL THEN
    UPDATE public.events
       SET status = 'Em Cotação', updated_at = now()
     WHERE id = order_row.event_id;
  END IF;

  INSERT INTO public.purchase_order_history (
    purchase_order_id, tenant_id, action, comment, details, user_id, created_at
  ) VALUES (
    order_row.id,
    order_row.tenant_id,
    'repurchase_released',
    release_reason,
    jsonb_build_object(
      'quotation_id', order_row.quotation_id,
      'event_id', order_row.event_id,
      'released_items', released_count
    ),
    actor,
    now()
  );

  RETURN jsonb_build_object(
    'orderId', order_row.id,
    'quotationId', order_row.quotation_id,
    'eventId', order_row.event_id,
    'releasedItems', released_count,
    'quotationStatus', CASE WHEN order_row.quotation_id IS NULL THEN NULL ELSE 'Compra Autorizada' END,
    'eventStatus', CASE WHEN order_row.event_id IS NULL THEN NULL ELSE 'Em Cotação' END,
    'alreadyProcessed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_purchase_order_and_release_for_repurchase(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_order_and_release_for_repurchase(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.escalate_event_priorities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  changed_count integer := 0;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  WITH candidates AS (
    SELECT e.id,
           e.priority AS old_priority,
           coalesce(
             e.priority_score,
             CASE
               WHEN e.priority = 'Baixa' THEN 2
               WHEN e.priority IN ('Media', 'Média') THEN 5
               WHEN e.priority = 'Alta' THEN 8
               WHEN e.priority = 'Urgente' THEN 9
               ELSE 5
             END
           ) AS old_score,
           CASE
             WHEN e.deadline_at < current_date THEN 'Urgente'
             WHEN e.deadline_at <= current_date + 2
                  AND coalesce(e.priority_score, CASE WHEN e.priority = 'Baixa' THEN 2 ELSE 5 END) <= 3 THEN 'Média'
             WHEN e.deadline_at <= current_date + 2
                  AND coalesce(e.priority_score, 5) <= 7 THEN 'Urgente'
             ELSE e.priority
           END AS new_priority,
           CASE
             WHEN e.deadline_at < current_date THEN greatest(coalesce(e.priority_score, 5), 9)
             WHEN e.deadline_at <= current_date + 2
                  AND coalesce(e.priority_score, CASE WHEN e.priority = 'Baixa' THEN 2 ELSE 5 END) <= 3 THEN 5
             WHEN e.deadline_at <= current_date + 2
                  AND coalesce(e.priority_score, 5) <= 7 THEN 8
             ELSE coalesce(e.priority_score, 5)
           END AS new_score
      FROM public.events e
     WHERE e.deadline_at IS NOT NULL
       AND e.status NOT IN ('Concluido', 'Concluído', 'Cancelado', 'Cancelada')
       AND (
         public.is_platform_super_admin(actor)
         OR e.tenant_id IN (SELECT public.get_my_tenant_ids())
       )
  ),
  targets AS (
    SELECT * FROM candidates
     WHERE new_priority IS DISTINCT FROM old_priority
        OR new_score IS DISTINCT FROM old_score
  ),
  updated AS (
    UPDATE public.events e
       SET priority = t.new_priority,
           priority_score = t.new_score,
           updated_at = now()
      FROM targets t
     WHERE e.id = t.id
    RETURNING e.id, t.old_priority, t.old_score, t.new_priority, t.new_score
  )
  INSERT INTO public.event_history (
    event_id, from_status, to_status, comment, user_id, created_at
  )
  SELECT id,
         concat(coalesce(old_priority, 'Sem prioridade'), ' (', old_score, ')'),
         concat(new_priority, ' (', new_score, ')'),
         'Escalonamento automatico por prazo do sinistro.',
         NULL,
         now()
    FROM updated;

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_event_priorities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_event_priorities() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
