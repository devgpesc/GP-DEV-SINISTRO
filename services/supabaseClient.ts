
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
    // Timeout de 5s para não prender a UI
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    // Tenta uma query leve em uma tabela que certamente existe (events ou profiles)
    // Usamos 'head: true' para não baixar dados, apenas verificar existência/acesso
    const queryPromise = supabase.from('events').select('id', { count: 'exact', head: true });

    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
        // Se tem 'code', é um erro do Postgres/Supabase (Ex: 42P01 tabela não existe, 401 permissão)
        // Isso significa que CONECTAMOS ao servidor com sucesso.
        if (error.code) {
            console.warn('[Connection Check] Conectado com erro SQL:', error.code, error.message);
            return true;
        }

        const msg = error.message?.toLowerCase() || '';
        // Se for erro de rede (fetch failed, network error), aí sim é Offline
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('failed')) {
            console.error('[Connection Check] Falha de Rede:', error);
            return false;
        }
    }
    
    // Sem erro ou erro de SQL = Online
    return true;
  } catch (e: any) {
    console.error('[Connection Check] Exceção:', e);
    // Timeout assume offline para não travar, mas idealmente o Dashboard tenta buscar dados mesmo assim
    return false;
  }
};
