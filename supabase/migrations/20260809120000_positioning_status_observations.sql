-- Registra a observacao informada junto da mudanca de etapa/status,
-- sem reaproveitar por engano uma observacao antiga do acompanhamento.
CREATE OR REPLACE FUNCTION public.record_vehicle_positioning_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  timeline_description text;
BEGIN
  IF TG_TABLE_NAME = 'vehicle_positionings' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.vehicle_positioning_timeline (
        tenant_id, positioning_id, event_type, title, description,
        new_stage, new_status, actor_id
      )
      VALUES (
        NEW.tenant_id, NEW.id, 'criacao', 'Acompanhamento criado',
        'Novo acompanhamento de oficina cadastrado.',
        NEW.current_stage, NEW.stage_status, auth.uid()
      );
    ELSIF OLD.current_stage IS DISTINCT FROM NEW.current_stage
       OR OLD.stage_status IS DISTINCT FROM NEW.stage_status
       OR OLD.observation IS DISTINCT FROM NEW.observation THEN
      timeline_description := CASE
        WHEN OLD.observation IS DISTINCT FROM NEW.observation
          AND NULLIF(BTRIM(NEW.observation), '') IS NOT NULL
          THEN BTRIM(NEW.observation)
        WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage
          THEN 'Posicionamento alterado para ' || NEW.current_stage || '.'
        WHEN OLD.stage_status IS DISTINCT FROM NEW.stage_status
          THEN 'Status alterado para ' || NEW.stage_status || '.'
        ELSE 'Observação removida do acompanhamento.'
      END;

      INSERT INTO public.vehicle_positioning_timeline (
        tenant_id, positioning_id, event_type, title, description,
        old_stage, new_stage, old_status, new_status, actor_id
      )
      VALUES (
        NEW.tenant_id,
        NEW.id,
        CASE
          WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage
            OR OLD.stage_status IS DISTINCT FROM NEW.stage_status
            THEN 'status'
          ELSE 'observacao'
        END,
        CASE
          WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN 'Posicionamento atualizado'
          WHEN OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN 'Status atualizado'
          ELSE 'Observação registrada'
        END,
        timeline_description,
        OLD.current_stage,
        NEW.current_stage,
        OLD.stage_status,
        NEW.stage_status,
        auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vehicle_positioning_timeline (
      tenant_id, positioning_id, event_type, title, description,
      new_status, service_name, actor_id
    )
    VALUES (
      NEW.tenant_id,
      NEW.positioning_id,
      'servico',
      'Serviço adicionado',
      COALESCE(NULLIF(BTRIM(NEW.observation), ''), 'Status inicial: ' || NEW.status),
      NEW.status,
      NEW.service_name,
      auth.uid()
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.observation IS DISTINCT FROM NEW.observation THEN
    timeline_description := CASE
      WHEN OLD.observation IS DISTINCT FROM NEW.observation
        AND NULLIF(BTRIM(NEW.observation), '') IS NOT NULL
        THEN BTRIM(NEW.observation)
      WHEN OLD.status IS DISTINCT FROM NEW.status
        THEN 'Status alterado de ' || OLD.status || ' para ' || NEW.status || '.'
      ELSE 'Observação removida do serviço.'
    END;

    INSERT INTO public.vehicle_positioning_timeline (
      tenant_id, positioning_id, event_type, title, description,
      old_status, new_status, service_name, actor_id
    )
    VALUES (
      NEW.tenant_id,
      NEW.positioning_id,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'servico_status' ELSE 'servico_observacao' END,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'Serviço atualizado' ELSE 'Observação do serviço atualizada' END,
      timeline_description,
      OLD.status,
      NEW.status,
      NEW.service_name,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;
