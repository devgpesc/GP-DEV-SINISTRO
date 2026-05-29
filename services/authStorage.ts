/**
 * Storage híbrido (localStorage + cookie) para o fluxo PKCE.
 * O cookie ajuda a sobreviver ao redirect OAuth na mesma origem.
 */
const cookieMaxAgeSeconds = 60 * 10; // 10 min — tempo típico do fluxo OAuth

const isBrowser = () => typeof window !== 'undefined';

const readCookie = (name: string): string | null => {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string) => {
  if (!isBrowser()) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${cookieMaxAgeSeconds}; SameSite=Lax${secure}`;
};

const deleteCookie = (name: string) => {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const authStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(key) ?? readCookie(key);
    } catch {
      return readCookie(key);
    }
  },
  setItem(key: string, value: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* localStorage indisponível */
    }
    writeCookie(key, value);
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
