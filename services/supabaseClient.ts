
import { createClient } from '@supabase/supabase-js';

// Leitura segura de variáveis de ambiente
const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  return (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://yxawavenbognqiihaesh.supabase.co';
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXdhdmVuYm9nbnFpaWhhZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzE0MTksImV4cCI6MjA1NjgwNzQxOX0.y3X_uY3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W3_Y3W';

export const isSupabaseConfigured = !!supabaseUrl && supabaseUrl.includes('supabase.co');

// Cliente Supabase Singleton
// detectSessionInUrl: true delega o parsing de hash/query params para o SDK
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, 
  },
});

// Mock Storage para dados locais da aplicação (Business Logic apenas)
const STORAGE_PREFIX = 'autoclaims_app_data_';
export const mockStorage = {
  get: (key: string) => {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  },
  remove: (key: string) => {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  },
  clearAll: () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    });
  }
};
