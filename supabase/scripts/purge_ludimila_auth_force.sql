-- ============================================================
-- PURGE FORCADO: ludimila(r)589@gmail.com
-- Cole no Supabase → SQL Editor → Run
-- Projeto: yxawavenbognqiihaesh
-- ============================================================

-- A) Diagnostico: ver UID e e-mail exato
SELECT id, email, created_at, raw_app_meta_data
FROM auth.users
WHERE email ILIKE '%ludimila%'
ORDER BY created_at;

-- B) Limpeza dinamica + exclusao (rode este bloco inteiro)
DO $$
DECLARE
  target record;
  r record;
  deleted_count int := 0;
BEGIN
  FOR target IN
    SELECT id, email
    FROM auth.users
    WHERE lower(email) IN (
      'ludimila589@gmail.com',
      'ludimilar589@gmail.com'
    )
    OR email ILIKE 'ludimila%589@gmail.com'
  LOOP
    RAISE NOTICE 'Limpando % (%)', target.email, target.id;

    -- 1) Ownership
    BEGIN
      UPDATE public.saas_tenants SET owner_id = NULL WHERE owner_id = target.id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- 2) Memberships / notificacoes
    BEGIN
      DELETE FROM public.organization_members WHERE user_id = target.id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
      DELETE FROM public.notifications WHERE user_id = target.id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- 3) Nullifica TODAS as FKs publicas -> auth.users (mesmo sem ON DELETE)
    FOR r IN
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = 'auth'
        AND ccu.table_name = 'users'
        AND tc.table_schema = 'public'
    LOOP
      BEGIN
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name, r.column_name
        ) USING target.id;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          EXECUTE format(
            'DELETE FROM %I.%I WHERE %I = $1',
            r.table_schema, r.table_name, r.column_name
          ) USING target.id;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Bloqueio auth-ref %.%.%: %', r.table_schema, r.table_name, r.column_name, SQLERRM;
        END;
      END;
    END LOOP;

    -- 4) Nullifica FKs publicas -> profiles(id)
    FOR r IN
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = 'public'
        AND ccu.table_name = 'profiles'
        AND tc.table_schema = 'public'
        AND tc.table_name <> 'profiles'
    LOOP
      BEGIN
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
          r.table_schema, r.table_name, r.column_name, r.column_name
        ) USING target.id;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          EXECUTE format(
            'DELETE FROM %I.%I WHERE %I = $1',
            r.table_schema, r.table_name, r.column_name
          ) USING target.id;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Bloqueio profile-ref %.%.%: %', r.table_schema, r.table_name, r.column_name, SQLERRM;
        END;
      END;
    END LOOP;

    -- 5) Storage (se existir owner)
    BEGIN
      UPDATE storage.objects SET owner = NULL WHERE owner = target.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      DELETE FROM storage.objects WHERE owner_id = target.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- 6) Profile + Auth
    BEGIN
      DELETE FROM public.profiles WHERE id = target.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao apagar profile %: %', target.id, SQLERRM;
    END;

    DELETE FROM auth.identities WHERE user_id = target.id;
    BEGIN
      DELETE FROM auth.sessions WHERE user_id = target.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      DELETE FROM auth.refresh_tokens WHERE user_id = target.id::text;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        DELETE FROM auth.refresh_tokens WHERE user_id = target.id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
    BEGIN
      DELETE FROM auth.mfa_factors WHERE user_id = target.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      DELETE FROM auth.users WHERE id = target.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Ainda bloqueado ao apagar % (%): %', target.email, target.id, SQLERRM;
    END;
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'OK apagado: %', target.email;
  END LOOP;

  IF deleted_count = 0 THEN
    RAISE NOTICE 'Nenhum usuario ludimila* encontrado em auth.users';
  ELSE
    RAISE NOTICE 'Total apagado: %', deleted_count;
  END IF;
END $$;

-- C) Confirmar
SELECT id, email FROM auth.users WHERE email ILIKE '%ludimila%';
-- Esperado: 0 linhas
