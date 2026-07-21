-- Reparar usuarios com convite mas sem membership (corrige Ludimila e casos similares)

BEGIN;

INSERT INTO public.organization_members (tenant_id, user_id, role)
SELECT
    i.tenant_id,
    u.id,
    coalesce(nullif(trim(i.role), ''), 'member')
FROM public.invitations i
JOIN auth.users u ON lower(u.email) = lower(i.email)
LEFT JOIN public.organization_members om
       ON om.tenant_id = i.tenant_id
      AND om.user_id = u.id
WHERE om.id IS NULL
  AND i.tenant_id IS NOT NULL
  AND i.status IN ('pending', 'accepted')
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET role = excluded.role;

INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
SELECT
    u.id,
    lower(u.email),
    coalesce(nullif(trim(i.name), ''), split_part(u.email, '@', 1)),
    'Usuário',
    '{}'::jsonb,
    now()
FROM public.invitations i
JOIN auth.users u ON lower(u.email) = lower(i.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND i.status IN ('pending', 'accepted')
ON CONFLICT (id) DO UPDATE
SET
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

COMMIT;
