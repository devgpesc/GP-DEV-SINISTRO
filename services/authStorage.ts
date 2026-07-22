/**
 * Storage do Supabase Auth.
 * - Sessao completa: so localStorage (cookie estoura o limite ~4KB e derruba o login).
 * - Code verifier PKCE: cookie curto + localStorage (precisa sobreviver ao redirect OAuth).
 */
const PKCE_COOKIE_MAX_AGE = 60 * 10; // 10 min

const isBrowser = () => typeof window !== 'undefined';

const isPkceKey = (key: string) =>
  key.includes('code-verifier') || key.includes('pkce') || key.endsWith('-code-verifier');

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
  if (value.length > 1500) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
};

const deleteCookie = (name: string) => {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

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
