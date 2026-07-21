import { supabase } from './supabaseClient';
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

export const buildInviteRegisterUrl = (token: string) =>
  `${getAppOrigin()}/register?invite=${encodeURIComponent(token)}`;

export const buildInviteLoginUrl = (token: string) =>
  `${getAppOrigin()}/login?invite=${encodeURIComponent(token)}`;

export const getInviteDetails = async (token: string): Promise<InviteDetails | null> => {
  const { data, error } = await supabase.rpc('get_invite_details', { invite_token: token });
  if (error) throw error;
  return data as InviteDetails | null;
};

export const getMyPendingInvite = async (): Promise<InviteDetails | null> => {
  const { data, error } = await supabase.rpc('get_my_pending_invite');
  if (error) throw error;
  return data as InviteDetails | null;
};

export const acceptInvite = async (token: string) => {
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
  const { data, error } = await supabase.rpc('sync_invite_membership');
  if (error) throw error;
  return data as { status: string; tenant_id?: string; role?: string } | null;
};

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

export const ensureInviteAccess = async (token?: string | null) => {
  try {
    const synced = await withTimeoutReject(
      syncInviteMembership(),
      12000,
      'Tempo esgotado ao vincular convite. Tente novamente.',
    );
    if (synced?.status === 'linked' || synced?.status === 'already_member') {
      return synced;
    }
  } catch (error: any) {
    const message = (error?.message || '').toLowerCase();
    if (!message.includes('tempo esgotado') && !message.includes('no_invite')) {
      throw error;
    }
  }

  if (token) {
    try {
      const result = await withTimeoutReject(acceptInvite(token), 12000, 'Tempo esgotado ao aceitar convite.');
      if (result) return result;
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase();
      if (!message.includes('invalido') && !message.includes('utilizado') && !message.includes('tempo esgotado')) {
        throw error;
      }
    }

    return withTimeoutReject(
      syncInviteMembership(),
      12000,
      'Tempo esgotado ao vincular convite. Tente novamente.',
    );
  }

  return withTimeoutReject(
    syncInviteMembership(),
    12000,
    'Tempo esgotado ao vincular convite. Tente novamente.',
  );
};

export const createInvitation = async (params: {
  email: string;
  name: string;
  role: string;
  tenantId: string;
}) => {
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
      `Se ja tem conta, entre pelo link:\n${params.loginUrl}\n\n` +
      `Use o e-mail ${params.email} para aceitar o convite.\n\n` +
      `Atenciosamente,\nEquipe EventsCar`,
  );
  return `mailto:${params.email}?subject=${subject}&body=${body}`;
};
