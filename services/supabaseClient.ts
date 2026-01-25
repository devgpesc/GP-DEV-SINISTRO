
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const getSafeEnv = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const env = (window as any).process?.env || {};
  return env[key] || '';
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// Cliente real ou placeholder
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder-project.supabase.co', 'placeholder-key');

// Helper para persistência em LocalStorage quando offline
export const mockStorage = {
  get: (key: string) => {
    const data = localStorage.getItem(`autoclaims_${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: (key: string, value: any) => {
    localStorage.setItem(`autoclaims_${key}`, JSON.stringify(value));
  },
  append: (key: string, item: any) => {
    const list = mockStorage.get(key) || [];
    const newList = [item, ...list];
    mockStorage.set(key, newList);
    return item;
  }
};
