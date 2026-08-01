
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';

// Helper seguro para ler variáveis de ambiente em diferentes ambientes
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key];
  } catch {
    return undefined;
  }
};

const envUrl = getEnv('VITE_SUPABASE_URL');
const cleanEnv = (value?: string) =>
  typeof value === 'string'
    ? value.trim().replace(/^["']|["']$/g, '').replace(/\\r|\\n/g, '')
    : '';

// Preferir JWT anon (eyJ...) — chave sb_publishable_ pode travar auth no browser.
const pickAnonKey = (...candidates: Array<string | undefined>) => {
  const values = candidates.map(cleanEnv).filter((v): v is string => v.length > 0);
  return values.find((v) => v.startsWith('eyJ')) || values[0];
};
const envKey = pickAnonKey(
  getEnv('VITE_SUPABASE_ANON_KEY'),
  getEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
);
const cleanSupabaseUrl = cleanEnv(envUrl).replace(/\/$/, '');

if (!cleanSupabaseUrl || !envKey) {
  throw new Error('Configuração obrigatória do Supabase ausente.');
}

export const isSupabaseConfigured = true;
const supabaseUrl = cleanSupabaseUrl;
const supabaseAnonKey = envKey;

const authConfig = {
  flowType: 'pkce' as const,
  autoRefreshToken: true,
  persistSession: true,
  // AuthCallback.tsx trata ?code= manualmente — evita corrida que trava o OAuth Google.
  detectSessionInUrl: false,
  storageKey: 'sb-autoclaims-auth-token',
  ...(typeof window !== 'undefined' ? { storage: authStorage } : {}),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authConfig,
  global: {
    headers: { 'x-application-name': 'eventscar' },
  },
});

export const checkSupabaseConnection = async () => {
  if (!isSupabaseConfigured) return false;
  try {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
    );
    const queryPromise = supabase.from('events').select('id', { count: 'exact', head: true });
    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
        if (error.code || error.status === 401 || error.status === 403) return true;
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection')) return false;
    }
    return true;
  } catch (e: any) {
    if (e.message === 'Timeout') return false;
    return false;
  }
};
