BEGIN;

-- Documento é opcional. Valores inválidos compostos apenas por zeros não podem
-- identificar pessoas diferentes nem reaproveitar veículos de outro cadastro.
ALTER TABLE public.associates ALTER COLUMN document DROP NOT NULL;

UPDATE public.associates
   SET document = NULL
 WHERE btrim(coalesce(document, '')) = ''
    OR regexp_replace(document, '\D', '', 'g') ~ '^0+$';

-- O posicionamento mantém o nome para leitura histórica, mas passa a vincular
-- a oficina/prestador cadastrado por UUID.
ALTER TABLE public.vehicle_positionings
  ADD COLUMN IF NOT EXISTS workshop_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workshop_selection_mode text NOT NULL DEFAULT 'manual';

ALTER TABLE public.vehicle_positionings
  DROP CONSTRAINT IF EXISTS vehicle_positionings_workshop_selection_mode_check;

ALTER TABLE public.vehicle_positionings
  ADD CONSTRAINT vehicle_positionings_workshop_selection_mode_check
  CHECK (workshop_selection_mode IN ('automatic', 'manual'));

UPDATE public.vehicle_positionings vp
   SET workshop_supplier_id = (
    SELECT s.id
      FROM public.suppliers s
     WHERE s.tenant_id = vp.tenant_id
       AND lower(btrim(s.name)) = lower(btrim(vp.workshop_name))
     ORDER BY s.created_at ASC
     LIMIT 1
  )
 WHERE vp.workshop_supplier_id IS NULL
   AND EXISTS (
     SELECT 1
       FROM public.suppliers s
      WHERE s.tenant_id = vp.tenant_id
        AND lower(btrim(s.name)) = lower(btrim(vp.workshop_name))
   );

CREATE INDEX IF NOT EXISTS idx_vehicle_positionings_workshop_supplier
  ON public.vehicle_positionings(tenant_id, workshop_supplier_id);

-- Une cotações antigas do mesmo sinistro. A cotação com OC tem prioridade;
-- itens equivalentes são consolidados e os relacionamentos são preservados.
DO $$
DECLARE
  duplicate_group record;
  duplicate_quote record;
  duplicate_item record;
  canonical_item_id uuid;
BEGIN
  FOR duplicate_group IN
    SELECT
      q."eventId" AS event_id,
      (
        SELECT candidate.id
          FROM public.quotations candidate
         WHERE candidate."eventId" = q."eventId"
         ORDER BY
           EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.quotation_id = candidate.id) DESC,
           candidate.created_at ASC,
           candidate.id ASC
         LIMIT 1
      ) AS canonical_quote_id
     FROM public.quotations q
     WHERE q."eventId" IS NOT NULL
     GROUP BY q."eventId"
    HAVING count(*) > 1
  LOOP
    FOR duplicate_quote IN
      SELECT q.id
        FROM public.quotations q
       WHERE q."eventId" = duplicate_group.event_id
         AND q.id <> duplicate_group.canonical_quote_id
       ORDER BY q.created_at ASC, q.id ASC
    LOOP
      INSERT INTO public.quotation_suppliers (quotation_id, supplier_id, status)
      SELECT duplicate_group.canonical_quote_id, supplier_id, status
        FROM public.quotation_suppliers
       WHERE quotation_id = duplicate_quote.id
      ON CONFLICT (quotation_id, supplier_id) DO NOTHING;

      DELETE FROM public.quotation_suppliers
       WHERE quotation_id = duplicate_quote.id;

      FOR duplicate_item IN
        SELECT *
          FROM public.quotation_items
         WHERE quotation_id = duplicate_quote.id
         ORDER BY created_at ASC, id ASC
      LOOP
        SELECT qi.id
          INTO canonical_item_id
          FROM public.quotation_items qi
         WHERE qi.quotation_id = duplicate_group.canonical_quote_id
           AND lower(btrim(qi.name)) = lower(btrim(duplicate_item.name))
           AND coalesce(qi.item_type, 'Peça') = coalesce(duplicate_item.item_type, 'Peça')
         ORDER BY qi.created_at ASC, qi.id ASC
         LIMIT 1;

        IF canonical_item_id IS NULL THEN
          UPDATE public.quotation_items
             SET quotation_id = duplicate_group.canonical_quote_id
           WHERE id = duplicate_item.id;

          UPDATE public.quotation_purchase_selections
             SET quotation_id = duplicate_group.canonical_quote_id
           WHERE quotation_id = duplicate_quote.id
             AND quotation_item_id = duplicate_item.id;

          UPDATE public.quotation_item_releases
             SET quotation_id = duplicate_group.canonical_quote_id
           WHERE quotation_id = duplicate_quote.id
             AND quotation_item_id = duplicate_item.id;
        ELSE
          DELETE FROM public.quotation_supplier_prices duplicate_price
           USING public.quotation_supplier_prices canonical_price
           WHERE duplicate_price.quotation_item_id = duplicate_item.id
             AND canonical_price.quotation_item_id = canonical_item_id
             AND canonical_price.supplier_id = duplicate_price.supplier_id;

          UPDATE public.quotation_supplier_prices
             SET quotation_item_id = canonical_item_id
           WHERE quotation_item_id = duplicate_item.id;

          DELETE FROM public.quotation_purchase_selections duplicate_selection
           USING public.quotation_purchase_selections canonical_selection
           WHERE duplicate_selection.quotation_id = duplicate_quote.id
             AND duplicate_selection.quotation_item_id = duplicate_item.id
             AND canonical_selection.quotation_id = duplicate_group.canonical_quote_id
             AND canonical_selection.quotation_item_id = canonical_item_id;

          UPDATE public.quotation_purchase_selections
             SET quotation_id = duplicate_group.canonical_quote_id,
                 quotation_item_id = canonical_item_id
           WHERE quotation_id = duplicate_quote.id
             AND quotation_item_id = duplicate_item.id;

          DELETE FROM public.quotation_item_releases duplicate_release
           USING public.quotation_item_releases canonical_release
           WHERE duplicate_release.quotation_id = duplicate_quote.id
             AND duplicate_release.quotation_item_id = duplicate_item.id
             AND canonical_release.quotation_id = duplicate_group.canonical_quote_id
             AND canonical_release.quotation_item_id = canonical_item_id;

          UPDATE public.quotation_item_releases
             SET quotation_id = duplicate_group.canonical_quote_id,
                 quotation_item_id = canonical_item_id
           WHERE quotation_id = duplicate_quote.id
             AND quotation_item_id = duplicate_item.id;

          UPDATE public.purchase_order_items
             SET quotation_item_id = canonical_item_id
           WHERE quotation_item_id = duplicate_item.id;

          DELETE FROM public.quotation_items WHERE id = duplicate_item.id;
        END IF;
      END LOOP;

      UPDATE public.quotation_decision_history
         SET quotation_id = duplicate_group.canonical_quote_id
       WHERE quotation_id = duplicate_quote.id;

      UPDATE public.purchase_orders
         SET quotation_id = duplicate_group.canonical_quote_id
       WHERE quotation_id = duplicate_quote.id;

      DELETE FROM public.quotations WHERE id = duplicate_quote.id;
    END LOOP;

    UPDATE public.quotations q
       SET "itemCount" = (SELECT count(*) FROM public.quotation_items qi WHERE qi.quotation_id = q.id),
           suppliers = (SELECT count(*) FROM public.quotation_suppliers qs WHERE qs.quotation_id = q.id),
           updated_at = now()
     WHERE q.id = duplicate_group.canonical_quote_id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_event
  ON public.quotations("eventId")
  WHERE "eventId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_tenant_code
  ON public.quotations(tenant_id, code);

-- Histórico legível para observações independentes e troca de oficina.
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
      ) VALUES (
        NEW.tenant_id, NEW.id, 'criacao', 'Acompanhamento criado',
        'Novo acompanhamento vinculado à oficina ' || NEW.workshop_name || '.',
        NEW.current_stage, NEW.stage_status, auth.uid()
      );
    ELSIF OLD.current_stage IS DISTINCT FROM NEW.current_stage
       OR OLD.stage_status IS DISTINCT FROM NEW.stage_status
       OR OLD.observation IS DISTINCT FROM NEW.observation
       OR OLD.workshop_supplier_id IS DISTINCT FROM NEW.workshop_supplier_id THEN
      timeline_description := CASE
        WHEN OLD.observation IS DISTINCT FROM NEW.observation
          AND NULLIF(BTRIM(NEW.observation), '') IS NOT NULL
          THEN BTRIM(NEW.observation)
        WHEN OLD.workshop_supplier_id IS DISTINCT FROM NEW.workshop_supplier_id
          THEN 'Oficina responsável alterada para ' || NEW.workshop_name || '.'
        WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage
          THEN 'Posicionamento alterado para ' || NEW.current_stage || '.'
        WHEN OLD.stage_status IS DISTINCT FROM NEW.stage_status
          THEN 'Status alterado para ' || NEW.stage_status || '.'
        ELSE 'Observação removida do acompanhamento.'
      END;

      INSERT INTO public.vehicle_positioning_timeline (
        tenant_id, positioning_id, event_type, title, description,
        old_stage, new_stage, old_status, new_status, actor_id
      ) VALUES (
        NEW.tenant_id,
        NEW.id,
        CASE
          WHEN OLD.workshop_supplier_id IS DISTINCT FROM NEW.workshop_supplier_id THEN 'oficina'
          WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage OR OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN 'status'
          ELSE 'observacao'
        END,
        CASE
          WHEN OLD.workshop_supplier_id IS DISTINCT FROM NEW.workshop_supplier_id THEN 'Oficina atualizada'
          WHEN OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN 'Posicionamento atualizado'
          WHEN OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN 'Status atualizado'
          ELSE 'Observação registrada'
        END,
        timeline_description,
        OLD.current_stage, NEW.current_stage, OLD.stage_status, NEW.stage_status, auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vehicle_positioning_timeline (
      tenant_id, positioning_id, event_type, title, description,
      new_status, service_name, actor_id
    ) VALUES (
      NEW.tenant_id, NEW.positioning_id, 'servico', 'Serviço adicionado',
      COALESCE(NULLIF(BTRIM(NEW.observation), ''), 'Status inicial: ' || NEW.status),
      NEW.status, NEW.service_name, auth.uid()
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.observation IS DISTINCT FROM NEW.observation THEN
    timeline_description := CASE
      WHEN OLD.observation IS DISTINCT FROM NEW.observation AND NULLIF(BTRIM(NEW.observation), '') IS NOT NULL THEN BTRIM(NEW.observation)
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'Status alterado de ' || OLD.status || ' para ' || NEW.status || '.'
      ELSE 'Observação removida do serviço.'
    END;

    INSERT INTO public.vehicle_positioning_timeline (
      tenant_id, positioning_id, event_type, title, description,
      old_status, new_status, service_name, actor_id
    ) VALUES (
      NEW.tenant_id, NEW.positioning_id,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'servico_status' ELSE 'servico_observacao' END,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'Serviço atualizado' ELSE 'Observação do serviço atualizada' END,
      timeline_description, OLD.status, NEW.status, NEW.service_name, auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
