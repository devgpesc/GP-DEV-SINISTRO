
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[CRITICAL] Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.');
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Usa localStorage APENAS para o token JWT do Supabase Auth
  },
  global: {
    headers: { 'x-application-name': 'autoclaims-pro' },
  },
});

export const mockStorage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }
};

export const checkSupabaseConnection = async () => {
  if (!isSupabaseConfigured) return false;
  try {
    // Tenta um select simples para verificar conectividade na tabela de configurações
    // Usamos timeout no fetch para não travar a UI se a rede estiver pendurada
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    const queryPromise = supabase.from('saas_settings').select('id').limit(1);

    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    // Lógica de Conexão:
    // Se não houver erro, está conectado.
    // Se o erro for de permissão (401), tabela não encontrada (42P01) ou linhas (PGRST116),
    // SIGNIFICA QUE CONECTOU no servidor, apenas a query falhou. Retorna TRUE.
    // Só retorna FALSE se for erro de rede (fetch failed).
    if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection')) {
            console.error('Supabase Network Error:', error);
            return false;
        }
    }
    return true;
  } catch (e) {
    console.error('Supabase connection check failed:', e);
    return false;
  }
};
