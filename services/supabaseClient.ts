
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const getSafeEnv = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const env = (window as any).process?.env || {};
  return env[key] || '';
};

export const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// Cliente Supabase Oficial
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder'
);

// Fallback robusto para desenvolvimento sem chaves
export const mockStorage = {
  get: (key: string) => {
    const data = localStorage.getItem(`autoclaims_${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`autoclaims_${key}`, JSON.stringify(value));
  }
};
