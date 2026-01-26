
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * AutoClaims Pro - Configuração de Produção (Supabase)
 * Projeto Atual: yxawavenbognqiihaesh
 */

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  const val = (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
  
  if (!val) {
    // URL atualizado conforme solicitado pelo usuário
    if (key === 'VITE_SUPABASE_URL') return 'https://yxawavenbognqiihaesh.supabase.co';
    // Nota: A chave anon deve ser a correspondente ao projeto yxawavenbognqiihaesh no painel do Supabase
    if (key === 'VITE_SUPABASE_ANON_KEY') return 'sb_publishable_yxawavenbognqiihaesh'; 
  }
  
  return val;
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Exportação para verificação de estado em outros componentes
export const isSupabaseConfigured = !!supabaseUrl && supabaseUrl.includes('supabase.co');

if (!isSupabaseConfigured) {
  console.error("[AutoClaims] ERRO: URL do Supabase inválido ou não configurado.");
}

// Inicialização do Cliente de Produção
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Utilitário de Limpeza de Cache de Sessão
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
