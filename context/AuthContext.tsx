
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, mockStorage, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType {
  user: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearSessionData: () => void;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// E-mails de Super Admin hardcoded para segurança e fallback
const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Função para processar/criar perfil do usuário
  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    if (!isSupabaseConfigured) return;

    // Dados para fallback local caso o DB falhe
    const userEmail = email || user?.email;
    const isSuper = SUPER_ADMIN_EMAILS.includes(userEmail);
    const fallbackProfile = { 
      id: userId, 
      email: userEmail, 
      role: isSuper ? 'super_admin' : 'user', 
      full_name: 'Usuário',
      tenant_id: null 
    };

    try {
      // 1. Tenta buscar perfil existente
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        // Se é super admin hardcoded, garante que o DB reflita isso
        if (isSuper && existingProfile.role !== 'super_admin') {
            await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', userId);
            setProfile({ ...existingProfile, role: 'super_admin' });
        } else {
            setProfile(existingProfile);
        }
      } else {
        // 2. Se não existe, cria (Upsert)
        const { data: authUser } = await supabase.auth.getUser();
        const meta = authUser.user?.user_metadata;
        
        const newProfile = { 
          id: userId, 
          full_name: meta?.full_name || meta?.name || 'Usuário',
          email: userEmail,
          role: isSuper ? 'super_admin' : 'user',
          created_at: new Date().toISOString(),
        };

        const { data: createdProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert([newProfile]) 
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(createdProfile);
      }
    } catch (err) {
      console.error("[Auth] Erro ao sincronizar perfil (usando fallback):", err);
      setProfile(fallbackProfile);
    }
  }, []);

  // Lógica Principal de Inicialização de Sessão
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Verificação Manual de Hash para OAuth com HashRouter
        // Isso roda ANTES do Router ser montado porque o AuthProvider bloqueia a renderização dos filhos enquanto loading=true
        const hash = window.location.hash;
        
        // Exemplo de hash do Supabase: #access_token=...&refresh_token=...
        // Exemplo de hash do Router: #/login
        if (hash && hash.includes('access_token')) {
          console.log('[Auth] Token OAuth detectado no Hash. Iniciando processamento manual...');
          
          // Remove o '#' inicial para processar
          const hashString = hash.substring(1); 
          const params = new URLSearchParams(hashString);
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error && data.session) {
              console.log('[Auth] Sessão criada manualmente via token da URL.');
              // Limpa o hash para evitar loops e preparar para o HashRouter
              // Define como '/' para o HashRouter ir para a home
              window.location.hash = '/'; 
            } else {
              console.error('[Auth] Erro ao definir sessão manual:', error);
            }
          }
        }

        // 2. Verifica sessão persistida
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('[Auth] Usuário autenticado:', session.user.email);
            setUser(session.user);
            await fetchProfile(session.user.id, session.user.email);
          } else {
            console.log('[Auth] Nenhuma sessão ativa.');
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('[Auth] Erro crítico na inicialização:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Listener para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Evento: ${event}`);
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        if (session?.user) {
           // Se o profile ainda não estiver carregado, mantemos loading visual apenas se desejado, 
           // mas aqui preferimos não bloquear toda a UI em refresh
           if (!profile) await fetchProfile(session.user.id, session.user.email);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const clearSessionData = () => {
    mockStorage.clearAll();
    localStorage.clear();
    sessionStorage.clear();
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      clearSessionData();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      window.location.href = '/#/login';
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    console.log('[Auth] Redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: redirectUrl,
        queryParams: { 
          access_type: 'offline', 
          prompt: 'select_account' 
        }
      }
    });
    if (error) throw error;
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const tenantId = profile?.tenant_id || null;

  // IMPORTANTE: Bloqueia a renderização dos filhos (Router) enquanto carrega.
  // Isso impede que o HashRouter tente rotear o access_token da URL.
  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0A1628] text-white">
        <div className="relative flex flex-col items-center gap-6">
           <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent shadow-lg shadow-blue-500/50"></div>
           <div className="text-center">
             <h2 className="text-xl font-bold tracking-tight">AutoClaims Pro</h2>
             <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">Estabelecendo Conexão Segura...</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, clearSessionData, isSuperAdmin, tenantId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};
