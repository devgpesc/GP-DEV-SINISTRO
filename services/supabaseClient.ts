
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

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

// Mock Query Builder robusto COM PERSISTÊNCIA REAL
const createMockBuilder = (table: string) => {
  const getData = () => mockStorage.get(table) || [];
  
  return {
    select: function() { 
        this.data = getData(); // Carrega dados frescos
        return this; 
    },
    
    // IMPLEMENTAÇÃO DE INSERT REAL
    insert: function(rows: any[]) {
      const currentData = getData();
      // Adiciona ID se não tiver e timestamp
      const newRows = rows.map(r => ({
        ...r,
        id: r.id || Math.random().toString(36).substr(2, 9),
        created_at: r.created_at || new Date().toISOString()
      }));
      const updatedData = [...newRows, ...currentData]; // Adiciona no topo
      mockStorage.set(table, updatedData);
      return Promise.resolve({ data: newRows[0], error: null });
    },

    // IMPLEMENTAÇÃO DE UPSERT REAL (Insert ou Update)
    upsert: function(rows: any | any[]) {
      const currentData = getData();
      const inputRows = Array.isArray(rows) ? rows : [rows];
      const updatedData = [...currentData];
      const processedRows: any[] = [];

      inputRows.forEach(newRow => {
          if (!newRow.id) {
              // Se não tem ID, gera um e insere como novo
              const rowWithId = { 
                  ...newRow, 
                  id: Math.random().toString(36).substr(2, 9),
                  created_at: new Date().toISOString() 
              };
              updatedData.unshift(rowWithId);
              processedRows.push(rowWithId);
          } else {
              const idx = updatedData.findIndex(r => r.id === newRow.id);
              if (idx >= 0) {
                  // Update existente
                  updatedData[idx] = { ...updatedData[idx], ...newRow };
                  processedRows.push(updatedData[idx]);
              } else {
                  // Insert com ID específico
                  const rowWithTimestamp = {
                      ...newRow,
                      created_at: newRow.created_at || new Date().toISOString()
                  };
                  updatedData.unshift(rowWithTimestamp);
                  processedRows.push(rowWithTimestamp);
              }
          }
      });

      mockStorage.set(table, updatedData);
      return Promise.resolve({ data: processedRows, error: null });
    },

    // IMPLEMENTAÇÃO DE UPDATE REAL
    update: function(updates: any) {
        this.updates = updates;
        return this;
    },

    // IMPLEMENTAÇÃO DE DELETE REAL
    delete: function() {
        this.isDelete = true;
        return this;
    },

    eq: function(column: string, value: any) {
        this.filterCol = column;
        this.filterVal = value;
        
        // Se for uma operação de modificação pendente (Update/Delete)
        if (this.updates) {
            const currentData = getData();
            const updatedData = currentData.map((item: any) => {
                if (item[column] === value) {
                    return { ...item, ...this.updates };
                }
                return item;
            });
            mockStorage.set(table, updatedData);
            return Promise.resolve({ data: updatedData, error: null });
        }

        if (this.isDelete) {
            const currentData = getData();
            const updatedData = currentData.filter((item: any) => item[column] !== value);
            mockStorage.set(table, updatedData);
            return Promise.resolve({ data: null, error: null });
        }

        // Se for Select
        if (this.data) {
            this.data = this.data.filter((row: any) => row[column] === value);
        }
        return this;
    },

    order: function(col: string, { ascending }: any = { ascending: true }) {
       if (this.data) {
           this.data.sort((a: any, b: any) => {
               if (a[col] < b[col]) return ascending ? -1 : 1;
               if (a[col] > b[col]) return ascending ? 1 : -1;
               return 0;
           });
       }
       return this;
    },
    
    limit: function(n: number) { 
        if (this.data) this.data = this.data.slice(0, n);
        return this; 
    },
    
    single: function() { 
      return Promise.resolve({ data: this.data?.[0] || null, error: null }); 
    },
    
    maybeSingle: function() { 
      return Promise.resolve({ data: this.data?.[0] || null, error: null }); 
    },

    // Implementação de Thenable
    then: function(onfulfilled: any, onrejected: any) {
      return Promise.resolve({ data: this.data || [], error: null }).then(onfulfilled, onrejected);
    }
  };
};

// Mock Auth com validação na lista de usuários (app_users)
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
      if (session) {
        setTimeout(() => callback('SIGNED_IN', session), 100);
      } else {
        setTimeout(() => callback('SIGNED_OUT', null), 100);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },

    signInWithPassword: async ({ email, password }: any) => {
      console.log('[MockAuth] Tentando login para:', email);
      
      // 1. Tentar Admin Padrão (Fallback)
      if (email === 'admin@autoclaims.com') {
          const user = { id: 'admin-master', email, role: 'super_admin' };
          const session = { access_token: 'mock-token-admin', user };
          localStorage.setItem('autoclaims_mock_session', JSON.stringify(session));
          window.location.reload();
          return { data: { session, user }, error: null };
      }

      // 2. Buscar na lista de usuários criada no sistema (Settings)
      const appUsers = mockStorage.get('app_users') || [];
      const foundUser = appUsers.find((u: any) => u.email === email);

      if (foundUser) {
          // Em mock, aceitamos a senha se o usuário existir (ou validamos se salvamos a senha)
          // Na prática anterior não salvamos a senha no objeto, então validamos pelo email.
          // Se você quiser validar senha, precisaria salvar a senha no Settings.tsx
          
          const user = { 
              id: foundUser.id, 
              email: foundUser.email, 
              role: foundUser.role, // Passa a role correta
              user_metadata: { full_name: foundUser.name, avatar_url: '' } 
          };
          
          const session = { access_token: `mock-token-${foundUser.id}`, user };
          localStorage.setItem('autoclaims_mock_session', JSON.stringify(session));
          
          await new Promise(resolve => setTimeout(resolve, 500));
          window.location.reload();
          return { data: { session, user }, error: null };
      }

      return { data: null, error: { message: 'Usuário não encontrado ou senha incorreta.' } };
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
  console.warn('[AutoClaims] Supabase não configurado. Rodando em modo Mock (Offline/Persistente).');
  client = {
    // Factory que cria um builder conectado à tabela específica no localStorage
    from: (table: string) => createMockBuilder(table),
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
