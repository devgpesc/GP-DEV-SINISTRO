
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// Fix: Types User and Session not exported in v1, define as any locally
type Session = any;
type User = any;
import { supabase } from '../services/supabaseClient';

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
  
  // Começa TRUE para bloquear a UI até termos certeza da sessão (evita flash de login)
  const [loading, setLoading] = useState(true); 

  // Ref para acessar o perfil atual dentro do listener sem recriar o efeito
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Busca perfil real no banco com retry
  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
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
      
      // Fallback em memória se o trigger falhou (Safety net)
      if (!data) {
          console.warn('[Auth] Perfil DB não encontrado. Usando fallback.');
          return {
              id: userId,
              email: userEmail,
              role: 'Usuário',
              full_name: userMeta?.full_name || 'Usuário',
              permissions: {}
          };
      }
      
      return data;
    } catch (err) {
      console.error('[Auth] Falha crítica no fetchProfile:', err);
      return null;
    }
  }, []);

  // Inicialização "Blindada"
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
        try {
            // 1. Verifica sessão persistida (LocalStorage)
            const { data: { session: initialSession }, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (initialSession?.user) {
                if (mounted) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    // Busca perfil antes de liberar a tela
                    const p = await fetchProfile(
                        initialSession.user.id, 
                        initialSession.user.email, 
                        initialSession.user.user_metadata
                    );
                    if (mounted) setProfile(p);
                }
            } else {
                // Sem sessão, limpa estados
                if (mounted) {
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                }
            }
        } catch (err) {
            console.error('[Auth] Erro na inicialização:', err);
            if (mounted) {
                setUser(null);
                setSession(null);
            }
        } finally {
            if (mounted) {
                setLoading(false); // SÓ AGORA libera a UI
            }
        }
    };

    initializeAuth();

    // 2. Escuta mudanças em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted) return;

        console.log('[Auth] Evento:', event);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
                // Usa ref para checar estado atual sem re-triggerar o effect
                const currentProfile = profileRef.current;
                
                // Atualiza perfil se necessário (se não existe ou se o ID mudou)
                // Se a role mudou no banco, forçamos um refresh
                if (!currentProfile || currentProfile.id !== newSession.user.id) {
                    const p = await fetchProfile(
                        newSession.user.id, 
                        newSession.user.email, 
                        newSession.user.user_metadata
                    );
                    if (mounted) setProfile(p);
                }
            }
            setLoading(false);
        } 
        else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            localStorage.removeItem('sb-autoclaims-auth-token'); 
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [fetchProfile]); // Removed 'profile' from dependencies to prevent loop

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
    } catch (error) {
        console.error("Erro ao sair:", error);
        setLoading(false);
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string; role?: string }) => {
    if (!user) return;
    try {
        const updates: any = {
            id: user.id,
            email: user.email,
            full_name: data.full_name,
            avatar_url: data.avatar_url,
            updated_at: new Date().toISOString(),
        };

        if (data.role) updates.role = data.role;

        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;
        
        setProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (error) {
        console.error("Erro perfil:", error);
        throw error;
    }
  };

  const checkPermission = (feature: string) => {
      if (!profile) return false;
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
    isSuperAdmin: profile?.role === 'super_admin' || profile?.role === 'Admin',
    checkPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
