import { SaasTenant } from '../types';
import {
  ModulePermissionId,
  normalizeModulePermissions,
  normalizePermissions,
} from './permissionKeys';

type ProfileLike = {
  role?: string;
  permissions?: Record<string, boolean>;
} | null;

type MembershipLike = {
  tenant_id: string;
  role?: string;
  permissions?: Record<string, boolean>;
  module_permissions?: Record<string, boolean>;
} | null;

export type AccessProfile = {
  canUseOperations: boolean;
  canApprovePurchases: boolean;
  canCancelPurchases: boolean;
  canDeleteRecords: boolean;
  canViewFinancial: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canManageTeam: boolean;
  isTenantManager: boolean;
  isSuperAdmin: boolean;
  modulePermissions: Record<ModulePermissionId, boolean>;
  canAccessDashboard: boolean;
  canAccessEvents: boolean;
  canAccessQuotations: boolean;
  canAccessPurchases: boolean;
  canAccessDeliveries: boolean;
  canAccessAssociates: boolean;
  canAccessSuppliers: boolean;
  canAccessVehicles: boolean;
  canAccessCatalog: boolean;
  canAccessNotifications: boolean;
};

const moduleFlag = (
  modules: Record<ModulePermissionId, boolean>,
  id: ModulePermissionId,
  isTenantManager: boolean,
  isSuperAdmin: boolean,
) => isSuperAdmin || isTenantManager || !!modules[id];

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

  const permissions = normalizePermissions(
    currentMembership?.permissions ?? profile?.permissions,
  );
  const modulePermissions = normalizeModulePermissions(
    currentMembership?.module_permissions,
  );

  return {
    canUseOperations: hasTenantAccess,
    canApprovePurchases: isTenantManager || !!permissions.approve_purchases,
    canCancelPurchases: isTenantManager || !!permissions.approve_purchases,
    canDeleteRecords: isTenantManager || !!permissions.delete_records,
    canViewFinancial: isTenantManager || !!permissions.financial_view,
    canViewReports:
      isTenantManager ||
      !!permissions.view_reports ||
      moduleFlag(modulePermissions, 'relatorios', isTenantManager, isSuperAdmin),
    canManageSettings:
      isTenantManager ||
      isSuperAdmin ||
      moduleFlag(modulePermissions, 'configuracoes', false, isSuperAdmin),
    canManageTeam: isTenantManager || !!permissions.manage_users,
    isTenantManager,
    isSuperAdmin,
    modulePermissions,
    canAccessDashboard: moduleFlag(modulePermissions, 'dashboard', isTenantManager, isSuperAdmin),
    canAccessEvents: moduleFlag(modulePermissions, 'eventos', isTenantManager, isSuperAdmin),
    canAccessQuotations: moduleFlag(modulePermissions, 'cotacoes', isTenantManager, isSuperAdmin),
    canAccessPurchases: moduleFlag(modulePermissions, 'compras', isTenantManager, isSuperAdmin),
    canAccessDeliveries: moduleFlag(modulePermissions, 'entregas', isTenantManager, isSuperAdmin),
    canAccessAssociates: moduleFlag(modulePermissions, 'associados', isTenantManager, isSuperAdmin),
    canAccessSuppliers: moduleFlag(modulePermissions, 'fornecedores', isTenantManager, isSuperAdmin),
    canAccessVehicles: moduleFlag(modulePermissions, 'veiculos', isTenantManager, isSuperAdmin),
    canAccessCatalog: moduleFlag(modulePermissions, 'catalogo', isTenantManager, isSuperAdmin),
    canAccessNotifications: moduleFlag(
      modulePermissions,
      'notificacoes',
      isTenantManager,
      isSuperAdmin,
    ),
  };
};

export const accessForModulePath = (access: AccessProfile, pathname: string): boolean => {
  if (pathname === '/' || pathname === '') return access.canAccessDashboard;
  if (pathname.startsWith('/eventos')) return access.canAccessEvents;
  if (pathname.startsWith('/cotacoes')) return access.canAccessQuotations;
  if (pathname.startsWith('/compras')) return access.canAccessPurchases;
  if (pathname.startsWith('/entregas')) return access.canAccessDeliveries;
  if (pathname.startsWith('/associados')) return access.canAccessAssociates;
  if (pathname.startsWith('/fornecedores')) return access.canAccessSuppliers;
  if (pathname.startsWith('/veiculos')) return access.canAccessVehicles;
  if (pathname.startsWith('/catalogo')) return access.canAccessCatalog;
  if (pathname.startsWith('/relatorios')) return access.canViewReports;
  if (pathname.startsWith('/configuracoes')) return access.canManageSettings;
  if (pathname.startsWith('/notificacoes')) return access.canAccessNotifications;
  return true;
};
