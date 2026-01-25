
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, mockStorage } from '../services/supabaseClient';

interface AuthContextType {
  user: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      mockStorage.set('mock_user', null);
      setUser(null);
      setProfile(null);
    }
    window.location.href = '#/login';
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert("Aviso: O Supabase não está configurado. Configure as chaves para usar o login real.");
      return;
    }
    
    // Corrigido: Redirect para o domínio solicitado
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://eventos.escsistemas.com'
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};
