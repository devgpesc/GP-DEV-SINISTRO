
import { createClient } from '@supabase/supabase-js';

// Helper seguro para ler variáveis de ambiente em diferentes ambientes
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key];
  } catch {
    return undefined;
  }
};

const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!envUrl || !envKey) {
  console.warn('[AutoClaims] Variáveis de ambiente Supabase não detectadas.');
}

export const isSupabaseConfigured = !!(envUrl && envKey);

const supabaseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) 
  ? envUrl 
  : 'https://demo.supabase.co';

const supabaseAnonKey = (envKey && typeof envKey === 'string' && envKey.trim().length > 0) 
  ? envKey 
  : 'demo-key';

// Inicializa o cliente com persistência explícita no LocalStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Garante uso do storage do navegador
    storageKey: 'sb-autoclaims-auth-token', // Chave única para evitar conflitos localhost
  },
  global: {
    headers: { 'x-application-name': 'autoclaims-pro' },
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
