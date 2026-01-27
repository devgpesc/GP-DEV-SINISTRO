
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Função auxiliar para leitura segura de variáveis de ambiente (Vite/Process)
const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  
  // Tenta ler do import.meta.env (Vite) ou process.env (Node/Shim)
  const val = (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
  
  if (!val) {
    // Fallback de segurança caso as envs falhem no carregamento
    if (key === 'VITE_SUPABASE_URL') return 'https://yxawavenbognqiihaesh.supabase.co';
    if (key === 'VITE_SUPABASE_ANON_KEY') return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXdhdmVuYm9nbnFpaWhhZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzE0MTksImV4cCI6MjA1NjgwNzQxOX0.y3X_uY3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W'; 
  }
  return val;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!supabaseUrl && supabaseUrl.includes('supabase.co');

// Cliente Supabase Singleton
// detectSessionInUrl: true é CRUCIAL para que o OAuth funcione automaticamente
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, 
  },
});

// Mock Storage para dados da aplicação (não afeta Auth do Supabase)
const STORAGE_PREFIX = 'autoclaims_app_data_';
export const mockStorage = {
  get: (key: string) => {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  },
  remove: (key: string) => {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  },
  clearAll: () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
};
