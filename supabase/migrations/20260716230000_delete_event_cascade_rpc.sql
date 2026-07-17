-- RPC para excluir sinistro com desvinculação segura de registros relacionados

CREATE OR REPLACE FUNCTION public.delete_event_cascade(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'ID do sinistro é obrigatório';
  END IF;

  IF NOT (
    public.is_platform_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.events e
       WHERE e.id = p_event_id
         AND e.tenant_id IN (SELECT public.get_my_tenant_ids())
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este sinistro';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Sinistro não encontrado';
  END IF;

  DELETE FROM public.event_attachments WHERE event_id = p_event_id;
  DELETE FROM public.event_history WHERE event_id = p_event_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'eventId'
  ) THEN
    EXECUTE 'UPDATE public.quotations SET "eventId" = NULL WHERE "eventId" = $1' USING p_event_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'event_id'
  ) THEN
    EXECUTE 'UPDATE public.quotations SET event_id = NULL WHERE event_id = $1' USING p_event_id;
  END IF;

  UPDATE public.purchase_orders SET event_id = NULL WHERE event_id = p_event_id;

  DELETE FROM public.events WHERE id = p_event_id RETURNING id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível excluir o sinistro';
  END IF;

  RETURN json_build_object('id', deleted_id, 'status', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_event_cascade(uuid) TO authenticated;

NOTIFY pgrst, 'reload config';
