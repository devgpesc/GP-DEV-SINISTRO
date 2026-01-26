
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * AutoClaims Pro - Configuração de Produção (Supabase)
 * Projeto: nzikpndcvvidzzvcdajb
 */

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  const val = (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
  
  if (!val) {
    if (key === 'VITE_SUPABASE_URL') return 'https://nzikpndcvvidzzvcdajb.supabase.co';
    if (key === 'VITE_SUPABASE_ANON_KEY') return 'sb_publishable_nzikPNdcvvIDzZvCDajb1Q_R3-f9WY3';
  }
  
  return val;
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Fix: Export isSupabaseConfigured to satisfy imports in other files
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Em produção, assumimos que as chaves devem existir.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[AutoClaims] ERRO CRÍTICO: Chaves do Supabase não configuradas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Utilitário de Storage Local para Cache (não mais para modo demo)
 */
const STORAGE_PREFIX = 'autoclaims_';
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
      if (key.startsWith(STORAGE_PREFIX) || key.includes('supabase.auth.token')) {
        localStorage.removeItem(key);
      }
    });
  }
};
