export const ROOT_PLATFORM_ADMIN_EMAIL = 'devgpesc@gmail.com';

export const isRootPlatformAdminEmail = (email?: string | null) =>
  String(email || '').trim().toLowerCase() === ROOT_PLATFORM_ADMIN_EMAIL;

export const resolvePlatformRole = (email?: string | null, role?: string | null) => {
  if (isRootPlatformAdminEmail(email)) return 'super_admin';
  return role || 'Usuário';
};
