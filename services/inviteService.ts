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

  const response = await withTimeoutReject(
    fetch('/api/auth/activate-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        inviteToken: params.inviteToken || undefined,
      }),
    }),
    15000,
    'Tempo esgotado ao ativar convite no servidor.',
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao ativar convite no servidor.');
  }
  return payload as { ok: boolean; userId?: string; message?: string };
};

export const ensureInviteAccess = async (token?: string | null, emailHint?: string | null) => {
  const trimmed = String(token || '').trim();
  let lastError: Error | null = null;

  // Com token: aceitar primeiro (mais confiavel que sync por e-mail).
  if (trimmed) {
    try {
      const result = await withTimeoutReject(
        acceptInvite(trimmed),
        10000,
        'Tempo esgotado ao aceitar convite.',
      );
      if (result) return result;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error?.message || error));
      const message = (error?.message || '').toLowerCase();
      if (
        !message.includes('invalido') &&
        !message.includes('utilizado') &&
        !message.includes('tempo esgotado') &&
        !message.includes('outro e-mail') &&
        !message.includes('autenticado')
      ) {
        // continua para sync/API
      }
    }
  }

  try {
    const synced = await withTimeoutReject(
      syncInviteMembership(),
      10000,
      'Tempo esgotado ao vincular convite. Tente novamente.',
    );
    if (synced?.status === 'linked' || synced?.status === 'already_member' || synced?.status === 'accepted') {
      return synced;
    }
    if (synced?.status === 'no_invite' && !trimmed && !emailHint) {
      return synced;
    }
  } catch (error: any) {
    lastError = error instanceof Error ? error : new Error(String(error?.message || error));
  }

  // Fallback server-side (service role): confirma e-mail + cria membership.
  const email =
    String(emailHint || '').trim().toLowerCase() ||
    String((await (supabase.auth as any).getUser())?.data?.user?.email || '').trim().toLowerCase();

  if (email) {
    try {
      await activateInviteViaApi({ email, inviteToken: trimmed || null });
      const syncedAfter = await withTimeoutReject(
        syncInviteMembership(),
        8000,
        'Tempo esgotado ao confirmar vinculo.',
      ).catch(() => null);
      if (syncedAfter?.status === 'linked' || syncedAfter?.status === 'already_member') {
        return syncedAfter;
      }
      return { status: 'linked', via: 'api' };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error?.message || error));
    }
  }

  if (lastError) throw lastError;
  return { status: 'no_invite' };
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
