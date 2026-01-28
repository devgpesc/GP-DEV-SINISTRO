
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, mockStorage } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Função isolada para buscar perfil com Timeout para evitar travamento
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Timeout de segurança
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar perfil')), 3000)
      );

      const requestPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Race condition entre request e timeout
      const response: any = await Promise.race([requestPromise, timeoutPromise]);
      const { data, error } = response || {};

      if (error) console.error('[Auth] Erro ao buscar perfil (DB):', error.message);
      
      // Se não encontrar perfil no banco, tenta buscar do mock storage de usuários
      if (!data) {
          const appUsers = mockStorage.get('app_users') || [];
          const localUser = appUsers.find((u: any) => u.id === userId || u.email === user?.email);
          if (localUser) {
              return {
                  id: userId,
                  full_name: localUser.name,
                  role: localUser.role,
                  avatar_url: localUser.avatar_url || ''
              };
          }
      }

      return data || { 
        id: userId, 
        role: 'user', 
        full_name: 'Usuário' 
      };
    } catch (err) {
      console.error('[Auth] Falha crítica no fetchProfile:', err);
      return { 
        id: userId, 
        role: 'user', 
        full_name: 'Usuário (Offline)' 
      };
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('[Auth] Erro getSession:', error);
            throw error;
        }

        if (mounted && initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            const p = await fetchProfile(initialSession.user.id);
            if (mounted) setProfile(p);
        }
      } catch (err) {
        console.error('[Auth] Erro na inicialização:', err);
      } finally {
        if (mounted) {
            // Pequeno delay para evitar flash
            setTimeout(() => setLoading(false), 500);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth Event] ${event}`);

      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Apenas busca perfil se o usuário mudou ou perfil ainda não carregado
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
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`, 
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
    if (!user) return;

    try {
        // Atualiza no Supabase (Real ou Mock)
        const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', user.id);

        if (error) throw error;

        // Atualiza estado local imediatamente
        setProfile((prev: any) => ({ ...prev, ...data }));

        // Atualiza também na lista de usuários do sistema (app_users) para consistência
        const appUsers = mockStorage.get('app_users') || [];
        const updatedUsers = appUsers.map((u: any) => {
            if (u.id === user.id || u.email === user.email) {
                return { 
                    ...u, 
                    name: data.full_name || u.name, 
                    avatar_url: data.avatar_url || u.avatar_url 
                };
            }
            return u;
        });
        mockStorage.set('app_users', updatedUsers);

    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        throw error;
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    signInWithGoogle,
    updateProfile,
    isSuperAdmin: profile?.role === 'super_admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
      {loading && (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">Carregando Sessão...</p>
             <button 
                onClick={() => window.location.reload()} 
                className="mt-4 text-xs text-blue-500 underline hover:text-blue-700"
             >
                Demorando muito? Recarregar
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
