
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// Fix: Types User and Session not exported in v1, define as any locally
type Session = any;
type User = any;
import { supabase } from '../services/supabaseClient';
import { SaasTenant } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  currentTenant: SaasTenant | null; // Empresa ativa
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; role?: string }) => Promise<void>;
  isSuperAdmin: boolean;
  checkPermission: (feature: string) => boolean;
  switchTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentTenant, setCurrentTenant] = useState<SaasTenant | null>(null);
  
  // Começa TRUE para bloquear a UI até termos certeza da sessão
  const [loading, setLoading] = useState(true); 

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Busca perfil real no banco
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
      
      // Fallback em memória
      if (!data) {
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

  // Busca a empresa ativa (Tenant)
  const fetchTenant = useCallback(async (userId: string) => {
      try {
          // 1. Busca relação usuário-empresa
          const { data: links, error } = await supabase
              .from('organization_members')
              .select('tenant_id, saas_tenants(*)')
              .eq('user_id', userId)
              .limit(1);

          if (error) throw error;

          if (links && links.length > 0) {
              // Se tiver vinculado a uma empresa, usa ela
              return links[0].saas_tenants;
          } else {
              // Fallback: Se for Super Admin, pode não estar em 'organization_members' mas acessa tudo
              // Ou se o sistema for legado, busca se é owner direto na tabela saas_tenants
              const { data: owned } = await supabase
                  .from('saas_tenants')
                  .select('*')
                  .eq('owner_id', userId)
                  .limit(1)
                  .maybeSingle();
              
              return owned || null;
          }
      } catch (e) {
          console.error('[Auth] Erro ao buscar tenant:', e);
          return null;
      }
  }, []);

  // Inicialização "Blindada"
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
        try {
            const { data: { session: initialSession }, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (initialSession?.user) {
                if (mounted) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    
                    // Busca perfil
                    const p = await fetchProfile(
                        initialSession.user.id, 
                        initialSession.user.email, 
                        initialSession.user.user_metadata
                    );
                    if (mounted) setProfile(p);

                    // Busca Tenant
                    const t = await fetchTenant(initialSession.user.id);
                    if (mounted) setCurrentTenant(t);
                }
            } else {
                if (mounted) {
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    setCurrentTenant(null);
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
                setLoading(false);
            }
        }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
                const currentProfile = profileRef.current;
                if (!currentProfile || currentProfile.id !== newSession.user.id) {
                    const p = await fetchProfile(
                        newSession.user.id, 
                        newSession.user.email, 
                        newSession.user.user_metadata
                    );
                    if (mounted) setProfile(p);

                    const t = await fetchTenant(newSession.user.id);
                    if (mounted) setCurrentTenant(t);
                }
            }
            setLoading(false);
        } 
        else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setProfile(null);
            setCurrentTenant(null);
            setLoading(false);
            localStorage.removeItem('sb-autoclaims-auth-token'); 
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [fetchProfile, fetchTenant]);

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

  const switchTenant = async (tenantId: string) => {
      // Implementação futura para quem tem múltiplas empresas
      console.log("Switching to tenant:", tenantId);
  };

  const value = {
    user,
    session,
    profile,
    currentTenant,
    loading,
    signOut,
    signInWithGoogle,
    updateProfile,
    isSuperAdmin: profile?.role === 'super_admin' || profile?.role === 'Admin',
    checkPermission,
    switchTenant
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
