BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.permissions IS DISTINCT FROM NEW.permissions
  ) AND NOT (
    public.is_platform_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.user_id = NEW.id
         AND public.is_tenant_admin(om.tenant_id, auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para alterar nivel de acesso.';
  END IF;

  IF NEW.role = 'super_admin' AND NOT public.is_root_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente devgpesc@gmail.com pode conceder Super Admin.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role_permissions ON public.profiles;
CREATE TRIGGER trg_guard_profile_role_permissions
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_role_permissions();

COMMIT;

NOTIFY pgrst, 'reload schema';
