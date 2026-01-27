import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, mockStorage } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearSessionData: () => void;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Busca perfil no Supabase
  const fetchProfile = useCallback(async (currentUser: User) => {
    if (!isSupabaseConfigured || !currentUser) return null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();
      
      // Fallback local se não existir
      if (!data) {
        return {
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.email,
          role: SUPER_ADMIN_EMAILS.includes(currentUser.email || '') ? 'super_admin' : 'user'
        };
      }
      return data;
    } catch (err) {
      console.error("[Auth] Erro perfil:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // 1. DETECÇÃO DE CALLBACK OAUTH
    // Verifica se a URL contém hash ou query params indicando retorno do Google.
    // Se sim, forçamos o loading a continuar TRUE até o Supabase processar.
    const isAuthCallback = window.location.hash.includes('access_token') || 
                           window.location.search.includes('code=') ||
                           window.location.hash.includes('type=recovery');

    console.log(`[Auth] Início. Callback detectado? ${isAuthCallback}`);

    const initAuth = async () => {
      // Verifica sessão atual (persistida)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      console.log('[Auth] getSession result:', currentSession ? 'Sessão Encontrada' : 'Nenhuma Sessão');

      if (mounted) {
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          const p = await fetchProfile(currentSession.user);
          if (mounted) setProfile(p);
          setLoading(false); // Temos sessão, libera o app
        } else {
          // Se NÃO tem sessão, mas É um callback, NÃO libera o loading.
          // O listener onAuthStateChange vai capturar o evento SIGNED_IN em breve.
          if (!isAuthCallback) {
            setLoading(false); // Não é callback, realmente deslogado.
          } else {
            console.log('[Auth] Callback pendente. Aguardando evento do Supabase...');
            // Safety Timeout: Se o Supabase falhar em processar o hash em 10s, libera o app para não travar
            setTimeout(() => {
               if (mounted && loading) {
                 console.warn('[Auth] Timeout de segurança atingido. Liberando loading.');
                 setLoading(false);
               }
            }, 10000);
          }
        }
      }
    };

    initAuth();

    // 2. LISTENER DE EVENTOS
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth] Evento: ${event}`);
      
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
           const p = await fetchProfile(newSession.user);
           if (mounted) setProfile(p);
        }
        // CRÍTICO: Libera o loading aqui para garantir que o redirecionamento
        // só aconteça APÓS a sessão estar confirmada.
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    mockStorage.clearAll();
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    console.log('[Auth] Iniciando Google OAuth para:', redirectUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: redirectUrl,
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, signOut, signInWithGoogle,
      clearSessionData: () => mockStorage.clearAll(),
      isSuperAdmin: profile?.role === 'super_admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};