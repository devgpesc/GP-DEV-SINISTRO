-- MIGRATION: FIX TENANT READ ACCESS FOR NORMAL USERS
-- Data: 2024-04-05
-- Objetivo: Permitir que usuários normais leiam os tenants aos quais pertencem.

BEGIN;

DROP POLICY IF EXISTS "View Own Tenants" ON public.saas_tenants;

CREATE POLICY "View Own Tenants" ON public.saas_tenants
FOR SELECT USING (
    id IN (SELECT public.get_my_tenant_ids())
);

COMMIT;

NOTIFY pgrst, 'reload config';
