
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Função auxiliar para acesso seguro ao ambiente
const getSafeEnv = (key: string): string => {
  try {
    return (typeof process !== 'undefined' && process.env && process.env[key]) || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Inicializa com URLs válidas (mesmo que placeholders) para evitar erro interno do Supabase SDK
// O Supabase exige que a URL comece com http/https.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

if (!isSupabaseConfigured) {
  console.warn("AutoClaims Pro: Conexão com Supabase não configurada. Verifique as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}
