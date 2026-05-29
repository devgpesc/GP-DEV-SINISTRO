const DEFAULT_PRODUCTION_ORIGIN = 'https://eventos.escsistemas.com';

/**
 * Origem usada nos redirects de auth.
 * No navegador, SEMPRE usa a origem atual — essencial para PKCE (code_verifier fica por origem).
 */
export const getAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  const fromEnv = (import.meta as any).env?.VITE_APP_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '');

  return DEFAULT_PRODUCTION_ORIGIN;
};

export const getAuthRedirectUrl = (path = '/auth/callback') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
};
