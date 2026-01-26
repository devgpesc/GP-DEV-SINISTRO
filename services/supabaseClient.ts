
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * AutoClaims Pro - Configuração de Backend
 * Suporta o novo formato de chaves do Supabase (sb_*) e o legado (eyJ*).
 */

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  const val = (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
  
  // Fallback manual para as chaves do seu projeto
  if (!val) {
    if (key === 'VITE_SUPABASE_URL') return 'https://rkywxqispmhmfrxidouw.supabase.co';
    if (key === 'VITE_SUPABASE_ANON_KEY') return 'sb_publishable_nzikPNdcvvIDzZvCDajb1Q_R3-f9WY3';
  }
  
  return val;
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

/**
 * Validação de Configuração:
 * O Supabase agora utiliza chaves com prefixo 'sb_publishable_'.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  (supabaseAnonKey.startsWith('sb_') || supabaseAnonKey.startsWith('eyJ'))
);

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.log(`[AutoClaims] Conexão Supabase estabelecida com as novas chaves do projeto.`);
  } else {
    console.warn("[AutoClaims] Rodando em Modo de Demonstração (Sem chaves API).");
  }
}

// Inicializa o cliente com a configuração validada
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
    // Remove apenas as chaves do nosso aplicativo
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    // Tenta remover chaves específicas do Supabase se existirem no formato padrão
    Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase.auth.token')) {
            localStorage.removeItem(key);
        }
    });
  }
};
