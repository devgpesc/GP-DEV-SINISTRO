
import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchProfile = async (id: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Tenta buscar metadados do usuário para criar perfil inicial
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: createdProfile } = await supabase
            .from('profiles')
            .insert([{ 
              id: id, 
              full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Gestor AutoClaims',
              email: authUser.email,
              role: authUser.email === 'devgpesc@gmail.com' ? 'Admin Master' : 'Usuário'
            }])
            .select()
            .single();
          setProfile(createdProfile);
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Erro ao sincronizar perfil:", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Gerencia o estado da sessão em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Verificação inicial de sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearSessionData = () => {
    mockStorage.clearAll();
    sessionStorage.clear();
    // Limpeza técnica de cookies de autenticação
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erro ao encerrar sessão:", e);
    } finally {
      clearSessionData();
      setUser(null);
      setProfile(null);
      setLoading(false);
      window.location.href = window.location.origin + window.location.pathname + '#/login';
      window.location.reload();
    }
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
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
