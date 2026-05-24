BEGIN;

DROP POLICY IF EXISTS "Admins Full Access" ON public.profiles;
DROP POLICY IF EXISTS "Admin Manage Tenants" ON public.saas_tenants;

DROP POLICY IF EXISTS "Platform Super Admin Profiles" ON public.profiles;
CREATE POLICY "Platform Super Admin Profiles" ON public.profiles
FOR ALL
USING (public.is_platform_super_admin(auth.uid()))
WITH CHECK (public.is_platform_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant Admins Update Members" ON public.profiles;
CREATE POLICY "Tenant Admins Update Members" ON public.profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR public.is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
      FROM public.organization_members target_member
     WHERE target_member.user_id = profiles.id
       AND public.is_tenant_admin(target_member.tenant_id, auth.uid())
  )
)
WITH CHECK (
  id = auth.uid()
  OR public.is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
      FROM public.organization_members target_member
     WHERE target_member.user_id = profiles.id
       AND public.is_tenant_admin(target_member.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Platform Super Admin Tenants" ON public.saas_tenants;
CREATE POLICY "Platform Super Admin Tenants" ON public.saas_tenants
FOR ALL
USING (public.is_platform_super_admin(auth.uid()))
WITH CHECK (public.is_platform_super_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.get_tenant_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.detach_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_platform_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_tenant_owner_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_root_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_tenant_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_member_profile(uuid, uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detach_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_owner_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_root_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
