-- Garante leitura de tenants pelos membros (cadastro/login)
BEGIN;

DROP POLICY IF EXISTS "Members can view linked tenants" ON public.saas_tenants;
CREATE POLICY "Members can view linked tenants"
ON public.saas_tenants
FOR SELECT
USING (
  id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid())
  OR owner_id = auth.uid()
  OR public.is_platform_super_admin(auth.uid())
);

-- Leitura propria de memberships (ja deve existir; reafirma)
DROP POLICY IF EXISTS "View Own Memberships" ON public.organization_members;
CREATE POLICY "View Own Memberships" ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());

COMMIT;
