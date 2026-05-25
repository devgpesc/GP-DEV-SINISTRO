BEGIN;

-- As policies antigas eram permissivas ("authenticated can read/write") e,
-- como o Postgres combina policies RLS com OR, elas anulavam o isolamento
-- por tenant. Esta migration deixa as tabelas operacionais com uma regra
-- única: membro da empresa atual ou super admin da plataforma.
DO $$
DECLARE
  target_table text;
  policy_record record;
BEGIN
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
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = target_table
    ) AND EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = target_table
         AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

      FOR policy_record IN
        SELECT policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = target_table
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I
         FOR ALL TO authenticated
         USING (
           public.is_platform_super_admin(auth.uid())
           OR tenant_id IN (SELECT public.get_my_tenant_ids())
         )
         WITH CHECK (
           public.is_platform_super_admin(auth.uid())
           OR tenant_id IN (SELECT public.get_my_tenant_ids())
         )',
        'Tenant scoped access',
        target_table
      );

      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_%I ON public.%I', target_table, target_table);
      EXECUTE format(
        'CREATE TRIGGER trg_set_tenant_%I
         BEFORE INSERT ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_default_tenant_id()',
        target_table,
        target_table
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'saas_settings'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS public.saas_settings_id_seq;

    PERFORM setval(
      'public.saas_settings_id_seq',
      GREATEST((SELECT coalesce(max(id), 0) FROM public.saas_settings), 1),
      true
    );

    ALTER TABLE public.saas_settings
      ALTER COLUMN id SET DEFAULT nextval('public.saas_settings_id_seq');

    ALTER SEQUENCE public.saas_settings_id_seq OWNED BY public.saas_settings.id;

    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY tenant_id
               ORDER BY updated_at DESC NULLS LAST, id DESC
             ) AS rn
        FROM public.saas_settings
       WHERE tenant_id IS NOT NULL
    )
    DELETE FROM public.saas_settings s
     USING ranked r
     WHERE s.id = r.id
       AND r.rn > 1;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint
       WHERE conname = 'saas_settings_tenant_id_key'
         AND conrelid = 'public.saas_settings'::regclass
    ) THEN
      ALTER TABLE public.saas_settings
        ADD CONSTRAINT saas_settings_tenant_id_key UNIQUE (tenant_id);
    END IF;
  END IF;
END $$;

COMMIT;
