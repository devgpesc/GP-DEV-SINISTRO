
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
const envKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

if (!envUrl || !envKey) {
  console.warn('[EventsCar] Variáveis de ambiente Supabase não detectadas.');
}

export const isSupabaseConfigured = !!(envUrl && envKey);

const supabaseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) 
  ? envUrl 
  : 'https://demo.supabase.co';

const supabaseAnonKey = (envKey && typeof envKey === 'string' && envKey.trim().length > 0) 
  ? envKey 
  : 'demo-key';

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
    if (e.message === 'Timeout') return true; 
    return false;
  }
};
