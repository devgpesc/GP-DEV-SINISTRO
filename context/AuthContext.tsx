
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, mockStorage } from '../services/supabaseClient';

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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Auto-criação de perfil caso o usuário exista no Auth mas não no Profiles
        const { data: userData } = await supabase.auth.getUser();
        const { data: createdProfile } = await supabase
          .from('profiles')
          .insert([{ 
            id: id, 
            full_name: userData.user?.user_metadata?.full_name || userData.user?.user_metadata?.name || 'Usuário',
            email: userData.user?.email,
            role: 'Usuário' 
          }])
          .select()
          .single();
        setProfile(createdProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Erro ao buscar perfil no Supabase:", err);
      // Mantemos o perfil nulo para indicar falha de acesso aos dados
      setProfile(null);
    }
  };

  useEffect(() => {
    // Escuta mudanças de autenticação reais do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

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
    // Limpeza de cookies
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erro ao deslogar:", e);
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
