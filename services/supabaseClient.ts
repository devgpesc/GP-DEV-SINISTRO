/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Helper para mock storage local (usado quando Supabase não está configurado ou para dados locais)
export const mockStorage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(`autoclaims_${key}`);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn('Erro ao ler do localStorage', e);
      return null;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`autoclaims_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage', e);
    }
  }
};

let client;

if (isSupabaseConfigured) {
  // Configuração Otimizada para React + Vite
  // auth.persistSession: true (Default) -> Usa LocalStorage automaticamente.
  // auth.detectSessionInUrl: true (Default) -> O SDK captura o #access_token automaticamente.
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage, // Explicito para clareza
    },
    // Otimização de Retries em redes instáveis
    global: {
      headers: { 'x-application-name': 'autoclaims-pro' },
    },
  });
} else {
  console.warn('[AutoClaims] Supabase não configurado. Rodando em modo limitado (Mock).');
  // Cliente Mock Mínimo para evitar crash em chamadas básicas
  client = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      eq: function() { return this; },
      order: function() { return this; },
      single: function() { return Promise.resolve({ data: null, error: null }); },
      maybeSingle: function() { return Promise.resolve({ data: null, error: null }); },
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase não configurado' } }),
      signInWithOAuth: () => Promise.resolve({ error: { message: 'Supabase não configurado' } }),
      signOut: () => Promise.resolve({ error: null }),
    }
  } as any;
}

export const supabase = client;

// Helper para verificar status da conexão (usado apenas em health checks)
export const checkSupabaseConnection = async () => {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('saas_tenants').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
};