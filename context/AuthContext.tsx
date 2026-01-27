
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';
import { supabase, mockStorage, isSupabaseConfigured } from '../services/supabaseClient';

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

// E-mails de Super Admin hardcoded para segurança e fallback
const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // INICIALIZA COMO TRUE
  const [loading, setLoading] = useState(true);

  // Função isolada para buscar/criar perfil
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

      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert([newProfile]) 
        .select()
        .single();

      if (insertError) {
        console.warn("[Auth] Erro ao criar perfil, usando dados locais:", insertError);
        return newProfile; 
      }
      return createdProfile;

    } catch (err) {
      console.error("[Auth] Erro crítico no perfil:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // DETECÇÃO DE CALLBACK:
    // Verifica se a URL contém indícios de um retorno de OAuth (PKCE usa 'code', Implicit usa 'access_token')
    // Se isso for verdade, NÃO podemos setar loading=false se getSession retornar null inicialmente.
    // Precisamos esperar o evento SIGNED_IN do onAuthStateChange.
    const isRedirectCallback = window.location.href.includes('code=') || 
                               window.location.hash.includes('access_token') ||
                               window.location.href.includes('type=recovery');

    const initSession = async () => {
      try {
        // getSession tenta recuperar a sessão do storage ou da URL
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (initialSession) {
            // Sessão encontrada imediatamente
            setSession(initialSession);
            setUser(initialSession.user);
            const userProfile = await fetchProfile(initialSession.user);
            if (mounted) setProfile(userProfile);
            setLoading(false); 
          } else if (!isRedirectCallback) {
            // Sem sessão e SEM indícios de callback -> Usuário deslogado
            setLoading(false);
          } else {
            // Sem sessão inicial, MAS parece ser um callback.
            // MANTÉM LOADING = TRUE e espera o listener ou timeout.
            console.log('[Auth] Callback de OAuth detectado. Aguardando processamento da sessão...');
          }
        }
      } catch (error) {
        console.error("[Auth] Erro na inicialização da sessão:", error);
        if (mounted && !isRedirectCallback) setLoading(false);
      }
    };

    initSession();

    // Listener para mudanças de estado (Login, Logout, Refresh, OAuth Callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento: ${event}`);
      
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Login sucedido (seja via sessão existente ou novo callback processado)
        if (!profile) { // Evita refetch desnecessário
           const userProfile = await fetchProfile(currentSession.user);
           if (mounted) setProfile(userProfile);
        }
        setLoading(false); // Libera o app
      } else if (event === 'SIGNED_OUT') {
        // Logout explícito
        setProfile(null);
        clearSessionData();
        setLoading(false);
      } else {
         // Outros eventos (ex: INITIAL_SESSION sem usuário). 
         // Se não estivermos esperando um callback, libera o loading.
         if (!isRedirectCallback && loading) {
             setLoading(false);
         }
      }
    });

    // FAILSAFE TIMEOUT
    // Se estamos em um callback mas nada aconteceu em 10 segundos, libera o loading para não travar a tela.
    if (isRedirectCallback) {
        setTimeout(() => {
            if (mounted) {
                // Verificação dentro do timeout usando functional update ou ref seria ideal, 
                // mas aqui confiamos que se o user estivesse logado, o listener teria limpado o loading.
                // Se ainda estiver "loading" visualmente, forçamos o fim.
                setLoading((prevLoading) => {
                    if (prevLoading) {
                        console.warn('[Auth] Timeout no processamento do OAuth. Liberando UI.');
                        return false;
                    }
                    return prevLoading;
                });
            }
        }, 10000);
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const clearSessionData = () => {
    mockStorage.clearAll();
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      clearSessionData();
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin; 
    console.log('[Auth] Iniciando OAuth para:', redirectUrl);
    
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
