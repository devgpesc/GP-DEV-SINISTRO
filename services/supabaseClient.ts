
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
    // Tenta um select simples para verificar conectividade
    // Usamos 'profiles' pois é uma tabela padrão, mas pode ser qualquer uma existente
    const { error } = await supabase.from('profiles').select('id').limit(1);
    // Se der erro de tabela não existe (404/PGRST204) ou erro de conexão, retorna false
    // Se der erro de permissão (401), a conexão existe, então é true
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        // Se for erro de permissão, consideramos conectado
        return error.code === '401' || error.code === 'PGRST301';
    }
    return true;
  } catch (e) {
    console.error('Supabase connection failed:', e);
    return false;
  }
};
