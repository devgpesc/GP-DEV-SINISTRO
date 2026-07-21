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

export const saveInviteToken = (token: string) => {
  sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
};

export const readInviteToken = (): string | null => {
  return sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
};

export const clearInviteToken = () => {
  sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
};
