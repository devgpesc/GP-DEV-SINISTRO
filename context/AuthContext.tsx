
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, mockStorage, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType {
  user: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearSessionData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data);
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: createdProfile } = await supabase
            .from('profiles')
            .insert([{ 
              id: id, 
              full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Usuário',
              email: authUser.email,
              role: 'Usuário'
            }])
            .select()
            .single();
          setProfile(createdProfile);
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar perfil:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Verifica se estamos voltando de um OAuth (Google)
        // Não limpamos a hash aqui! O Supabase precisa dela.
        const isOAuthReturn = window.location.hash.includes('access_token') || window.location.hash.includes('type=recovery');
        
        if (isOAuthReturn) {
          setLoading(true);
          // Pequeno delay para garantir que o listener do Supabase capture o evento antes de desistirmos
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
          
          // Se não for retorno de OAuth, libera o loading imediatamente.
          // Se for OAuth, o onAuthStateChange vai lidar com o desbloqueio.
          if (!isOAuthReturn) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Erro na inicialização de sessão:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listener para mudanças de estado (Login/Logout/OAuth Redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento Detectado:', event);
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        if (currentUser) await fetchProfile(currentUser.id);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const clearSessionData = () => {
    mockStorage.clearAll();
    sessionStorage.clear();
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      clearSessionData();
      setUser(null);
      setProfile(null);
      setLoading(false);
      window.location.hash = '/login';
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        }
      }
    });

    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, clearSessionData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};
