-- Guarda o nome do ator no histórico (evita "Sistema" por RLS em profiles)
CREATE OR REPLACE FUNCTION public.log_purchase_order_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  resolved_actor uuid;
  actor_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    resolved_actor := actor;
    SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuario')
      INTO actor_name
      FROM public.profiles p
     WHERE p.id = resolved_actor;

    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'created',
      NULL,
      NEW.status,
      resolved_actor,
      jsonb_build_object(
        'code', NEW.code,
        'total', NEW.total,
        'supplier_id', NEW.supplier_id,
        'actor_name', coalesce(actor_name, 'Usuario')
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.approval_note IS DISTINCT FROM NEW.approval_note
       OR OLD.approved_by IS DISTINCT FROM NEW.approved_by THEN
      resolved_actor := coalesce(NEW.approved_by, actor);
      SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuario')
        INTO actor_name
        FROM public.profiles p
       WHERE p.id = resolved_actor;

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
        resolved_actor,
        jsonb_build_object(
          'code', NEW.code,
          'approved_at', NEW.approved_at,
          'approval_note', NEW.approval_note,
          'actor_name', coalesce(actor_name, 'Usuario')
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    resolved_actor := actor;
    SELECT coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuario')
      INTO actor_name
      FROM public.profiles p
     WHERE p.id = resolved_actor;

    INSERT INTO public.purchase_order_history (
      purchase_order_id, tenant_id, action, from_status, to_status, user_id, details
    ) VALUES (
      OLD.id,
      OLD.tenant_id,
      'deleted',
      OLD.status,
      NULL,
      resolved_actor,
      jsonb_build_object(
        'code', OLD.code,
        'total', OLD.total,
        'actor_name', coalesce(actor_name, 'Usuario')
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Backfill nomes ja existentes
UPDATE public.purchase_order_history h
SET details = coalesce(h.details, '{}'::jsonb) || jsonb_build_object(
  'actor_name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Usuario')
)
FROM public.profiles p
WHERE h.user_id = p.id
  AND (h.details->>'actor_name' IS NULL OR h.details->>'actor_name' = '');

NOTIFY pgrst, 'reload schema';
