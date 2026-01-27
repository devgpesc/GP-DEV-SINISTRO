
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
        // Verifica se é um retorno de OAuth (Google)
        // Se houver access_token na hash, forçamos o loading para true
        // e NÃO limpamos a hash manualmente. O Supabase fará isso.
        const hash = window.location.hash;
        const isOAuthReturn = hash.includes('access_token') || 
                              hash.includes('type=recovery') || 
                              hash.includes('error_description');
        
        if (isOAuthReturn) {
          console.log('[Auth] Detectado retorno de OAuth. Aguardando processamento...');
          setLoading(true); 
          // Não chamamos getSession imediatamente aqui para dar chance ao listener do Supabase
          // capturar o evento 'SIGNED_IN' disparado pelo processamento do hash.
        } else {
          // Fluxo normal (refresh da página sem hash de token)
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted) {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
              await fetchProfile(currentUser.id);
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Erro na inicialização de sessão:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listener fundamental para OAuth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Mudança de estado:', event);
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      
      // Se o usuário logou (incluindo via Google), atualizamos o estado
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        setUser(currentUser);
        if (currentUser) await fetchProfile(currentUser.id);
        
        // Pequeno delay visual para garantir transição suave
        setTimeout(() => {
            if (mounted) setLoading(false);
        }, 500);
      } 
      else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
      else if (event === 'INITIAL_SESSION') {
        // Evento disparado quando a sessão inicial é carregada
        // Se não houver sessão e não for retorno de OAuth, paramos o loading
        if (!currentUser && !window.location.hash.includes('access_token')) {
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
    // Usar window.location.origin garante que o redirect vá para a raiz do domínio
    // evitando conflitos com rotas existentes na hash atual
    const redirectUrl = window.location.origin;
    
    console.log('[Auth] Iniciando login Google. Redirect para:', redirectUrl);

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
