
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// Fix: Types User and Session not exported in v1, define as any locally
// import { Session, User } from '@supabase/supabase-js';
type Session = any;
type User = any;
import { supabase } from '../services/supabaseClient';
import { Car } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; role?: string }) => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(false);

  // Busca perfil real no banco
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
          console.error('[Auth] Erro ao buscar perfil:', error.message);
          return null;
      }
      
      return data || { 
        id: userId, 
        role: 'user', 
        full_name: 'Usuário' 
      };
    } catch (err) {
      console.error('[Auth] Falha crítica no fetchProfile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Detecção Crítica: Estamos voltando de um login social?
    // Se houver hash na URL, NÃO podemos liberar o loading até o Supabase processar.
    const isOAuthRedirect = typeof window !== 'undefined' && 
                            window.location.hash && 
                            window.location.hash.includes('access_token');

    // Timeout de segurança estendido para casos de OAuth lento
    const safetyTimeout = setTimeout(() => {
        if (loading && mounted) {
            console.warn('[Auth] Timeout de segurança atingido. Liberando interface.');
            setLoading(false);
            if (!user) setLoadingError(true);
        }
    }, isOAuthRedirect ? 15000 : 8000); // Mais tempo se for OAuth

    const initAuth = async () => {
        // 1. Configurar Listener PRIMEIRO para capturar eventos de hash instantaneamente
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`[Auth Event] ${event}`);
            
            if (!mounted) return;

            if (newSession?.user) {
                setSession(newSession);
                setUser(newSession.user);
                
                // Fetch profile apenas se mudou o usuário ou ainda não temos
                if (!profile || profile.id !== newSession.user.id) {
                    const p = await fetchProfile(newSession.user.id);
                    if (mounted) setProfile(p);
                }
                
                // SEGURANÇA: Limpa hash da URL após sucesso
                if (window.location.hash && window.location.hash.includes('access_token')) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
            } else {
                // Se foi logout explícito, limpa estado
                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                }
            }

            // Qualquer evento de mudança de estado encerra o loading
            // (SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION, etc)
            setLoading(false);
        });

        // 2. Verificação Inicial Robusta (Server-Side Validation)
        try {
            // Tenta pegar usuário validado no servidor (evita cookies falsos)
            const { data: { user: validUser }, error } = await supabase.auth.getUser();
            
            if (mounted) {
                if (validUser) {
                    // Usuário válido já existe
                    setUser(validUser);
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    setSession(currentSession);
                    
                    const p = await fetchProfile(validUser.id);
                    if (mounted) setProfile(p);
                    
                    setLoading(false);
                } else {
                    // Nenhum usuário ativo no storage/servidor.
                    // CRÍTICO: Se for redirect OAuth, NÃO setamos loading false aqui.
                    // Esperamos o evento do onAuthStateChange processar o hash.
                    if (!isOAuthRedirect) {
                        setLoading(false);
                    } else {
                        console.log('[Auth] Aguardando processamento de hash OAuth...');
                    }
                }
            }
        } catch (err) {
            console.error('[Auth] Erro na inicialização:', err);
            if (mounted && !isOAuthRedirect) setLoading(false);
        }

        return subscription;
    };

    const subPromise = initAuth();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subPromise.then(sub => sub?.unsubscribe());
    };
  }, [fetchProfile]); 

  const signInWithGoogle = async () => {
    try {
        setLoading(true); // Bloqueia UI durante início do redirecionamento
        const { error } = await (supabase.auth as any).signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin, 
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
    } catch (error) {
        console.error("Erro no login Google:", error);
        setLoading(false);
        alert("Erro ao iniciar login com Google. Verifique o console.");
    }
  };

  const signOut = async () => {
    try {
        setLoading(true);
        await supabase.auth.signOut();
        // O estado será limpo pelo onAuthStateChange -> SIGNED_OUT
    } catch (error) {
        console.error("Erro ao sair:", error);
        setLoading(false);
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string; role?: string }) => {
    if (!user) return;

    try {
        const updates = {
            id: user.id,
            ...data,
            email: user.email, 
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('profiles')
            .upsert(updates);

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        setProfile((prev: any) => ({ ...prev, ...data }));

    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        throw error;
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    signInWithGoogle,
    updateProfile,
    isSuperAdmin: profile?.role === 'super_admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
      {loading && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="relative flex items-center justify-center mb-6 animate-in zoom-in duration-500">
             <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <Car className="text-blue-600" size={24} />
             </div>
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
             {loadingError ? 'Tempo limite excedido. Tente recarregar.' : 'Autenticando...'}
          </p>
          
          {loadingError && (
              <button onClick={() => window.location.reload()} className="mt-8 px-4 py-2 bg-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-300">
                  Recarregar Página
              </button>
          )}
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
