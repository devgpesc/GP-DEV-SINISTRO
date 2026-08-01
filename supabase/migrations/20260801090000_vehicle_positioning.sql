-- Posicionamento operacional do veículo no fluxo de oficina.
CREATE TABLE IF NOT EXISTS public.vehicle_positionings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  workshop_name text NOT NULL,
  insured_name text,
  client_name text,
  current_stage text NOT NULL DEFAULT 'Orçamento pendente',
  stage_status text NOT NULL DEFAULT 'Pendente',
  observation text,
  budget_sent_at date,
  authorization_at date,
  entry_at date,
  expected_delivery_at date,
  delivered_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_positionings_stage_check CHECK (current_stage IN ('Orçamento pendente','Aguardando autorização / entrada','Em serviço','Finalizado / entregue')),
  CONSTRAINT vehicle_positionings_status_check CHECK (stage_status IN ('Pendente','Aguardando cliente','Aguardando peças','Em andamento','Concluído','Cancelado'))
);

CREATE TABLE IF NOT EXISTS public.vehicle_positioning_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  positioning_id uuid NOT NULL REFERENCES public.vehicle_positionings(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  service_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pendente',
  started_at date,
  finished_at date,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positioning_services_status_check CHECK (status IN ('Pendente','Em andamento','Concluído','Bloqueado'))
);

CREATE INDEX IF NOT EXISTS idx_vehicle_positionings_tenant_stage ON public.vehicle_positionings(tenant_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_vehicle_positionings_event ON public.vehicle_positionings(event_id);
CREATE INDEX IF NOT EXISTS idx_positioning_services_positioning ON public.vehicle_positioning_services(positioning_id, service_order);

DROP TRIGGER IF EXISTS trg_set_tenant_vehicle_positionings ON public.vehicle_positionings;
CREATE TRIGGER trg_set_tenant_vehicle_positionings BEFORE INSERT ON public.vehicle_positionings FOR EACH ROW EXECUTE FUNCTION public.set_default_tenant_id();
DROP TRIGGER IF EXISTS trg_set_tenant_positioning_services ON public.vehicle_positioning_services;
CREATE TRIGGER trg_set_tenant_positioning_services BEFORE INSERT ON public.vehicle_positioning_services FOR EACH ROW EXECUTE FUNCTION public.set_default_tenant_id();

ALTER TABLE public.vehicle_positionings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_positioning_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant scoped access" ON public.vehicle_positionings;
DROP POLICY IF EXISTS "Tenant scoped access" ON public.vehicle_positioning_services;
CREATE POLICY "Tenant scoped access" ON public.vehicle_positionings FOR ALL TO authenticated
  USING (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()))
  WITH CHECK (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()));
CREATE POLICY "Tenant scoped access" ON public.vehicle_positioning_services FOR ALL TO authenticated
  USING (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()))
  WITH CHECK (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE OR REPLACE FUNCTION public.touch_vehicle_positioning_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_touch_vehicle_positionings ON public.vehicle_positionings;
CREATE TRIGGER trg_touch_vehicle_positionings BEFORE UPDATE ON public.vehicle_positionings FOR EACH ROW EXECUTE FUNCTION public.touch_vehicle_positioning_updated_at();
DROP TRIGGER IF EXISTS trg_touch_positioning_services ON public.vehicle_positioning_services;
CREATE TRIGGER trg_touch_positioning_services BEFORE UPDATE ON public.vehicle_positioning_services FOR EACH ROW EXECUTE FUNCTION public.touch_vehicle_positioning_updated_at();

COMMENT ON TABLE public.vehicle_positionings IS 'Posicionamento do veículo entre segurado, cliente e oficina.';
COMMENT ON TABLE public.vehicle_positioning_services IS 'Checklist de serviços executados na oficina.';

CREATE TABLE IF NOT EXISTS public.vehicle_positioning_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  positioning_id uuid NOT NULL REFERENCES public.vehicle_positionings(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'observacao',
  title text NOT NULL,
  description text,
  old_stage text,
  new_stage text,
  old_status text,
  new_status text,
  service_name text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positioning_timeline_positioning ON public.vehicle_positioning_timeline(positioning_id, created_at DESC);
ALTER TABLE public.vehicle_positioning_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant scoped access" ON public.vehicle_positioning_timeline;
CREATE POLICY "Tenant scoped access" ON public.vehicle_positioning_timeline FOR ALL TO authenticated
  USING (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()))
  WITH CHECK (public.is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT public.get_my_tenant_ids()));

CREATE OR REPLACE FUNCTION public.record_vehicle_positioning_timeline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'vehicle_positionings' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.vehicle_positioning_timeline (tenant_id, positioning_id, event_type, title, description, new_stage, new_status, actor_id)
      VALUES (NEW.tenant_id, NEW.id, 'criacao', 'Acompanhamento criado', 'Novo acompanhamento de oficina cadastrado.', NEW.current_stage, NEW.stage_status, auth.uid());
    ELSIF OLD.current_stage IS DISTINCT FROM NEW.current_stage OR OLD.stage_status IS DISTINCT FROM NEW.stage_status OR OLD.observation IS DISTINCT FROM NEW.observation THEN
      INSERT INTO public.vehicle_positioning_timeline (tenant_id, positioning_id, event_type, title, description, old_stage, new_stage, old_status, new_status, actor_id)
      VALUES (NEW.tenant_id, NEW.id,
        CASE WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage OR OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN 'status' ELSE 'observacao' END,
        CASE WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN 'Posicionamento atualizado' WHEN OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN 'Status atualizado' ELSE 'Observação registrada' END,
        NEW.observation, OLD.current_stage, NEW.current_stage, OLD.stage_status, NEW.stage_status, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.observation IS DISTINCT FROM NEW.observation THEN
    INSERT INTO public.vehicle_positioning_timeline (tenant_id, positioning_id, event_type, title, description, service_name, actor_id)
    SELECT NEW.tenant_id, NEW.positioning_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'servico' ELSE 'servico_status' END,
      CASE WHEN TG_OP = 'INSERT' THEN 'Serviço adicionado' ELSE 'Serviço atualizado' END,
      COALESCE(NEW.observation, 'Status: ' || NEW.status), NEW.service_name, auth.uid();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_positioning_timeline ON public.vehicle_positionings;
CREATE TRIGGER trg_positioning_timeline AFTER INSERT OR UPDATE ON public.vehicle_positionings FOR EACH ROW EXECUTE FUNCTION public.record_vehicle_positioning_timeline();
DROP TRIGGER IF EXISTS trg_positioning_service_timeline ON public.vehicle_positioning_services;
CREATE TRIGGER trg_positioning_service_timeline AFTER INSERT OR UPDATE ON public.vehicle_positioning_services FOR EACH ROW EXECUTE FUNCTION public.record_vehicle_positioning_timeline();
