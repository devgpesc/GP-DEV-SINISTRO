-- Evitar dependencia circular na leitura de organization_members
BEGIN;

DROP POLICY IF EXISTS "View Own Memberships" ON public.organization_members;
CREATE POLICY "View Own Memberships" ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());

-- Admins da empresa podem ver membros do proprio tenant (via helper SECURITY DEFINER)
DROP POLICY IF EXISTS "Tenant admins view members" ON public.organization_members;
CREATE POLICY "Tenant admins view members" ON public.organization_members
FOR SELECT
USING (public.is_tenant_admin(tenant_id, auth.uid()));

COMMIT;
