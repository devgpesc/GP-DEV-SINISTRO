
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// Fix: Types User and Session not exported in v1, define as any locally
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
  checkPermission: (feature: string) => boolean;
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
      
      return data;
    } catch (err) {
      console.error('[Auth] Falha crítica no fetchProfile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Timeout de segurança
    const safetyTimeout = setTimeout(() => {
        if (loading && mounted) {
            console.warn('[Auth] Timeout de carregamento.');
            setLoadingError(true);
            setLoading(false);
        }
    }, 10000);

    const initAuth = async () => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (newSession?.user) {
                    setSession(newSession);
                    setUser(newSession.user);
                    
                    // Busca perfil
                    let p = await fetchProfile(newSession.user.id);
                    
                    // AUTO-FIX: Se o perfil não existir no banco, cria um objeto temporário na memória
                    if (!p) {
                        console.warn('[Auth] Perfil não encontrado no banco. Usando fallback de memória.');
                        p = { 
                            id: newSession.user.id, 
                            email: newSession.user.email,
                            role: 'Usuário', // <== Fallback alinhado com Constraint
                            full_name: newSession.user.user_metadata?.full_name || 'Usuário',
                            permissions: {} 
                        };
                    }
                    
                    if (mounted) setProfile(p);
                }
                
                if (window.location.hash && window.location.hash.includes('access_token')) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
            }
        });

        // Verificação Inicial
        try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();
            
            if (error) {
                if (error.status === 400 || error.message.includes('refresh_token')) {
                    localStorage.clear();
                    await supabase.auth.signOut();
                }
            }

            if (mounted) {
                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    const p = await fetchProfile(currentSession.user.id);
                    // Fallback visual
                    setProfile(p || { 
                        id: currentSession.user.id, 
                        role: 'Usuário', // <== Fallback alinhado
                        full_name: currentSession.user.user_metadata?.full_name || 'Usuário',
                        permissions: {} 
                    });
                } else {
                    setUser(null);
                }
                setLoading(false);
            }
        } catch (err) {
            console.error('[Auth] Erro crítico init:', err);
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
    try {
        setUser(null);
        setSession(null);
        setProfile(null);
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Erro ao sair:", error);
    } finally {
        window.location.href = '/login';
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string; role?: string }) => {
    if (!user) return;
    try {
        const updates = {
            id: user.id,
            ...data,
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

  const checkPermission = (feature: string) => {
      if (!profile) return false;
      // Verifica Admin/super_admin ou Gerente com permissões específicas
      if (profile.role === 'Admin' || profile.role === 'super_admin') return true;
      return !!profile.permissions?.[feature];
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    signInWithGoogle,
    updateProfile,
    // Verifica Maiúsculo 'Admin' conforme constraint do banco
    isSuperAdmin: profile?.role === 'super_admin' || profile?.role === 'Admin',
    checkPermission
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
