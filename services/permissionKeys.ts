/** Permissões granulares persistidas em profiles.permissions (JSONB). */
export const CANONICAL_PERMISSIONS = [
  {
    id: 'financial_view',
    label: 'Ver Financeiro',
    desc: 'Visualizar valores, custos e indicadores financeiros.',
  },
  {
    id: 'approve_purchases',
    label: 'Aprovar Compras',
    desc: 'Aprovar e cancelar Ordens de Compra (OC).',
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

const LEGACY_PERMISSION_MAP: Record<string, CanonicalPermissionId> = {
  relatorios: 'view_reports',
  compras: 'approve_purchases',
};

/** Converte chaves legadas do modal antigo para o formato canônico. */
export const normalizePermissions = (
  raw: Record<string, boolean> | null | undefined,
): Record<CanonicalPermissionId, boolean> => {
  const source = raw || {};
  const normalized = {} as Record<CanonicalPermissionId, boolean>;

  for (const { id } of CANONICAL_PERMISSIONS) {
    normalized[id] = !!source[id];
  }

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_PERMISSION_MAP)) {
    if (source[legacyKey]) {
      normalized[canonicalKey] = true;
    }
  }

  return normalized;
};

/** Mantém apenas chaves canônicas ao salvar no banco. */
export const sanitizePermissionsForSave = (
  raw: Record<string, boolean> | null | undefined,
): Record<CanonicalPermissionId, boolean> => normalizePermissions(raw);
