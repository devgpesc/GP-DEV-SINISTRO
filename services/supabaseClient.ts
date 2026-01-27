/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Helper para mock storage local
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

// Mock Query Builder robusto (Thenable)
const createMockBuilder = (data: any = []) => {
  return {
    data,
    select: function() { return this; },
    insert: function() { return Promise.resolve({ data: null, error: null }); },
    update: function() { return Promise.resolve({ data: null, error: null }); },
    delete: function() { return Promise.resolve({ data: null, error: null }); },
    eq: function() { return this; },
    order: function() { return this; },
    limit: function() { return this; },
    single: function() { 
      return Promise.resolve({ data: this.data[0] || null, error: null }); 
    },
    maybeSingle: function() { 
      return Promise.resolve({ data: this.data[0] || null, error: null }); 
    },
    // Implementação de Thenable para permitir 'await supabase.from(...)'
    then: function(onfulfilled: any, onrejected: any) {
      return Promise.resolve({ data: this.data, error: null }).then(onfulfilled, onrejected);
    }
  };
};

// Mock Auth com persistência local
const createMockAuth = () => {
  const getMockSession = () => {
    const json = localStorage.getItem('autoclaims_mock_session');
    return json ? JSON.parse(json) : null;
  };

  return {
    getSession: () => Promise.resolve({ data: { session: getMockSession() }, error: null }),
    getUser: () => Promise.resolve({ data: { user: getMockSession()?.user || null }, error: null }),
    onAuthStateChange: (callback: any) => {
      const session = getMockSession();
      // Dispara evento inicial de forma assíncrona para não bloquear renderização
      if (session) {
        setTimeout(() => {
            console.log('[MockAuth] Disparando SIGNED_IN inicial');
            callback('SIGNED_IN', session);
        }, 100);
      } else {
        setTimeout(() => {
            console.log('[MockAuth] Disparando SIGNED_OUT inicial');
            callback('SIGNED_OUT', null);
        }, 100);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async ({ email }: any) => {
      console.log('[MockAuth] Tentando login simulado para:', email);
      const user = { id: 'mock-user-id', email, role: 'admin' };
      const session = { access_token: 'mock-token', user };
      localStorage.setItem('autoclaims_mock_session', JSON.stringify(session));
      
      // Pequeno delay para simular rede
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Força reload para garantir estado limpo
      window.location.reload();
      return { data: { session, user }, error: null };
    },
    signInWithOAuth: () => Promise.resolve({ error: { message: 'OAuth não disponível offline' } }),
    signOut: async () => {
      localStorage.removeItem('autoclaims_mock_session');
      window.location.reload();
      return { error: null };
    }
  };
};

let client;

if (isSupabaseConfigured) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
    global: {
      headers: { 'x-application-name': 'autoclaims-pro' },
    },
  });
} else {
  console.warn('[AutoClaims] Supabase não configurado. Rodando em modo Mock (Offline).');
  client = {
    from: (table: string) => {
        // Retorna dados mockados específicos dependendo da tabela
        if (table === 'events') return createMockBuilder(mockStorage.get('events') || []);
        if (table === 'vehicles') return createMockBuilder(mockStorage.get('vehicles') || []);
        if (table === 'suppliers') return createMockBuilder(mockStorage.get('suppliers') || []);
        return createMockBuilder([]);
    },
    auth: createMockAuth(),
  } as any;
}

export const supabase = client;

export const checkSupabaseConnection = async () => {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('saas_tenants').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
};