-- Reparar usuarios com convite sem membership + confirmar e-mails de convidados

BEGIN;

-- 1) Vincular membership a partir do convite mais recente por e-mail/tenant
INSERT INTO public.organization_members (tenant_id, user_id, role)
SELECT DISTINCT ON (i.tenant_id, u.id)
    i.tenant_id,
    u.id,
    coalesce(nullif(trim(i.role), ''), 'member')
FROM public.invitations i
JOIN auth.users u ON lower(u.email) = lower(i.email)
WHERE i.tenant_id IS NOT NULL
  AND i.status IN ('pending', 'accepted')
  AND NOT EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.tenant_id = i.tenant_id
         AND om.user_id = u.id
  )
ORDER BY i.tenant_id, u.id, i.created_at DESC
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 2) Garantir profile basico
INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
SELECT DISTINCT ON (u.id)
    u.id,
    lower(u.email),
    coalesce(nullif(trim(i.name), ''), split_part(u.email, '@', 1)),
    'Usuário',
    '{}'::jsonb,
    now()
FROM public.invitations i
JOIN auth.users u ON lower(u.email) = lower(i.email)
WHERE i.status IN ('pending', 'accepted')
  AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = u.id
  )
ORDER BY u.id, i.created_at DESC
ON CONFLICT (id) DO NOTHING;

-- 3) Confirmar e-mail de usuarios convidados (SMTP de confirmacao falhou)
UPDATE auth.users u
   SET email_confirmed_at = coalesce(u.email_confirmed_at, now()),
       updated_at = now()
 WHERE u.email_confirmed_at IS NULL
   AND EXISTS (
       SELECT 1
         FROM public.invitations i
        WHERE lower(i.email) = lower(u.email)
          AND i.status IN ('pending', 'accepted')
   );

-- 4) Marcar convites como aceitos quando ja existe membership
UPDATE public.invitations i
   SET status = 'accepted'
 WHERE i.status = 'pending'
   AND EXISTS (
       SELECT 1
         FROM auth.users u
         JOIN public.organization_members om ON om.user_id = u.id AND om.tenant_id = i.tenant_id
        WHERE lower(u.email) = lower(i.email)
   );

COMMIT;
