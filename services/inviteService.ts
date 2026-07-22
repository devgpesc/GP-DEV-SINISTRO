import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getAppOrigin } from './authRedirect';

export type InviteDetails = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  status: string;
  token?: string;
};

const INVITE_LOOKUP_TIMEOUT_MS = 8000;

export const buildInviteRegisterUrl = (token: string) =>
  `${getAppOrigin()}/register?invite=${encodeURIComponent(token)}`;

export const buildInviteLoginUrl = (token: string) =>
  `${getAppOrigin()}/login?invite=${encodeURIComponent(token)}`;

const withTimeoutReject = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const assertSupabaseReady = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Configuracao do sistema indisponivel. Contate o administrador.');
  }
};

export const getInviteDetails = async (token: string): Promise<InviteDetails | null> => {
  assertSupabaseReady();
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;

  return withTimeoutReject(
    (async () => {
      const { data, error } = await supabase.rpc('get_invite_details', { invite_token: trimmed });
      if (error) throw error;
      return data as InviteDetails | null;
    })(),
    INVITE_LOOKUP_TIMEOUT_MS,
    'Tempo esgotado ao validar o convite. Verifique sua conexao e tente novamente.',
  );
};

export const getMyPendingInvite = async (): Promise<InviteDetails | null> => {
  assertSupabaseReady();

  return withTimeoutReject(
    (async () => {
      const { data, error } = await supabase.rpc('get_my_pending_invite');
      if (error) throw error;
      return data as InviteDetails | null;
    })(),
    INVITE_LOOKUP_TIMEOUT_MS,
    'Tempo esgotado ao buscar convite. Tente novamente.',
  );
};

export const acceptInvite = async (token: string) => {
  assertSupabaseReady();
  const { data, error } = await supabase.rpc('accept_invite', { invite_token: token });
  if (error) {
    const message = (error.message || '').toLowerCase();
    if (message.includes('outro e-mail')) {
      throw new Error('Este convite foi enviado para outro e-mail. Use a conta correspondente ou solicite um novo convite.');
    }
    if (message.includes('invalido') || message.includes('utilizado')) {
      throw new Error('Convite invalido ou ja utilizado. Solicite um novo convite ao administrador.');
    }
    throw error;
  }
  return data;
};

/** Aceita convite sem falhar se ja foi processado e o usuario ja tem acesso. */
export const acceptInviteSafe = async (token: string) => {
  try {
    return await acceptInvite(token);
  } catch (error: any) {
    const message = (error?.message || '').toLowerCase();
    if (!message.includes('invalido') && !message.includes('utilizado')) {
      throw error;
    }
    return null;
  }
};

export const syncInviteMembership = async () => {
  assertSupabaseReady();
  const { data, error } = await supabase.rpc('sync_invite_membership');
  if (error) throw error;
  return data as { status: string; tenant_id?: string; role?: string } | null;
};

export const activateInviteViaApi = async (params: {
  email: string;
  inviteToken?: string | null;
}) => {
  const email = String(params.email || '').trim().toLowerCase();
  if (!email) throw new Error('E-mail obrigatorio para ativar o convite.');

  const { data: sessionData } = await (supabase.auth as any).getSession();
  const accessToken = sessionData?.session?.access_token;

  const response = await withTimeoutReject(
    fetch('/api/auth/activate-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        email,
        inviteToken: params.inviteToken || undefined,
      }),
    }),
    20000,
    'Tempo esgotado ao ativar convite no servidor.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao ativar convite no servidor.');
  }
  return payload as {
    ok: boolean;
    userId?: string;
    message?: string;
    membershipLinked?: boolean;
    membershipCount?: number;
  };
};

export const repairSessionAccess = async () => {
  const { data: sessionData } = await (supabase.auth as any).getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao obrigatoria para reparar acesso.');

  const response = await withTimeoutReject(
    fetch('/api/auth/session-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: '{}',
    }),
    12000,
    'Tempo esgotado ao reparar acesso da sessao.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao reparar acesso da sessao.');
  }
  return payload as {
    ok: boolean;
    userId: string;
    email?: string;
    membershipCount: number;
    memberships: Array<{
      id: string;
      tenant_id: string;
      user_id: string;
      role: string;
      permissions?: Record<string, boolean>;
      module_permissions?: Record<string, boolean>;
      created_at?: string;
    }>;
    tenants: any[];
    repaired?: boolean;
  };
};

export const ensureInviteAccess = async (token?: string | null, emailHint?: string | null) => {
  const trimmed = String(token || '').trim();
  let lastError: Error | null = null;

  // Reparo direto pela sessao (mais confiavel que RPC + RLS).
  try {
    const repaired = await repairSessionAccess();
    if ((repaired.membershipCount || 0) > 0) {
      return {
        status: 'linked',
        via: 'session-access',
        tenant_id: repaired.memberships[0]?.tenant_id,
        role: repaired.memberships[0]?.role,
      };
    }
  } catch (error: any) {
    lastError = error instanceof Error ? error : new Error(String(error?.message || error));
  }

  if (trimmed) {
    try {
      const result = await withTimeoutReject(
        acceptInvite(trimmed),
        8000,
        'Tempo esgotado ao aceitar convite.',
      );
      if (result) {
        // Confirma via repair se o SELECT/RPC deixou membership.
        try {
          const repaired = await repairSessionAccess();
          if ((repaired.membershipCount || 0) > 0) {
            return {
              status: 'linked',
              via: 'accept+session-access',
              tenant_id: repaired.memberships[0]?.tenant_id,
              role: repaired.memberships[0]?.role,
            };
          }
        } catch {
          /* ignore */
        }
        return result;
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error?.message || error));
    }
  }

  try {
    const synced = await withTimeoutReject(
      syncInviteMembership(),
      8000,
      'Tempo esgotado ao vincular convite. Tente novamente.',
    );
    if (synced?.status === 'linked' || synced?.status === 'already_member' || synced?.status === 'accepted') {
      return synced;
    }
  } catch (error: any) {
    lastError = error instanceof Error ? error : new Error(String(error?.message || error));
  }

  const { data: userData } = await (supabase.auth as any).getUser();
  const email =
    String(emailHint || '').trim().toLowerCase() ||
    String(userData?.user?.email || '').trim().toLowerCase();

  if (email) {
    try {
      await activateInviteViaApi({ email, inviteToken: trimmed || null });
      const repairedAgain = await repairSessionAccess();
      if ((repairedAgain.membershipCount || 0) > 0) {
        return {
          status: 'linked',
          via: 'api+session-access',
          tenant_id: repairedAgain.memberships[0]?.tenant_id,
          role: repairedAgain.memberships[0]?.role,
        };
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error?.message || error));
    }
  }

  if (lastError) throw lastError;
  return { status: 'no_invite' };
};

export const purgeUserByEmailViaApi = async (params: { email: string; tenantId: string }) => {
  assertSupabaseReady();
  const { data: sessionData } = await (supabase.auth as any).getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao expirada. Faca login novamente.');

  const response = await withTimeoutReject(
    fetch('/api/auth/purge-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        tenantId: params.tenantId,
      }),
    }),
    20000,
    'Tempo esgotado ao limpar conta Auth.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao limpar conta Auth.');
  }
  return payload as {
    ok: boolean;
    deletedCount?: number;
    message?: string;
  };
};

export const deleteMemberViaApi = async (params: {
  userId: string;
  tenantId: string;
  deleteAuthAccount?: boolean;
}) => {
  assertSupabaseReady();
  const { data: sessionData } = await (supabase.auth as any).getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao expirada. Faca login novamente.');

  const response = await withTimeoutReject(
    fetch('/api/auth/delete-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId: params.userId,
        tenantId: params.tenantId,
        deleteAuthAccount: params.deleteAuthAccount !== false,
      }),
    }),
    20000,
    'Tempo esgotado ao excluir membro.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao excluir membro.');
  }
  return payload as { ok: boolean; authDeleted?: boolean; message?: string };
};

export const createMemberViaApi = async (params: {
  email: string;
  password: string;
  name: string;
  role: string;
  tenantId: string;
  userId?: string;
}) => {
  assertSupabaseReady();
  const { data: sessionData } = await (supabase.auth as any).getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao expirada. Faca login novamente.');

  const response = await withTimeoutReject(
    fetch('/api/auth/create-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        name: params.name.trim(),
        role: params.role || 'member',
        tenantId: params.tenantId,
        userId: params.userId || undefined,
      }),
    }),
    20000,
    'Tempo esgotado ao criar membro.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao criar membro.');
  }
  return payload as {
    ok: boolean;
    created?: boolean;
    userId?: string;
    email?: string;
    loginUrl?: string;
    tenantName?: string;
    message?: string;
  };
};

export const createInvitation = async (params: {
  email: string;
  name: string;
  role: string;
  tenantId: string;
}) => {
  assertSupabaseReady();
  const { data, error } = await supabase.rpc('create_invitation', {
    p_email: params.email.trim().toLowerCase(),
    p_name: params.name.trim(),
    p_role: params.role || 'member',
    p_tenant_id: params.tenantId,
  });
  if (error) throw error;
  return data as { token: string; id: string };
};

export const buildInviteMailto = (params: {
  email: string;
  name: string;
  companyName: string;
  registerUrl: string;
  loginUrl: string;
}) => {
  const subject = encodeURIComponent(`Convite para acessar ${params.companyName} - EventsCar`);
  const body = encodeURIComponent(
    `Ola ${params.name},\n\n` +
      `Voce foi convidado(a) para acessar a plataforma EventsCar da empresa ${params.companyName}.\n\n` +
      `Se ainda nao tem conta, cadastre-se pelo link:\n${params.registerUrl}\n\n` +
      `Se ja tem conta (ou ja usou Google), entre pelo link:\n${params.loginUrl}\n\n` +
      `Use o e-mail ${params.email} para aceitar o convite.\n\n` +
      `Atenciosamente,\nEquipe EventsCar`,
  );
  return `mailto:${params.email}?subject=${subject}&body=${body}`;
};
