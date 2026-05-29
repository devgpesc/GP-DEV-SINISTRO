BEGIN;

DO $$
DECLARE
  policy_record record;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
  ) AND EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    FOR policy_record IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'notifications'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
    END LOOP;

    CREATE POLICY "Tenant scoped access" ON public.notifications
      FOR ALL TO authenticated
      USING (
        public.is_platform_super_admin(auth.uid())
        OR tenant_id IN (SELECT public.get_my_tenant_ids())
      )
      WITH CHECK (
        public.is_platform_super_admin(auth.uid())
        OR tenant_id IN (SELECT public.get_my_tenant_ids())
      );
  END IF;
END $$;

COMMIT;
