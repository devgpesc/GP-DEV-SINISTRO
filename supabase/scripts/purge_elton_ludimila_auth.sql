-- Cole no SQL Editor do Supabase (projeto yxawavenbognqiihaesh) e Execute.
-- Resolve "Failed to delete user: Database error deleting user" limpando FKs antes.

-- 1) Ajuste rapido das FKs mais comunsas
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE public.events
  ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.event_history DROP CONSTRAINT IF EXISTS event_history_user_id_fkey;
ALTER TABLE public.event_history
  ADD CONSTRAINT event_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_created_by_fkey;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.saas_tenants DROP CONSTRAINT IF EXISTS saas_tenants_owner_id_fkey;
ALTER TABLE public.saas_tenants
  ADD CONSTRAINT saas_tenants_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- 2) Apaga Elton + Ludimila (UIDs do Auth)
DO $$
DECLARE
  uids uuid[] := ARRAY[
    '073d1f45-f3dd-4e78-9677-9871a1ed69bd'::uuid,
    'f3e9fcd8-438b-4b72-8c14-b681b7e03fee'::uuid
  ];
  uid uuid;
BEGIN
  FOREACH uid IN ARRAY uids LOOP
    UPDATE public.saas_tenants SET owner_id = NULL WHERE owner_id = uid;
    DELETE FROM public.organization_members WHERE user_id = uid;
    DELETE FROM public.notifications WHERE user_id = uid;

    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = uid;
    UPDATE public.event_history SET user_id = NULL WHERE user_id = uid;
    UPDATE public.events SET created_by = NULL WHERE created_by = uid;
    UPDATE public.purchase_orders SET created_by = NULL WHERE created_by = uid;
    UPDATE public.invitations SET created_by = NULL WHERE created_by = uid;
    UPDATE public.supplier_reviews SET user_id = NULL WHERE user_id = uid;

    DELETE FROM public.profiles WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
  END LOOP;
END $$;
