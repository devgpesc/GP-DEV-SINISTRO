
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, mockStorage } from '../services/supabaseClient';

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
    if (!isSupabaseConfigured || !supabase) {
      const mockProfile = mockStorage.get('mock_profile') || {
        id: 'mock-id',
        full_name: 'Gestor (Offline)',
        email: 'local@autoclaims.pro',
        role: 'Admin'
      };
      setProfile(mockProfile);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: createdProfile } = await supabase
          .from('profiles')
          .insert([{ 
            id: id, 
            full_name: userData.user?.user_metadata?.full_name || userData.user?.user_metadata?.name || 'Usuário Novo',
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
      console.error("Erro ao buscar perfil:", err);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const savedUser = mockStorage.get('mock_user');
      if (savedUser) {
        setUser(savedUser);
        fetchProfile(savedUser.id);
      }
      setLoading(false);
      return;
    }

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
    // 1. Limpa Mock Storage (localStorage)
    mockStorage.clearAll();
    
    // 2. Limpa Cookies acessíveis por JS
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }

    // 3. Limpa Session Storage
    sessionStorage.clear();
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error("Erro ao deslogar do Supabase:", e);
    } finally {
      clearSessionData();
      setUser(null);
      setProfile(null);
      setLoading(false);
      // Força recarregamento para limpar estados residuais do React/Router
      window.location.href = window.location.origin + window.location.pathname + '#/login';
      window.location.reload();
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert("Aviso: O Supabase não está configurado corretamente para login social.");
      return;
    }
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
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
