-- Diagnostico + liberacao de escinformaticago@gmail.com
-- Cole no Supabase → SQL Editor → Run

-- 1) Conta Auth
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email ILIKE 'escinformaticago@gmail.com';

-- 2) Memberships atuais
SELECT om.*, t.name AS tenant_name
FROM organization_members om
JOIN auth.users u ON u.id = om.user_id
LEFT JOIN saas_tenants t ON t.id = om.tenant_id
WHERE u.email ILIKE 'escinformaticago@gmail.com';

-- 3) Empresas (procure Grupo Privilege / Privillege)
SELECT id, name, owner_id, status
FROM saas_tenants
WHERE name ILIKE '%priv%' OR name ILIKE '%grupo%'
ORDER BY created_at DESC;

-- 4) Convites desse e-mail
SELECT id, email, status, role, tenant_id, token, created_at
FROM invitations
WHERE email ILIKE 'escinformaticago@gmail.com'
ORDER BY created_at DESC;

-- ============================================================
-- 5) LIBERAR ACESSO (ajuste o tenant_id se necessario)
-- Rode so depois de conferir o id da empresa no passo 3.
-- ============================================================
DO $$
DECLARE
  v_email text := 'escinformaticago@gmail.com';
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario Auth nao encontrado para %', v_email;
  END IF;

  -- Preferencia: empresa cujo nome parece Privilege; senao a mais recente ativa
  SELECT id INTO v_tenant_id
  FROM saas_tenants
  WHERE name ILIKE '%privillege%' OR name ILIKE '%privilege%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id
    FROM saas_tenants
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa encontrada para vincular.';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, updated_at)
  VALUES (
    v_user_id,
    v_email,
    'Elton SC',
    'Usuário',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = coalesce(public.profiles.full_name, EXCLUDED.full_name),
      updated_at = now();

  INSERT INTO public.organization_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'owner';

  UPDATE public.saas_tenants
  SET owner_id = v_user_id
  WHERE id = v_tenant_id;

  UPDATE public.invitations
  SET status = 'cancelled'
  WHERE lower(email) = lower(v_email)
    AND status = 'pending';

  RAISE NOTICE 'OK: user % vinculado como owner da empresa %', v_user_id, v_tenant_id;
END $$;

-- 6) Confirmar
SELECT om.role, t.name, u.email
FROM organization_members om
JOIN auth.users u ON u.id = om.user_id
JOIN saas_tenants t ON t.id = om.tenant_id
WHERE u.email ILIKE 'escinformaticago@gmail.com';
