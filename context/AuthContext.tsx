import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';
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
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // O loading inicia TRUE para bloquear a renderização até termos certeza do estado.
  const [loading, setLoading] = useState(true);

  // Busca ou cria o perfil do usuário no banco
  const fetchProfile = useCallback(async (currentUser: User) => {
    if (!isSupabaseConfigured || !currentUser) return null;

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        if (SUPER_ADMIN_EMAILS.includes(currentUser.email || '') && existingProfile.role !== 'super_admin') {
           const { data: updated } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', currentUser.id).select().single();
           return updated || existingProfile;
        }
        return existingProfile;
      } 
      
      const meta = currentUser.user_metadata;
      const newProfile = { 
        id: currentUser.id, 
        full_name: meta?.full_name || meta?.name || currentUser.email?.split('@')[0] || 'Usuário',
        email: currentUser.email,
        role: SUPER_ADMIN_EMAILS.includes(currentUser.email || '') ? 'super_admin' : 'user',
        created_at: new Date().toISOString(),
      };

      const { data: createdProfile } = await supabase
        .from('profiles')
        .upsert([newProfile]) 
        .select()
        .single();
      
      return createdProfile || newProfile;

    } catch (err) {
      console.error("[Auth] Erro ao buscar perfil:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log('[Auth] Inicializando Contexto...');

    // DETECÇÃO DE CALLBACK:
    // Identifica se estamos em um fluxo de retorno OAuth (Hash ou Query).
    // Se verdadeiro, sabemos que o Supabase SDK ainda vai processar a sessão.
    const isAuthCallback = window.location.hash.includes('access_token') || 
                           window.location.search.includes('code=') ||
                           window.location.hash.includes('type=recovery');
    
    console.log(`[Auth] Callback detectado na URL? ${isAuthCallback ? 'SIM' : 'NÃO'}`);

    // Função de inicialização
    const initializeAuth = async () => {
      try {
        // Tenta pegar a sessão atual (persistida ou da URL se o SDK já processou)
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) console.error('[Auth] Erro no getSession:', error);

        if (mounted) {
          if (initialSession) {
            console.log('[Auth] Sessão inicial encontrada.');
            setSession(initialSession);
            setUser(initialSession.user);
            const userProfile = await fetchProfile(initialSession.user);
            if (mounted) setProfile(userProfile);
            setLoading(false); // Sessão confirmada, libera o app.
          } else {
            console.log('[Auth] Nenhuma sessão inicial.');
            
            // LÓGICA CRÍTICA:
            // Se não tem sessão, mas parece ser um callback, NÃO definimos loading=false.
            // Esperamos o evento SIGNED_IN do onAuthStateChange.
            if (!isAuthCallback) {
              setLoading(false); // Realmente deslogado e sem pendências.
            } else {
              console.log('[Auth] Aguardando processamento do SDK (loading permanece true)...');
            }
          }
        }
      } catch (err) {
        console.error("[Auth] Falha crítica na inicialização:", err);
        if (mounted && !isAuthCallback) setLoading(false);
      }
    };

    initializeAuth();

    // Listener de mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento recebido: ${event}`);
      
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        console.log('[Auth] Usuário autenticado via evento.');
        // Evita refetch desnecessário se o perfil já estiver carregado
        if (!profile) {
           const userProfile = await fetchProfile(currentSession.user);
           if (mounted) setProfile(userProfile);
        }
        setLoading(false); // Libera o app (resolve o caso do callback)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        clearSessionData();
        setLoading(false);
      } else if (event === 'INITIAL_SESSION') {
         // Evento disparado pelo SDK após processar a URL.
         // Se a sessão for nula aqui e não for callback, o initializeAuth já tratou.
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]); // Removido 'profile' das dependências para evitar loop

  const clearSessionData = () => {
    mockStorage.clearAll();
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      clearSessionData();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    console.log('[Auth] Iniciando OAuth Google. Redirect:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      }
    });
    if (error) throw error;
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const tenantId = profile?.tenant_id || null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      signOut, 
      signInWithGoogle, 
      clearSessionData, 
      isSuperAdmin, 
      tenantId 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};