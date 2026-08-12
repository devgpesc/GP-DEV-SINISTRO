/** Permissões granulares por empresa (organization_members.permissions). */
export const CANONICAL_PERMISSIONS = [
  {
    id: 'financial_view',
    label: 'Ver Financeiro',
    desc: 'Visualizar valores, custos e indicadores financeiros.',
  },
  {
    id: 'manage_users',
    label: 'Gerir Equipe',
    desc: 'Convidar, editar e remover usuários da empresa.',
  },
  {
    id: 'delete_records',
    label: 'Exclusão',
    desc: 'Excluir registros permanentemente no sistema.',
  },
  {
    id: 'view_reports',
    label: 'Relatórios BI',
    desc: 'Acessar a central de relatórios e inteligência.',
  },
] as const;

export type CanonicalPermissionId = (typeof CANONICAL_PERMISSIONS)[number]['id'];

/** Módulos do sistema — permissão por empresa (organization_members.module_permissions). */
export const MODULE_PERMISSIONS = [
  { id: 'dashboard', route: '/', label: 'Visão geral', group: 'Menu' },
  { id: 'eventos', route: '/eventos', label: 'Sinistros', group: 'Menu' },
  { id: 'cotacoes', route: '/cotacoes', label: 'Cotações', group: 'Fluxo' },
  { id: 'compras', route: '/compras', label: 'Compras', group: 'Fluxo' },
  { id: 'entregas', route: '/entregas', label: 'Entregas', group: 'Fluxo' },
  { id: 'associados', route: '/associados', label: 'Associados', group: 'Cadastros' },
  { id: 'fornecedores', route: '/fornecedores', label: 'Fornecedores', group: 'Cadastros' },
  { id: 'veiculos', route: '/veiculos', label: 'Veículos', group: 'Cadastros' },
  { id: 'catalogo', route: '/catalogo', label: 'Catálogo', group: 'Cadastros' },
  { id: 'relatorios', route: '/relatorios', label: 'Relatórios', group: 'Extra' },
  { id: 'configuracoes', route: '/configuracoes', label: 'Configurações', group: 'Extra' },
  { id: 'notificacoes', route: '/notificacoes', label: 'Notificações', group: 'Extra' },
] as const;

export type ModulePermissionId = (typeof MODULE_PERMISSIONS)[number]['id'];

export const ALL_MODULE_PERMISSIONS_DEFAULT: Record<ModulePermissionId, boolean> =
  MODULE_PERMISSIONS.reduce((acc, mod) => {
    acc[mod.id] = true;
    return acc;
  }, {} as Record<ModulePermissionId, boolean>);

const LEGACY_PERMISSION_MAP: Record<string, CanonicalPermissionId> = {
  relatorios: 'view_reports',
};

const LEGACY_MODULE_MAP: Record<string, ModulePermissionId> = {
  sinistros: 'eventos',
};

export const normalizePermissions = (
  raw: Record<string, boolean> | null | undefined,
): Record<CanonicalPermissionId, boolean> => {
  const source = raw || {};
  const normalized = {} as Record<CanonicalPermissionId, boolean>;

  for (const { id } of CANONICAL_PERMISSIONS) {
    normalized[id] = !!source[id];
  }

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_PERMISSION_MAP)) {
    if (source[legacyKey]) normalized[canonicalKey] = true;
  }

  return normalized;
};

export const normalizeModulePermissions = (
  raw: Record<string, boolean> | null | undefined,
): Record<ModulePermissionId, boolean> => {
  const source = raw || {};
  const hasAnyKey = Object.keys(source).length > 0;
  const normalized = { ...ALL_MODULE_PERMISSIONS_DEFAULT };

  if (!hasAnyKey) return normalized;

  for (const { id } of MODULE_PERMISSIONS) {
    normalized[id] = !!source[id];
  }

  for (const [legacyKey, moduleKey] of Object.entries(LEGACY_MODULE_MAP)) {
    if (source[legacyKey]) normalized[moduleKey] = true;
  }

  return normalized;
};

export const sanitizePermissionsForSave = (
  raw: Record<string, boolean> | null | undefined,
): Record<CanonicalPermissionId, boolean> => normalizePermissions(raw);

export const sanitizeModulePermissionsForSave = (
  raw: Record<string, boolean> | null | undefined,
): Record<ModulePermissionId, boolean> => {
  const normalized = normalizeModulePermissions(raw);
  return MODULE_PERMISSIONS.reduce((acc, mod) => {
    acc[mod.id] = !!normalized[mod.id];
    return acc;
  }, {} as Record<ModulePermissionId, boolean>);
};

export const moduleIdFromPath = (pathname: string): ModulePermissionId | null => {
  const match = MODULE_PERMISSIONS.find((mod) =>
    mod.route === '/'
      ? pathname === '/'
      : pathname === mod.route || pathname.startsWith(`${mod.route}/`),
  );
  return match?.id ?? null;
};
