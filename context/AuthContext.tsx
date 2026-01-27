
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
  
  // INICIALIZA COMO TRUE. O app não deve renderizar rotas protegidas até que isso vire false.
  const [loading, setLoading] = useState(true);

  // Busca ou cria o perfil do usuário
  const fetchProfile = useCallback(async (currentUser: User) => {
    if (!isSupabaseConfigured || !currentUser) return null;

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Atualiza role se for super admin hardcoded
        if (SUPER_ADMIN_EMAILS.includes(currentUser.email || '') && existingProfile.role !== 'super_admin') {
           const { data: updated } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', currentUser.id).select().single();
           return updated || existingProfile;
        }
        return existingProfile;
      } 
      
      // Cria perfil se não existir
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

    // LÓGICA DE CALLBACK AWARENESS
    // Verifica se estamos voltando de um redirecionamento OAuth (Code ou Token na URL)
    const isAuthCallback = window.location.search.includes('code=') || 
                           window.location.hash.includes('access_token') ||
                           window.location.href.includes('type=recovery');

    console.log(`[Auth] Iniciando verificação. Callback detectado? ${isAuthCallback}`);

    const initSession = async () => {
      try {
        // Tenta recuperar sessão existente
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (mounted) {
          if (initialSession) {
            console.log('[Auth] Sessão encontrada via getSession.');
            setSession(initialSession);
            setUser(initialSession.user);
            const userProfile = await fetchProfile(initialSession.user);
            if (mounted) setProfile(userProfile);
            setLoading(false); // Sessão confirmada, libera app.
          } else {
            console.log('[Auth] Nenhuma sessão ativa no getSession.');
            
            // SE NÃO TEM SESSÃO, MAS É UM CALLBACK: NÃO SETA LOADING=FALSE AINDA
            // Deixa o onAuthStateChange processar o evento SIGNED_IN.
            if (!isAuthCallback) {
              setLoading(false); // Não é callback, usuário realmente deslogado.
            } else {
              console.log('[Auth] Aguardando processamento do OAuth (Callback)...');
            }
          }
        }
      } catch (error) {
        console.error("[Auth] Erro na inicialização:", error);
        if (mounted && !isAuthCallback) setLoading(false);
      }
    };

    initSession();

    // Listener de Eventos do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento recebido: ${event}`);
      
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Se logou (inclusive via OAuth callback), busca perfil e libera loading
        if (!profile) {
           const userProfile = await fetchProfile(currentSession.user);
           if (mounted) setProfile(userProfile);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        clearSessionData();
        setLoading(false);
      } else if (event === 'INITIAL_SESSION') {
         // Evento inicial disparado pelo SDK
         // Se session for null e não for callback, o loading já foi tratado no initSession
      }
    });

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
    const redirectUrl = window.location.origin; // Redireciona para a raiz
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
