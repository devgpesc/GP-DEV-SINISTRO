import { SaasTenant } from '../types';

type ProfileLike = {
  role?: string;
  permissions?: Record<string, boolean>;
} | null;

type MembershipLike = {
  tenant_id: string;
  role?: string;
} | null;

export type AccessProfile = {
  /** Membro ativo da empresa — acesso operacional completo por padrão */
  canUseOperations: boolean;
  /** Aprovar OCs e ver fila financeira */
  canApprovePurchases: boolean;
  /** Relatórios BI / executivos */
  canViewReports: boolean;
  /** Configurações da empresa e equipe */
  canManageSettings: boolean;
  canManageTeam: boolean;
  isTenantManager: boolean;
  isSuperAdmin: boolean;
};

export const resolveAccessProfile = (
  profile: ProfileLike,
  memberships: MembershipLike[],
  currentTenant: SaasTenant | null,
): AccessProfile => {
  const isSuperAdmin = profile?.role === 'super_admin';
  const isExecutiveRole =
    profile?.role === 'Admin' || profile?.role === 'Gerente' || isSuperAdmin;

  const currentMembership = currentTenant
    ? memberships.find((m) => m?.tenant_id === currentTenant.id)
    : memberships[0];

  const membershipRole = currentMembership?.role;
  const isTenantManager =
    isExecutiveRole ||
    membershipRole === 'owner' ||
    membershipRole === 'admin';

  const hasTenantAccess = memberships.length > 0 || isSuperAdmin;

  const permissions = profile?.permissions || {};

  return {
    canUseOperations: hasTenantAccess,
    canApprovePurchases:
      isTenantManager || !!permissions.approve_purchases,
    canViewReports: isTenantManager || !!permissions.view_reports,
    canManageSettings: isTenantManager || isSuperAdmin,
    canManageTeam: isTenantManager || !!permissions.manage_users,
    isTenantManager,
    isSuperAdmin,
  };
};
