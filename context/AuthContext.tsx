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
  
  // INICIALIZA COMO TRUE. Bloqueia a renderização até termos certeza.
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

    const initializeAuth = async () => {
      try {
        // 1. INTERCEPTAÇÃO MANUAL DE HASH (NUCLEAR OPTION)
        // Se a URL tiver #access_token, nós processamos manualmente antes de qualquer coisa.
        // Isso resolve o problema onde o Router limpa a URL ou o Supabase demora para detectar.
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('[Auth] Token OAuth detectado no Hash. Processando manualmente...');
          
          // Remove o '#' inicial
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (!error && data.session) {
              console.log('[Auth] Sessão estabelecida manualmente.');
              // Limpa o hash para não processar novamente e deixar a URL limpa
              window.history.replaceState(null, '', window.location.pathname);
              
              if (mounted) {
                setSession(data.session);
                setUser(data.session.user);
                const userProfile = await fetchProfile(data.session.user);
                setProfile(userProfile);
                setLoading(false);
                return; // Sai da função, já estamos logados
              }
            }
          }
        }

        // 2. Fluxo Padrão (Sessão Persistida ou PKCE Code)
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            const userProfile = await fetchProfile(initialSession.user);
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error("[Auth] Erro na inicialização:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Listener de Eventos
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento: ${event}`);
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
         if (!profile) {
            const userProfile = await fetchProfile(currentSession.user);
            if (mounted) setProfile(userProfile);
         }
         // Garantia extra: se logou, para de carregar
         setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        clearSessionData();
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profile]); // Adicionei profile nas deps para evitar loops de fetch

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