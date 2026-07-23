/**
 * Storage do Supabase Auth.
 * - Sessao completa: so localStorage (cookie estoura o limite ~4KB e derruba o login).
 * - Code verifier PKCE: cookie curto + localStorage (precisa sobreviver ao redirect OAuth).
 */
const PKCE_COOKIE_MAX_AGE = 60 * 10; // 10 min
const COOKIE_SAFE_MAX = 1500;

const isBrowser = () => typeof window !== 'undefined';

const isPkceKey = (key: string) =>
  key.includes('code-verifier') || key.includes('pkce') || key.endsWith('-code-verifier');

const isAuthCookieName = (name: string) =>
  name.startsWith('sb-') ||
  name.includes('autoclaims') ||
  name.includes('code-verifier') ||
  name.includes('supabase');

const readCookie = (name: string): string | null => {
  if (!isBrowser()) return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string, maxAge = PKCE_COOKIE_MAX_AGE) => {
  if (!isBrowser()) return;
  // Evita cookies gigantes (sessao JWT) — browsers descartam / quebram requests.
  if (value.length > COOKIE_SAFE_MAX) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
};

const deleteCookie = (name: string) => {
  if (!isBrowser()) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
};

/**
 * Remove cookies de auth legados/grandes que estouram o header Cookie
 * e geram "Failed to fetch" em /api/* (mesma origem).
 */
export const purgeOversizedAuthCookies = () => {
  if (!isBrowser()) return;
  try {
    const raw = document.cookie || '';
    if (!raw) return;
    for (const part of raw.split(';')) {
      const eq = part.indexOf('=');
      const name = (eq >= 0 ? part.slice(0, eq) : part).trim();
      if (!name || !isAuthCookieName(name)) continue;
      const value = eq >= 0 ? part.slice(eq + 1).trim() : '';
      // Sessao JWT nunca deve ficar em cookie; PKCE curto pode ficar.
      if (!isPkceKey(name) || value.length > COOKIE_SAFE_MAX) {
        deleteCookie(name);
      }
    }
  } catch {
    /* ignore */
  }
};

if (isBrowser()) {
  purgeOversizedAuthCookies();
}

export const authStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    try {
      const fromLs = window.localStorage.getItem(key);
      if (fromLs != null) return fromLs;
    } catch {
      /* localStorage bloqueado */
    }
    if (isPkceKey(key)) return readCookie(key);
    return null;
  },
  setItem(key: string, value: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    if (isPkceKey(key)) {
      writeCookie(key, value);
    } else {
      // Limpa cookie legado de sessao (versao antiga gravava o JWT no cookie).
      deleteCookie(key);
    }
  },
  removeItem(key: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    deleteCookie(key);
  },
};
