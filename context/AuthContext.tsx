
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

            if (newSession?.user) {
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
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
            }

            setLoading(false);
        });

        // 2. Verificação Inicial
        try {
            const { data: { user: validUser } } = await supabase.auth.getUser();
            
            if (mounted) {
                if (validUser) {
                    setUser(validUser);
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    setSession(currentSession);
                    
                    const p = await fetchProfile(validUser.id);
                    if (mounted) setProfile(p);
                    setLoading(false);
                } else if (!isOAuthRedirect) {
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error('[Auth] Erro init:', err);
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
    try {
        setLoading(true);
        await supabase.auth.signOut();
        localStorage.clear(); // Garante limpeza total no logout
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
                Iniciando Sistema...
            </p>
          </div>
          
          {/* Botão de Auto-Recuperação sempre visível após delay */}
          <div className="flex flex-col gap-3 items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-1000 fill-mode-forwards opacity-0" style={{animationDelay: '1s'}}>
              <p className="text-xs text-slate-400 font-medium">O sistema está demorando?</p>
              <button 
                onClick={handleHardReset} 
                className="flex items-center gap-2 px-6 py-3 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                  <AlertTriangle size={16} /> Corrigir e Recarregar
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
