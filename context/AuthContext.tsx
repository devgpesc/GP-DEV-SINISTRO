
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// Fix: Types User and Session not exported in v1, define as any locally
// import { Session, User } from '@supabase/supabase-js';
type Session = any;
type User = any;
import { supabase } from '../services/supabaseClient';
import { Car, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

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
    const isOAuthRedirect = typeof window !== 'undefined' && 
                            window.location.hash && 
                            window.location.hash.includes('access_token');

    // Timeout de segurança AGRESSIVO para corrigir loops
    const safetyTimeout = setTimeout(() => {
        if (loading && mounted) {
            console.warn('[Auth] Timeout crítico. Forçando liberação.');
            
            // Se não estamos em redirect OAuth e travou, provavelmente é cache sujo.
            if (!isOAuthRedirect) {
               console.warn('[Auth] Sessão corrompida detectada. Limpando...');
               localStorage.removeItem('sb-' + (import.meta as any).env?.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
               setLoadingError(true); // Mostra botão de reset manual se o auto falhar
            }
            
            setLoading(false);
        }
    }, isOAuthRedirect ? 8000 : 4000); // 4s máximo para login normal

    const initAuth = async () => {
        // 1. Configurar Listener PRIMEIRO
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`[Auth Event] ${event}`);
            if (!mounted) return;

            if (newSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
                setSession(newSession);
                setUser(newSession.user);
                
                if (!profile || profile.id !== newSession.user.id) {
                    const p = await fetchProfile(newSession.user.id);
                    if (mounted) setProfile(p);
                }
                
                // Limpa hash da URL
                if (window.location.hash && window.location.hash.includes('access_token')) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                // Tratamento redundante para garantir limpeza caso venha do listener
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
            }
        });

        // 2. Verificação Inicial
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    
                    const p = await fetchProfile(currentSession.user.id);
                    if (mounted) setProfile(p);
                }
                // Sempre finaliza o loading inicial, logado ou não
                setLoading(false);
            }
        } catch (err) {
            console.error('[Auth] Erro init:', err);
            if (mounted) setLoading(false);
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
        setLoading(true);
        const { error } = await (supabase.auth as any).signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin, 
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
    } catch (error) {
        setLoading(false);
        alert("Erro ao iniciar login com Google.");
    }
  };

  const signOut = async () => {
    // LOGOUT NUCLEAR: Garante que nada sobrevive para causar re-login automático
    try {
        // NÃO ativar setLoading(true) aqui.
        // Isso evita que a tela de "Carregando Sistema" apareça, o que confundia o usuário achando que estava logando de novo.
        
        // 1. Limpeza de Estado React Imediata (Visual)
        // Isso fará com que o PrivateRoute redirecione para /login instantaneamente se estiver dentro do app
        setUser(null);
        setSession(null);
        setProfile(null);

        // 2. Limpeza de Storage (Persistência)
        localStorage.clear();
        sessionStorage.clear();

        // 3. Limpeza de Cookies (Deep Clean)
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }

        // 4. Logout no Supabase (Backend)
        // Fazemos isso por último ou em paralelo para não bloquear a UI visualmente
        await supabase.auth.signOut();
        
        console.log('[Auth] Sessão encerrada completamente.');

    } catch (error) {
        console.error("Erro ao sair (forçando limpeza local):", error);
        localStorage.clear();
    } finally {
        // 5. Hard Reload para Login (Limpa memória JS e previne loop de hooks)
        window.location.href = '/login';
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
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;
        setProfile((prev: any) => ({ ...prev, ...data }));
    } catch (error) {
        console.error("Erro perfil:", error);
        throw error;
    }
  };

  const handleHardReset = () => {
      if (window.confirm('Isso corrigirá problemas de travamento limpando os dados locais. Continuar?')) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-8 p-4">
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Car className="text-blue-600" size={24} />
                </div>
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
                Carregando Sistema...
            </p>
          </div>
          
          {/* Botão de Auto-Recuperação sempre visível após delay */}
          <div className="flex flex-col gap-3 items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-1000 fill-mode-forwards opacity-0" style={{animationDelay: '1s'}}>
              <p className="text-xs text-slate-400 font-medium">O sistema está demorando?</p>
              <button 
                onClick={handleHardReset} 
                className="flex items-center gap-2 px-6 py-3 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                  <AlertTriangle size={16} /> Forçar Logout e Corrigir
              </button>
          </div>
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
