export const PENDING_REGISTRATION_STORAGE_KEY = 'sb-autoclaims-pending-registration';

export type PendingRegistration = {
  email?: string;
  name?: string;
  companyName?: string;
  inviteToken?: string;
  createdAt?: string;
};

export const savePendingRegistration = (payload: Omit<PendingRegistration, 'createdAt'>) => {
  localStorage.setItem(
    PENDING_REGISTRATION_STORAGE_KEY,
    JSON.stringify({ ...payload, createdAt: new Date().toISOString() }),
  );
};

export const readPendingRegistration = (): PendingRegistration | null => {
  const raw = localStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
    return null;
  }
};

export const clearPendingRegistration = () => {
  localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
};

const INVITE_TOKEN_STORAGE_KEY = 'sb-autoclaims-invite-token';

/** Persiste em localStorage para sobreviver ao redirect OAuth do Google. */
export const saveInviteToken = (token: string) => {
  const value = String(token || '').trim();
  if (!value) return;
  try {
    localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
};

export const readInviteToken = (): string | null => {
  try {
    const fromLocal = localStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const clearInviteToken = () => {
  try {
    localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
