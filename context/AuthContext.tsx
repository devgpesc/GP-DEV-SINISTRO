
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Car } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; role?: string }) => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Busca perfil real no banco
  const fetchProfile = useCallback(async (userId: string) => {
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

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

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
            setLoading(false);
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
  }, [fetchProfile, profile]);

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
    try {
        setLoading(true);
        await supabase.auth.signOut();
        // O estado será atualizado pelo onAuthStateChange
    } catch (error) {
        console.error("Erro ao sair:", error);
        setLoading(false);
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string; role?: string }) => {
    if (!user) return;

    try {
        const updates = {
            id: user.id,
            ...data,
            // Garante que campos obrigatórios existam em caso de insert
            email: user.email, 
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('profiles')
            .upsert(updates);

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        // Atualiza estado local imediatamente para refletir na UI sem refresh
        setProfile((prev: any) => ({ ...prev, ...data }));

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
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="relative flex items-center justify-center mb-6 animate-in zoom-in duration-500">
             {/* Outer spinning ring */}
             <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
             {/* Inner Static/Pulsing Icon */}
             <div className="absolute inset-0 flex items-center justify-center">
                <Car className="text-blue-600" size={24} />
             </div>
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Conectando...</p>
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
