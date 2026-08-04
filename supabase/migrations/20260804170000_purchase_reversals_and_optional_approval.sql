BEGIN;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS reversed_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_type text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE TABLE IF NOT EXISTS public.purchase_order_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL UNIQUE REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  reversal_type text NOT NULL CHECK (reversal_type IN ('cancelamento', 'devolucao')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_reversals_tenant_created
  ON public.purchase_order_reversals(tenant_id, created_at DESC);

ALTER TABLE public.purchase_order_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant scoped purchase reversal access" ON public.purchase_order_reversals;
CREATE POLICY "Tenant scoped purchase reversal access" ON public.purchase_order_reversals
  FOR ALL TO authenticated
  USING (
    public.is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  )
  WITH CHECK (
    public.is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

UPDATE public.purchase_orders
   SET reversed_amount = coalesce(total, 0),
       reversed_at = coalesce(reversed_at, created_at),
       reversal_type = CASE WHEN status = 'Devolvida' THEN 'devolucao' ELSE 'cancelamento' END
 WHERE status IN ('Cancelada', 'Devolvida')
   AND reversed_amount = 0;

INSERT INTO public.purchase_order_reversals (
  purchase_order_id, tenant_id, reversal_type, amount, reason, created_at, updated_at
)
SELECT
  id,
  tenant_id,
  CASE WHEN status = 'Devolvida' THEN 'devolucao' ELSE 'cancelamento' END,
  coalesce(total, 0),
  cancellation_reason,
  coalesce(reversed_at, created_at, now()),
  now()
FROM public.purchase_orders
WHERE status IN ('Cancelada', 'Devolvida')
ON CONFLICT (purchase_order_id) DO NOTHING;

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
  NEW.reversed_amount := coalesce(NEW.total, 0);
  NEW.reversed_at := coalesce(NEW.reversed_at, now());
  NEW.reversal_type := reversal_kind;

  INSERT INTO public.purchase_order_reversals (
    purchase_order_id, tenant_id, reversal_type, amount, reason, created_by, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.tenant_id, reversal_kind, coalesce(NEW.total, 0), NEW.cancellation_reason, auth.uid(), now(), now()
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

DROP TRIGGER IF EXISTS trg_po_financial_reversal ON public.purchase_orders;
CREATE TRIGGER trg_po_financial_reversal
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.record_purchase_order_financial_reversal();

CREATE OR REPLACE FUNCTION public.guard_purchase_order_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_approve boolean;
  can_delete boolean;
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
    IF NEW.status IN ('Aprovada', 'Cancelada', 'Devolvida')
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NOT can_approve THEN
      RAISE EXCEPTION 'Permissão negada para aprovar, cancelar ou devolver ordem de compra.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_purchase_order_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  resolved_actor uuid;
  actor_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    resolved_actor := actor;
    SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuário')
      INTO actor_name FROM public.profiles p WHERE p.id = resolved_actor;

    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      NEW.id, NEW.tenant_id, 'created', NULL, NEW.status, resolved_actor,
      jsonb_build_object('code', NEW.code, 'total', NEW.total, 'supplier_id', NEW.supplier_id, 'actor_name', coalesce(actor_name, 'Usuário'))
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.approval_note IS DISTINCT FROM NEW.approval_note
       OR OLD.approved_by IS DISTINCT FROM NEW.approved_by THEN
      resolved_actor := coalesce(NEW.approved_by, actor);
      SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuário')
        INTO actor_name FROM public.profiles p WHERE p.id = resolved_actor;

      INSERT INTO public.purchase_order_history (
        purchase_order_id, tenant_id, action, from_status, to_status, comment, user_id, details
      ) VALUES (
        NEW.id,
        NEW.tenant_id,
        CASE
          WHEN NEW.status = 'Aprovada' AND OLD.status IS DISTINCT FROM NEW.status THEN 'approved'
          WHEN NEW.status = 'Cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN 'cancelled'
          WHEN NEW.status = 'Recebida' AND OLD.status IS DISTINCT FROM NEW.status THEN 'received'
          WHEN NEW.status = 'Devolvida' AND OLD.status IS DISTINCT FROM NEW.status THEN 'returned'
          ELSE 'updated'
        END,
        OLD.status,
        NEW.status,
        CASE WHEN NEW.status IN ('Cancelada', 'Devolvida') THEN NEW.cancellation_reason ELSE NEW.approval_note END,
        resolved_actor,
        jsonb_build_object(
          'code', NEW.code,
          'approved_at', NEW.approved_at,
          'approval_note', NEW.approval_note,
          'reversed_amount', NEW.reversed_amount,
          'reversal_type', NEW.reversal_type,
          'actor_name', coalesce(actor_name, 'Usuário')
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    resolved_actor := actor;
    SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuário')
      INTO actor_name FROM public.profiles p WHERE p.id = resolved_actor;

    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      OLD.id, OLD.tenant_id, 'deleted', OLD.status, NULL, resolved_actor,
      jsonb_build_object('code', OLD.code, 'total', OLD.total, 'actor_name', coalesce(actor_name, 'Usuário'))
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_purchase_order_return(
  p_purchase_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.purchase_orders%ROWTYPE;
  release_result jsonb;
  return_reason text := coalesce(nullif(btrim(p_reason), ''), 'Devolução integral da ordem de compra.');
BEGIN
  SELECT * INTO order_row
    FROM public.purchase_orders
   WHERE id = p_purchase_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de compra não encontrada.';
  END IF;

  IF order_row.status = 'Devolvida' THEN
    RETURN jsonb_build_object(
      'orderId', order_row.id,
      'returnedAmount', coalesce(order_row.reversed_amount, order_row.total, 0),
      'alreadyProcessed', true
    );
  END IF;

  IF order_row.status <> 'Recebida' THEN
    RAISE EXCEPTION 'A devolução só pode ser registrada para uma ordem já recebida.';
  END IF;

  release_result := public.cancel_purchase_order_and_release_for_repurchase(order_row.id, return_reason);

  UPDATE public.purchase_orders
     SET status = 'Devolvida',
         cancellation_reason = return_reason,
         reversed_amount = coalesce(total, 0),
         reversed_at = now(),
         reversal_type = 'devolucao'
   WHERE id = order_row.id;

  UPDATE public.purchase_order_reversals
     SET reversal_type = 'devolucao', reason = return_reason, updated_at = now()
   WHERE purchase_order_id = order_row.id;

  RETURN release_result || jsonb_build_object(
    'orderId', order_row.id,
    'returnedAmount', coalesce(order_row.total, 0),
    'alreadyProcessed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_purchase_order_return(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_purchase_order_return(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
