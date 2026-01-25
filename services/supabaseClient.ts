
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Função auxiliar robusta para acesso ao ambiente sem quebrar o runtime
const getSafeEnv = (key: string): string => {
  if (typeof window === 'undefined') return '';
  
  // Tenta acessar via objeto global process (injetado ou shim)
  const env = (window as any).process?.env || {};
  if (env[key]) return env[key];

  // Fallback para possíveis outras formas de injeção (ex: Vercel)
  return '';
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// Inicializa com URLs válidas apenas se configurado corretamente
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'
);

if (!isSupabaseConfigured) {
  console.info("AutoClaims Pro: Rodando em modo de demonstração (Supabase não configurado ou chaves ausentes).");
}
