-- Garante tabela notifications (ausente em alguns ambientes de producao)
BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN tenant_id uuid REFERENCES public.saas_tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
  has_tenant_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'tenant_id'
  ) INTO has_tenant_id;

  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
  END LOOP;

  IF has_tenant_id
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_super_admin')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_tenant_ids')
  THEN
    CREATE POLICY "Tenant scoped access" ON public.notifications
      FOR ALL TO authenticated
      USING (
        public.is_platform_super_admin(auth.uid())
        OR tenant_id IN (SELECT public.get_my_tenant_ids())
        OR (tenant_id IS NULL AND user_id = auth.uid())
      )
      WITH CHECK (
        public.is_platform_super_admin(auth.uid())
        OR tenant_id IN (SELECT public.get_my_tenant_ids())
        OR (tenant_id IS NULL AND user_id = auth.uid())
      );
  ELSE
    CREATE POLICY "Users read own notifications" ON public.notifications
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "Users update own notifications" ON public.notifications
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "System insert notifications" ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- delete_tenant_cascade seguro se a tabela acabou de ser criada
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

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'notifications'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'tenant_id'
  ) THEN
    DELETE FROM public.notifications WHERE tenant_id = target_tenant_id;
  END IF;

  DELETE FROM public.audit_logs WHERE tenant_id = target_tenant_id;
  DELETE FROM public.deliveries WHERE tenant_id = target_tenant_id;
  DELETE FROM public.saas_settings WHERE tenant_id = target_tenant_id;
  DELETE FROM public.invitations WHERE tenant_id = target_tenant_id;

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

  DELETE FROM public.purchase_order_items
   WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id = target_tenant_id);

  DELETE FROM public.purchase_orders WHERE tenant_id = target_tenant_id;
  DELETE FROM public.quotations WHERE tenant_id = target_tenant_id;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
