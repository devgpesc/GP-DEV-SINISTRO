BEGIN;

CREATE OR REPLACE FUNCTION public.delete_tenant_cascade(target_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_name text;
BEGIN
  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa obrigatoria.';
  END IF;

  IF NOT public.is_platform_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Super Admin pode excluir empresas.';
  END IF;

  SELECT name INTO target_name
    FROM public.saas_tenants
   WHERE id = target_tenant_id;

  IF target_name IS NULL THEN
    RAISE EXCEPTION 'Empresa nao encontrada.';
  END IF;

  -- Notificacoes e auditoria
  DELETE FROM public.notifications WHERE tenant_id = target_tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = target_tenant_id;
  DELETE FROM public.deliveries WHERE tenant_id = target_tenant_id;
  DELETE FROM public.saas_settings WHERE tenant_id = target_tenant_id;
  DELETE FROM public.invitations WHERE tenant_id = target_tenant_id;

  -- Filhas de cotacoes (antes de apagar quotations)
  DELETE FROM public.quotation_decision_history
   WHERE quotation_id IN (SELECT id FROM public.quotations WHERE tenant_id = target_tenant_id);

  DELETE FROM public.quotation_purchase_selections
   WHERE quotation_id IN (SELECT id FROM public.quotations WHERE tenant_id = target_tenant_id);

  DELETE FROM public.quotation_item_releases
   WHERE quotation_id IN (SELECT id FROM public.quotations WHERE tenant_id = target_tenant_id);

  DELETE FROM public.quotation_supplier_prices
   WHERE quotation_supplier_id IN (
     SELECT qs.id
       FROM public.quotation_suppliers qs
       JOIN public.quotations q ON q.id = qs.quotation_id
      WHERE q.tenant_id = target_tenant_id
   );

  DELETE FROM public.quotation_suppliers
   WHERE quotation_id IN (SELECT id FROM public.quotations WHERE tenant_id = target_tenant_id);

  DELETE FROM public.quotation_items
   WHERE quotation_id IN (SELECT id FROM public.quotations WHERE tenant_id = target_tenant_id);

  -- Filhas de ordens de compra
  DELETE FROM public.purchase_order_items
   WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id = target_tenant_id);

  DELETE FROM public.purchase_orders WHERE tenant_id = target_tenant_id;
  DELETE FROM public.quotations WHERE tenant_id = target_tenant_id;

  -- Filhas de eventos
  DELETE FROM public.event_attachments
   WHERE event_id IN (SELECT id FROM public.events WHERE tenant_id = target_tenant_id);

  DELETE FROM public.event_history
   WHERE event_id IN (SELECT id FROM public.events WHERE tenant_id = target_tenant_id);

  DELETE FROM public.events WHERE tenant_id = target_tenant_id;

  DELETE FROM public.supplier_reviews WHERE tenant_id = target_tenant_id;
  DELETE FROM public.vehicles WHERE tenant_id = target_tenant_id;
  DELETE FROM public.associates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.catalog_items WHERE tenant_id = target_tenant_id;
  DELETE FROM public.suppliers WHERE tenant_id = target_tenant_id;

  DELETE FROM public.organization_members WHERE tenant_id = target_tenant_id;

  DELETE FROM public.saas_tenants WHERE id = target_tenant_id;

  RETURN json_build_object('status', 'deleted', 'tenant_id', target_tenant_id, 'name', target_name);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tenant_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_tenant_cascade(uuid) TO authenticated;

COMMIT;
