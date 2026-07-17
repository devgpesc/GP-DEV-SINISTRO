-- =============================================================================
-- EventsCar — Migration 002: Trigger guard_purchase_order_mutations
-- Data: 2026-07-17
-- Descrição: Cria trigger de guarda para ordens de compra (documentado mas ausente)
--            e tabela + trigger de histórico purchase_order_history
-- =============================================================================

-- ===== PARTE A: Tabela de histórico de OC =====================================

CREATE TABLE IF NOT EXISTS public.purchase_order_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  action       text NOT NULL,  -- 'created' | 'approved' | 'cancelled' | 'deleted' | 'updated'
  old_status   text,
  new_status   text,
  changed_by   uuid REFERENCES auth.users(id),
  note         text,
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant scoped access"
  ON public.purchase_order_history
  FOR ALL
  TO authenticated
  USING (
    is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT get_my_tenant_ids())
  )
  WITH CHECK (
    is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT get_my_tenant_ids())
  );

-- ===== PARTE B: Função de guarda — regras de negócio em OC ===================

CREATE OR REPLACE FUNCTION public.guard_purchase_order_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_permissions  jsonb;
  v_role         text;
  v_is_admin     boolean;
BEGIN

  -- Buscar perfil do usuário atual
  SELECT permissions, role
    INTO v_permissions, v_role
    FROM public.profiles
   WHERE id = auth.uid();

  -- Super admin passa direto
  IF public.is_platform_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_is_admin := v_role IN ('super_admin', 'Admin', 'Gerente')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = auth.uid()
         AND om.role IN ('owner', 'admin')
         AND om.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
    );

  -- -------------------------------------------------------------------------
  -- APROVAÇÃO: status muda para 'approved'
  -- -------------------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'approved'
  THEN
    -- Exige flag approve_purchases ou perfil gerencial
    IF NOT v_is_admin AND NOT (v_permissions->>'approve_purchases')::boolean THEN
      RAISE EXCEPTION 'Sem permissão para aprovar ordens de compra. Flag approve_purchases necessária.';
    END IF;

    -- Exige approval_note preenchida
    IF NEW.approval_note IS NULL OR trim(NEW.approval_note) = '' THEN
      RAISE EXCEPTION 'É obrigatório preencher a nota de aprovação (approval_note).';
    END IF;

    -- Registrar quem aprovou
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  -- -------------------------------------------------------------------------
  -- CANCELAMENTO: status muda para 'cancelled'
  -- -------------------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'cancelled'
  THEN
    IF NOT v_is_admin AND NOT (v_permissions->>'approve_purchases')::boolean THEN
      RAISE EXCEPTION 'Sem permissão para cancelar ordens de compra. Flag approve_purchases necessária.';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- EXCLUSÃO: DELETE na OC
  -- -------------------------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_admin AND NOT (v_permissions->>'delete_records')::boolean THEN
      RAISE EXCEPTION 'Sem permissão para excluir ordens de compra. Flag delete_records necessária.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ===== PARTE C: Função de log de histórico ====================================

CREATE OR REPLACE FUNCTION public.log_purchase_order_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action text;
  v_note   text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    INSERT INTO public.purchase_order_history
      (order_id, tenant_id, action, new_status, changed_by, note, details)
    VALUES
      (NEW.id, NEW.tenant_id, v_action, NEW.status, auth.uid(), NULL,
       jsonb_build_object('code', NEW.code, 'total', NEW.total));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := CASE NEW.status
        WHEN 'approved'   THEN 'approved'
        WHEN 'cancelled'  THEN 'cancelled'
        ELSE 'updated'
      END;
      v_note := NEW.approval_note;
    ELSE
      v_action := 'updated';
    END IF;

    INSERT INTO public.purchase_order_history
      (order_id, tenant_id, action, old_status, new_status, changed_by, note, details)
    VALUES
      (NEW.id, NEW.tenant_id, v_action, OLD.status, NEW.status, auth.uid(),
       v_note,
       jsonb_build_object(
         'old_total', OLD.total,
         'new_total', NEW.total
       ));

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.purchase_order_history
      (order_id, tenant_id, action, old_status, changed_by, note, details)
    VALUES
      (OLD.id, OLD.tenant_id, 'deleted', OLD.status, auth.uid(), NULL,
       jsonb_build_object('code', OLD.code, 'total', OLD.total));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ===== PARTE D: Criar os triggers =============================================

-- Trigger de guarda (BEFORE) — bloqueia mutações não autorizadas
DROP TRIGGER IF EXISTS trg_guard_purchase_order_mutations ON public.purchase_orders;

CREATE TRIGGER trg_guard_purchase_order_mutations
  BEFORE UPDATE OR DELETE
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_purchase_order_mutations();

-- Trigger de histórico (AFTER) — loga todas as mutações
DROP TRIGGER IF EXISTS trg_log_purchase_order_history ON public.purchase_orders;

CREATE TRIGGER trg_log_purchase_order_history
  AFTER INSERT OR UPDATE OR DELETE
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_purchase_order_history();

-- =============================================================================
-- FIM DA MIGRATION 002
-- =============================================================================
