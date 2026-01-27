
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

    // Função auxiliar para lidar com a bagunça do HashRouter vs OAuth Hash
    const handleHashConflict = async () => {
      const hash = window.location.hash;
      
      // Se detectarmos um token de acesso na URL (formato do Google/Supabase)
      if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
        console.log('[Auth] Token OAuth detectado. Interceptando antes do Router...');
        setLoading(true);

        try {
            // Tentativa agressiva de obter a sessão, pois o token já está na URL
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) throw error;

            if (session) {
                console.log('[Auth] Sessão recuperada com sucesso via URL.');
                if (mounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                    
                    // CRÍTICO: Limpar a hash para que o HashRouter não se confunda
                    // Forçamos a ida para a raiz do app limpo
                    window.location.hash = ''; 
                    window.location.href = window.location.origin + window.location.pathname + '#/';
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error('[Auth] Erro ao processar token da URL:', e);
        }
      }

      // Fluxo padrão se não houver token na URL
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

    // Listener para mudanças futuras
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento:', event);
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
             await fetchProfile(currentUser.id);
        }
        setLoading(false);
        
        // Se ainda tiver lixo na URL, limpa
        if (window.location.hash.includes('access_token')) {
             window.location.hash = '';
             window.location.href = window.location.origin + window.location.pathname + '#/';
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
  }, [fetchProfile]);

  const clearSessionData = () => {
    mockStorage.clearAll();
    sessionStorage.clear();
    localStorage.clear();
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
      window.location.href = '/'; // Força reload limpo
    }
  };

  const signInWithGoogle = async () => {
    // Usamos origin pura para garantir que o redirecionamento volte para a raiz
    // Onde o nosso interceptador acima vai pegar o token
    const redirectUrl = window.location.origin;
    
    console.log('[Auth] Iniciando Google Auth. Callback:', redirectUrl);

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
