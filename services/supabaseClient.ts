
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Recupera as variáveis, tratando o caso de undefined para evitar crash no createClient
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("AutoClaims Pro: Variáveis de ambiente do Supabase não detectadas. Algumas funcionalidades podem estar limitadas.");
}

// Inicializa com placeholders caso as chaves não existam para não quebrar o runtime global
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
