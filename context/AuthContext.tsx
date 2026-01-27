
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

const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  // Começa true para evitar flash de conteúdo ou redirect errado
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const userEmail = email || user?.email;
      const isSuper = SUPER_ADMIN_EMAILS.includes(userEmail);
      const targetRole = isSuper ? 'super_admin' : 'user';

      if (existingProfile) {
        if (isSuper && existingProfile.role !== 'super_admin') {
            const { data: updated } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', userId).select().single();
            setProfile(updated);
        } else {
            setProfile(existingProfile);
        }
      } else {
        const { data: authUser } = await supabase.auth.getUser();
        const meta = authUser.user?.user_metadata;
        
        const newProfile = { 
          id: userId, 
          full_name: meta?.full_name || meta?.name || 'Usuário',
          email: userEmail,
          role: targetRole,
          created_at: new Date().toISOString(),
        };

        const { data: createdProfile } = await supabase
          .from('profiles')
          .upsert([newProfile]) 
          .select()
          .single();

        setProfile(createdProfile);
      }
    } catch (err) {
      console.error("Erro ao sincronizar perfil:", err);
      setProfile({ id: userId, email: email, role: SUPER_ADMIN_EMAILS.includes(email || '') ? 'super_admin' : 'user', tenant_id: null });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Função para inicializar sessão
    const initSession = async () => {
      try {
        // Verifica sessão atual
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, session.user.email);
          } else {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar sessão:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    // Listener de mudanças de estado (Login, Logout, OAuth Callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento:', event);
      
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true); // Bloqueia UI enquanto carrega perfil
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        // Evento disparado quando o Supabase termina de carregar a sessão inicial
        // Útil para garantir que o loading pare
        if (!session) {
             setLoading(false);
        }
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
      window.location.href = '/#/login'; // Força navegação limpa
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin, // Redireciona para a raiz, o Supabase trata o resto
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });
    if (error) throw error;
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const tenantId = profile?.tenant_id || null;

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
