
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

    const handleHashConflict = async () => {
      const hash = window.location.hash;
      // Detecta tokens do Google OAuth na URL
      const isOAuthReturn = hash.includes('access_token') || hash.includes('type=recovery');
      
      if (isOAuthReturn) {
        console.log('[Auth] Token OAuth detectado. Iniciando handshake...');
        setLoading(true);

        // DELAY CRÍTICO: Dá tempo para o Supabase processar o token internamente
        // antes de tentarmos ler a sessão ou limpar a URL.
        await new Promise(r => setTimeout(r, 500));

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && mounted) {
                console.log('[Auth] Sessão confirmada. Entrando no Dashboard...');
                setUser(session.user);
                await fetchProfile(session.user.id);
                
                // LIMPEZA SEGURA: Usamos replaceState para não disparar reload
                // e depois definimos o hash para '/' para o Router navegar.
                window.history.replaceState(null, '', window.location.pathname);
                window.location.hash = '/';
                
                setLoading(false);
                return;
            }
        } catch (e) {
            console.error('[Auth] Erro ao processar OAuth:', e);
        }
      }

      // Fluxo normal (sem token na URL)
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
        }
        setLoading(false);
      }
    };

    handleHashConflict();

    // Listener para manter o estado sincronizado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento de Sessão:', event);
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = session?.user ?? null;
        if (currentUser) {
            setUser(currentUser);
            // Evita refetch desnecessário se já tivermos perfil e usuário não mudou
            if (!user || user.id !== currentUser.id) {
                await fetchProfile(currentUser.id);
            }
            
            // Se ainda houver lixo na URL, limpa suavemente
            if (window.location.hash.includes('access_token')) {
                window.location.hash = '/';
            }
            setLoading(false);
        }
      } 
      else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, user]);

  const clearSessionData = () => {
    // Limpeza profunda para garantir que nada corrompido fique
    mockStorage.clearAll();
    sessionStorage.clear();
    
    // Limpa chaves específicas do Supabase
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
        }
    });

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
      window.location.hash = '/login'; // Navegação via HashRouter
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    console.log('[Auth] Google Login ->', redirectUrl);

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
