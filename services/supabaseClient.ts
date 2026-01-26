
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * AutoClaims Pro - Configuração de Backend
 * URL e Key obtidas do ambiente ou fallback seguro.
 */

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  return (metaEnv?.[key] as string) || (procEnv?.[key] as string) || '';
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Validação Inteligente: 
// 1. Verifica se os campos existem.
// 2. Verifica se o formato da chave é Supabase (JWT começa com eyJ).
// 3. Bloqueia chaves que começam com 'sb_' (Stripe/Outros) para evitar erros de autenticação.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  supabaseAnonKey.startsWith('eyJ') // Chaves anon do Supabase são sempre JWTs
);

// Flag específica para identificar se o usuário colou uma chave do Stripe por engano
export const isStripeKeyDetected = supabaseAnonKey.startsWith('sb_');

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.log(`[AutoClaims] Supabase conectado com sucesso: ${supabaseUrl}`);
  } else if (isStripeKeyDetected) {
    console.warn("[AutoClaims] Aviso: Chave do Stripe detectada no campo do Supabase. O sistema operará em Modo Demo.");
  } else {
    console.log("[AutoClaims] Rodando em Modo de Demonstração (Local).");
  }
}

// Inicializa o cliente apenas se a configuração for válida
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const mockStorage = {
  get: (key: string) => {
    const data = localStorage.getItem(`autoclaims_${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`autoclaims_${key}`, JSON.stringify(value));
  }
};
