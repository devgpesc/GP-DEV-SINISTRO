-- Permite apagar usuarios Auth sem "Database error deleting user" (FKs sem ON DELETE).
-- Execute no SQL Editor do projeto yxawavenbognqiihaesh.

BEGIN;

-- 1) Ajustar FKs conhecidas que bloqueiam exclusao
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
    ALTER TABLE public.events
      ADD CONSTRAINT events_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_history') THEN
    ALTER TABLE public.event_history DROP CONSTRAINT IF EXISTS event_history_user_id_fkey;
    ALTER TABLE public.event_history
      ADD CONSTRAINT event_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
    ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_created_by_fkey;
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_tenants') THEN
    ALTER TABLE public.saas_tenants DROP CONSTRAINT IF EXISTS saas_tenants_owner_id_fkey;
    ALTER TABLE public.saas_tenants
      ADD CONSTRAINT saas_tenants_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
    ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Funcao de limpeza completa (service_role / SQL Editor)
CREATE OR REPLACE FUNCTION public.admin_purge_auth_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r RECORD;
  sql text;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id obrigatorio';
  END IF;

  -- Solta ownership
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_tenants') THEN
    UPDATE public.saas_tenants SET owner_id = NULL WHERE owner_id = target_user_id;
  END IF;

  -- Nullifica FKs publicas que apontam para auth.users
  FOR r IN
    SELECT tc.table_schema, tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public'
  LOOP
    IF r.delete_rule IN ('CASCADE', 'SET NULL', 'SET DEFAULT') THEN
      CONTINUE;
    END IF;
    sql := format(
      'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
      r.table_schema, r.table_name, r.column_name, r.column_name
    );
    BEGIN
      EXECUTE sql USING target_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Coluna NOT NULL: tenta delete das linhas
      BEGIN
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name
        ) USING target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Nao foi possivel limpar %.%.%: %', r.table_schema, r.table_name, r.column_name, SQLERRM;
      END;
    END;
  END LOOP;

  -- Nullifica FKs que apontam para profiles(id)
  FOR r IN
    SELECT tc.table_schema, tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND tc.table_schema = 'public'
      AND tc.table_name <> 'profiles'
  LOOP
    IF r.delete_rule IN ('CASCADE', 'SET NULL', 'SET DEFAULT') THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format(
        'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
        r.table_schema, r.table_name, r.column_name, r.column_name
      ) USING target_user_id;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name
        ) USING target_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Nao foi possivel limpar profile-ref %.%.%: %', r.table_schema, r.table_name, r.column_name, SQLERRM;
      END;
    END;
  END LOOP;

  DELETE FROM public.organization_members WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', target_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_auth_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_auth_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_purge_auth_user(uuid) TO postgres;

COMMIT;

-- 3) Limpeza imediata dos dois e-mails (Elton + Ludimila)
-- Rode depois do COMMIT acima (ou rode so este bloco apos aplicar a funcao):
-- SELECT public.admin_purge_auth_user('073d1f45-f3dd-4e78-9677-9871a1ed69bd');
-- SELECT public.admin_purge_auth_user('f3e9fcd8-438b-4b72-8c14-b681b7e03fee');
