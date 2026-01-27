import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  loading: boolean; // Indica se o SDK ainda está verificando o storage/url
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Função isolada para buscar perfil, desacoplada do auth state
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) console.error('[Auth] Erro ao buscar perfil:', error.message);
      
      // Se não houver perfil no banco, usamos metadados do usuário (failsafe)
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

    // 1. Inicialização: Verifica sessão existente no Storage ou URL (OAuth callback)
    const initializeAuth = async () => {
      try {
        // getSession() lida com tokens no LocalStorage E hash na URL automaticamente
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            const p = await fetchProfile(initialSession.user.id);
            if (mounted) setProfile(p);
          }
        }
      } catch (err) {
        console.error('[Auth] Erro na inicialização:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listener de Eventos: A ÚNICA fonte da verdade para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth Event] ${event}`);

      if (!mounted) return;

      // Sincroniza estado local com o estado do SDK
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Apenas busca perfil se o usuário mudou ou se não temos perfil ainda
        if (!profile || profile.id !== newSession.user.id) {
           const p = await fetchProfile(newSession.user.id);
           if (mounted) setProfile(p);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // O redirect deve ser EXATAMENTE o cadastrado no Supabase/Google Cloud
        redirectTo: `${window.location.origin}`, 
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true); // Previne flash de conteúdo
    await supabase.auth.signOut();
    // O onAuthStateChange disparará 'SIGNED_OUT', limpando o estado
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    signInWithGoogle,
    isSuperAdmin: profile?.role === 'super_admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
      {/* 
         CRÍTICO: Bloqueia renderização até loading === false.
         Isso previne que rotas privadas redirecionem para login
         antes do SDK terminar de checar a sessão.
      */}
      {loading && (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">Carregando Sessão...</p>
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