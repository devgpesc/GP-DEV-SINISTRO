-- Histórico de auditoria de OCs, chaves de API e reforço de segurança

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.purchase_order_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  comment text,
  details jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_history_order ON public.purchase_order_history(purchase_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_history_tenant ON public.purchase_order_history(tenant_id, created_at DESC);

ALTER TABLE public.purchase_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant scoped access" ON public.purchase_order_history;
CREATE POLICY "Tenant scoped access" ON public.purchase_order_history
  FOR ALL TO authenticated
  USING (
    public.is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  )
  WITH CHECK (
    public.is_platform_super_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_my_tenant_ids())
  );

CREATE OR REPLACE FUNCTION public.user_has_permission(perm text, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_super_admin(check_user_id)
    OR EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = check_user_id
         AND (
           p.role IN ('Admin', 'Gerente', 'super_admin')
           OR coalesce((p.permissions ->> perm)::boolean, false)
         )
    )
    OR EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.user_id = check_user_id
         AND om.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.log_purchase_order_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'created',
      NULL,
      NEW.status,
      actor,
      jsonb_build_object('code', NEW.code, 'total', NEW.total, 'supplier_id', NEW.supplier_id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.approval_note IS DISTINCT FROM NEW.approval_note
       OR OLD.approved_by IS DISTINCT FROM NEW.approved_by THEN
      INSERT INTO public.purchase_order_history (
        purchase_order_id, tenant_id, action, from_status, to_status, comment, user_id, details
      ) VALUES (
        NEW.id,
        NEW.tenant_id,
        CASE
          WHEN NEW.status = 'Aprovada' AND OLD.status IS DISTINCT FROM NEW.status THEN 'approved'
          WHEN NEW.status = 'Cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN 'cancelled'
          WHEN NEW.status = 'Recebida' AND OLD.status IS DISTINCT FROM NEW.status THEN 'received'
          ELSE 'updated'
        END,
        OLD.status,
        NEW.status,
        NEW.approval_note,
        coalesce(NEW.approved_by, actor),
        jsonb_build_object(
          'code', NEW.code,
          'approved_at', NEW.approved_at,
          'approval_note', NEW.approval_note
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      OLD.id,
      OLD.tenant_id,
      'deleted',
      OLD.status,
      NULL,
      actor,
      jsonb_build_object('code', OLD.code, 'total', OLD.total)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_history ON public.purchase_orders;
CREATE TRIGGER trg_po_history
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_purchase_order_history();

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
    IF NEW.status = 'Aprovada' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NOT can_approve THEN
        RAISE EXCEPTION 'Permissão negada para aprovar ordem de compra.';
      END IF;
      IF NEW.approval_note IS NULL OR btrim(NEW.approval_note) = '' THEN
        RAISE EXCEPTION 'Justificativa por escrito obrigatória para aprovação.';
      END IF;
    END IF;

    IF NEW.status = 'Cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NOT can_approve THEN
        RAISE EXCEPTION 'Permissão negada para cancelar ordem de compra.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_po ON public.purchase_orders;
CREATE TRIGGER trg_guard_po
  BEFORE UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_order_mutations();

-- purchase_order_items: RLS por tenant via OC pai
DO $$
DECLARE
  policy_record record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY';

    FOR policy_record IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'purchase_order_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.purchase_order_items', policy_record.policyname);
    END LOOP;

    EXECUTE '
      CREATE POLICY "Tenant scoped PO items" ON public.purchase_order_items
      FOR ALL TO authenticated
      USING (
        public.is_platform_super_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.purchase_orders po
           WHERE po.id = purchase_order_id
             AND po.tenant_id IN (SELECT public.get_my_tenant_ids())
        )
      )
      WITH CHECK (
        public.is_platform_super_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.purchase_orders po
           WHERE po.id = purchase_order_id
             AND po.tenant_id IN (SELECT public.get_my_tenant_ids())
        )
      )';
  END IF;
END $$;

-- Chaves de API por tenant
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.saas_tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes jsonb DEFAULT '["read"]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant scoped access" ON public.api_keys;
CREATE POLICY "Tenant scoped access" ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.is_platform_super_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_my_tenant_ids())
      AND public.is_tenant_admin(tenant_id, auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_super_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_my_tenant_ids())
      AND public.is_tenant_admin(tenant_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.create_tenant_api_key(
  p_tenant_id uuid,
  p_name text,
  p_scopes jsonb DEFAULT '["read"]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_key text;
  key_prefix text;
  key_hash text;
  new_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome e empresa são obrigatórios.';
  END IF;

  IF NOT public.is_tenant_admin(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado para criar chave de API.';
  END IF;

  raw_key := 'evsc_live_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  key_prefix := substring(raw_key from 1 for 20);
  key_hash := encode(digest(raw_key, 'sha256'), 'hex');

  INSERT INTO public.api_keys (tenant_id, name, key_prefix, key_hash, scopes, created_by)
  VALUES (p_tenant_id, btrim(p_name), key_prefix, key_hash, coalesce(p_scopes, '["read"]'::jsonb), auth.uid())
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'id', new_id,
    'name', btrim(p_name),
    'key', raw_key,
    'key_prefix', key_prefix,
    'scopes', coalesce(p_scopes, '["read"]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_tenant_api_key(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_tenant uuid;
BEGIN
  SELECT tenant_id INTO target_tenant FROM public.api_keys WHERE id = p_key_id;
  IF target_tenant IS NULL THEN
    RAISE EXCEPTION 'Chave não encontrada.';
  END IF;
  IF NOT public.is_tenant_admin(target_tenant, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  UPDATE public.api_keys SET revoked_at = now() WHERE id = p_key_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_api_key(p_raw_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found record;
  hashed text;
BEGIN
  IF p_raw_key IS NULL OR length(p_raw_key) < 20 THEN
    RETURN NULL;
  END IF;

  hashed := encode(digest(p_raw_key, 'sha256'), 'hex');

  SELECT id, tenant_id, scopes, name
    INTO found
    FROM public.api_keys
   WHERE key_hash = hashed
     AND revoked_at IS NULL
   LIMIT 1;

  IF found IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = found.id;

  RETURN jsonb_build_object(
    'key_id', found.id,
    'tenant_id', found.tenant_id,
    'scopes', found.scopes,
    'name', found.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_tenant_api_key(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text, uuid) TO authenticated;

NOTIFY pgrst, 'reload config';
