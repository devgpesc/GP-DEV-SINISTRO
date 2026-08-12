BEGIN;

-- O status comercial do sinistro continua independente. Este campo representa
-- somente a situação automática calculada pelas datas de início e limite.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS schedule_status text NOT NULL DEFAULT 'Em andamento';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_schedule_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_schedule_status_check
  CHECK (schedule_status IN ('Sem prazo', 'Agendado', 'Em andamento', 'Em atraso', 'Concluído', 'Cancelado'));

CREATE OR REPLACE FUNCTION public.event_schedule_status(
  p_opened_at timestamptz,
  p_deadline_at date,
  p_business_status text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_business_status IN ('Concluído', 'Concluido') THEN 'Concluído'
    WHEN p_business_status IN ('Cancelado', 'Cancelada') THEN 'Cancelado'
    WHEN p_opened_at IS NULL AND p_deadline_at IS NULL THEN 'Sem prazo'
    WHEN p_opened_at IS NOT NULL
      AND (p_opened_at AT TIME ZONE 'America/Sao_Paulo')::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date
      THEN 'Agendado'
    WHEN p_deadline_at IS NOT NULL
      AND p_deadline_at < (now() AT TIME ZONE 'America/Sao_Paulo')::date
      THEN 'Em atraso'
    ELSE 'Em andamento'
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_event_schedule_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.schedule_status := public.event_schedule_status(NEW.opened_at, NEW.deadline_at, NEW.status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_event_schedule_status ON public.events;
CREATE TRIGGER trg_set_event_schedule_status
BEFORE INSERT OR UPDATE OF opened_at, deadline_at, status
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_event_schedule_status();

CREATE OR REPLACE FUNCTION public.record_event_schedule_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.schedule_status IS DISTINCT FROM NEW.schedule_status THEN
    INSERT INTO public.event_history (
      event_id, from_status, to_status, comment, user_id, created_at
    ) VALUES (
      NEW.id,
      OLD.schedule_status,
      NEW.schedule_status,
      'Status de prazo atualizado automaticamente com base nas datas do sinistro.',
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_event_schedule_status_history ON public.events;
CREATE TRIGGER trg_record_event_schedule_status_history
AFTER UPDATE
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.record_event_schedule_status_history();

UPDATE public.events
   SET schedule_status = public.event_schedule_status(opened_at, deadline_at, status)
 WHERE schedule_status IS DISTINCT FROM public.event_schedule_status(opened_at, deadline_at, status);

CREATE INDEX IF NOT EXISTS idx_events_schedule_status
  ON public.events(tenant_id, schedule_status);

CREATE OR REPLACE FUNCTION public.sync_event_schedule_statuses()
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
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  UPDATE public.events e
     SET schedule_status = public.event_schedule_status(e.opened_at, e.deadline_at, e.status),
         updated_at = now()
   WHERE e.schedule_status IS DISTINCT FROM public.event_schedule_status(e.opened_at, e.deadline_at, e.status)
     AND (
       public.is_platform_super_admin(actor)
       OR e.tenant_id IN (SELECT public.get_my_tenant_ids())
     );

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_schedule_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_event_schedule_statuses() TO authenticated;

-- Em projetos Supabase com pg_cron ativo, mantém a virada dos status mesmo
-- quando nenhum usuário está com o sistema aberto. A sincronização pela API
-- continua sendo o fallback para ambientes sem a extensão.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Extensão pg_cron não habilitada: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'events-schedule-status-hourly',
      '5 * * * *',
      $cron$
        UPDATE public.events e
           SET schedule_status = public.event_schedule_status(e.opened_at, e.deadline_at, e.status),
               updated_at = now()
         WHERE e.schedule_status IS DISTINCT FROM public.event_schedule_status(e.opened_at, e.deadline_at, e.status)
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento de status por data não criado: %', SQLERRM;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
