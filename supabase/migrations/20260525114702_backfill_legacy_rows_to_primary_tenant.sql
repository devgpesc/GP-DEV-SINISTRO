BEGIN;

DO $$
DECLARE
  legacy_tenant_id uuid;
  target_table text;
BEGIN
  SELECT id
    INTO legacy_tenant_id
    FROM public.saas_tenants
   ORDER BY created_at ASC NULLS LAST, name ASC
   LIMIT 1;

  IF legacy_tenant_id IS NULL THEN
    RAISE NOTICE 'Nenhum tenant encontrado para backfill de dados legados.';
    RETURN;
  END IF;

  FOREACH target_table IN ARRAY ARRAY[
    'suppliers',
    'supplier_reviews',
    'associates',
    'vehicles',
    'catalog_items',
    'events',
    'quotations',
    'purchase_orders',
    'deliveries',
    'audit_logs',
    'saas_settings',
    'invitations'
  ] LOOP
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = target_table
         AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL',
        target_table
      )
      USING legacy_tenant_id;
    END IF;
  END LOOP;
END $$;

COMMIT;
