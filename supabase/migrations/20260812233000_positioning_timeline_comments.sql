BEGIN;

-- Comentários são registros independentes da timeline. Eles não substituem a
-- observação atual do posicionamento e preservam autoria e data de publicação.
CREATE OR REPLACE FUNCTION public.add_vehicle_positioning_comment(
  p_positioning_id uuid,
  p_comment text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  positioning_tenant_id uuid;
  timeline_id uuid;
  normalized_comment text := btrim(coalesce(p_comment, ''));
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF normalized_comment = '' THEN
    RAISE EXCEPTION 'Escreva um comentário antes de publicar.';
  END IF;

  IF char_length(normalized_comment) > 1000 THEN
    RAISE EXCEPTION 'O comentário deve ter no máximo 1000 caracteres.';
  END IF;

  SELECT vp.tenant_id
    INTO positioning_tenant_id
    FROM public.vehicle_positionings vp
   WHERE vp.id = p_positioning_id
     AND (
       public.is_platform_super_admin(actor)
       OR vp.tenant_id IN (SELECT public.get_my_tenant_ids())
     );

  IF positioning_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Posicionamento não encontrado ou acesso negado.';
  END IF;

  INSERT INTO public.vehicle_positioning_timeline (
    tenant_id,
    positioning_id,
    event_type,
    title,
    description,
    actor_id
  ) VALUES (
    positioning_tenant_id,
    p_positioning_id,
    'comentario',
    'Comentário publicado',
    normalized_comment,
    actor
  )
  RETURNING id INTO timeline_id;

  RETURN timeline_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_vehicle_positioning_comment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_vehicle_positioning_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_initial_vehicle_positioning_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(NEW.observation), '') IS NOT NULL THEN
    INSERT INTO public.vehicle_positioning_timeline (
      tenant_id,
      positioning_id,
      event_type,
      title,
      description,
      actor_id
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      'comentario',
      'Comentário inicial',
      btrim(NEW.observation),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_initial_vehicle_positioning_comment ON public.vehicle_positionings;
CREATE TRIGGER trg_record_initial_vehicle_positioning_comment
AFTER INSERT ON public.vehicle_positionings
FOR EACH ROW
EXECUTE FUNCTION public.record_initial_vehicle_positioning_comment();

NOTIFY pgrst, 'reload schema';

COMMIT;
