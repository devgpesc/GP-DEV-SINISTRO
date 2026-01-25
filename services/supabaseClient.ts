
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * Credenciais fornecidas pelo usuário para o projeto AutoClaims Pro.
 * URL: https://yxawavenbognqiihaesh.supabase.co
 * Key: sb_publishable_MLsoFpBVydFFmez9i8pBVg_xE0YgjT9
 */
const PROVIDED_URL = 'https://yxawavenbognqiihaesh.supabase.co';
const PROVIDED_KEY = 'sb_publishable_MLsoFpBVydFFmez9i8pBVg_xE0YgjT9';

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  
  const envValue = (metaEnv?.[key] as string) || (procEnv?.[key] as string);
  
  if (envValue) return envValue;

  // Fallback para as credenciais fornecidas caso as envs não existam ou sejam placeholders
  if (key === 'VITE_SUPABASE_URL') return PROVIDED_URL;
  if (key === 'VITE_SUPABASE_ANON_KEY') return PROVIDED_KEY;

  return '';
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Validação: Garantir que não estamos usando o domínio de placeholder que causava o erro DNS_NXDOMAIN
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder.supabase.co')
);

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.log(`[AutoClaims] Supabase conectado ao projeto: ${supabaseUrl}`);
    // Aviso técnico amigável caso a chave pareça ser de outro serviço (Stripe)
    if (supabaseAnonKey.startsWith('sb_')) {
      console.warn("[AutoClaims] Aviso: A chave fornecida parece ser uma 'Publishable Key' de outro serviço. Se houver erro 401/403 no login, substitua pela 'anon public' key encontrada no dashboard do Supabase.");
    }
  } else {
    console.warn(`[AutoClaims] Supabase NÃO configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.`);
  }
}

// Inicializa o cliente com as credenciais reais
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Mock storage mantido como segurança para falhas críticas de rede
export const mockStorage = {
  get: (key: string) => {
    const data = localStorage.getItem(`autoclaims_${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`autoclaims_${key}`, JSON.stringify(value));
  },
  append: (key: string, value: any) => {
    const current = mockStorage.get(key) || [];
    const updated = [value, ...current];
    mockStorage.set(key, updated);
    return updated;
  }
};
