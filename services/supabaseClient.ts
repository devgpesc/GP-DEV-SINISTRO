
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

/**
 * Credenciais atualizadas conforme o print da Vercel fornecido pelo usuário.
 * URL: https://rkywxqispmhmfrxidouw.supabase.co
 * Key: sb_publishable_MLsoFpBVydFFmez9i8pBVg_xE0YgjT9
 * 
 * NOTA: A chave informada parece ser do Stripe. No Supabase, a chave correta 
 * está em Project Settings -> API -> anon public (começa com eyJ...).
 */
const PROVIDED_URL = 'https://rkywxqispmhmfrxidouw.supabase.co';
const PROVIDED_KEY = 'sb_publishable_MLsoFpBVydFFmez9i8pBVg_xE0YgjT9';

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any).env;
  const procEnv = (typeof process !== 'undefined' ? (process.env as any) : {});
  
  const envValue = (metaEnv?.[key] as string) || (procEnv?.[key] as string);
  
  if (envValue) return envValue;

  // Fallback para as credenciais exibidas no print
  if (key === 'VITE_SUPABASE_URL') return PROVIDED_URL;
  if (key === 'VITE_SUPABASE_ANON_KEY') return PROVIDED_KEY;

  return '';
};

export const supabaseUrl = getEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder.supabase.co')
);

if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.log(`[AutoClaims] Supabase conectado: ${supabaseUrl}`);
    // Alerta de chave possivelmente errada (Stripe detectado)
    if (supabaseAnonKey.startsWith('sb_')) {
      console.error("[AutoClaims] ERRO DE CONFIGURAÇÃO: A VITE_SUPABASE_ANON_KEY no seu print da Vercel é uma chave do STRIPE. Você deve substituí-la pela chave 'anon public' encontrada no menu API do Supabase.");
    }
  }
}

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
