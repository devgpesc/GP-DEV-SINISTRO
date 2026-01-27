
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
  
  // INICIALIZA COMO TRUE. O app não deve renderizar rotas protegidas até que isso vire false.
  const [loading, setLoading] = useState(true);

  // Função isolada para buscar/criar perfil, desacoplada do efeito principal
  const fetchProfile = useCallback(async (currentUser: User) => {
    if (!isSupabaseConfigured || !currentUser) return null;

    try {
      // 1. Tenta buscar perfil existente
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Lógica de Super Admin Hardcoded
        if (SUPER_ADMIN_EMAILS.includes(currentUser.email || '') && existingProfile.role !== 'super_admin') {
           const { data: updated } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', currentUser.id).select().single();
           return updated || existingProfile;
        }
        return existingProfile;
      } 
      
      // 2. Se não existe, cria (Upsert)
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
        return newProfile; // Fallback para permitir login mesmo se DB falhar
      }
      
      return createdProfile;

    } catch (err) {
      console.error("[Auth] Erro crítico no perfil:", err);
      return null;
    }
  }, []);

  // EFEITO PRINCIPAL DE AUTENTICAÇÃO
  useEffect(() => {
    let mounted = true;

    // 1. Função para carregar sessão inicial
    const initSession = async () => {
      try {
        // getSession recupera do LocalStorage ou da URL (graças ao detectSessionInUrl: true)
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            // Busca o perfil em paralelo para não travar UI, mas idealmente esperamos
            const userProfile = await fetchProfile(initialSession.user);
            if (mounted) setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error("[Auth] Erro na inicialização da sessão:", error);
      } finally {
        // CRUCIAL: Só liberamos o loading após a primeira verificação completa
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // 2. Listener para mudanças de estado (Login, Logout, Refresh, OAuth Callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento: ${event}`);
      
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Se mudou o usuário ou logou, garante que temos o perfil atualizado
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           // Não setamos loading=true aqui para não piscar a tela em refreshes silenciosos
           const userProfile = await fetchProfile(currentSession.user);
           if (mounted) setProfile(userProfile);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        clearSessionData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const clearSessionData = () => {
    mockStorage.clearAll();
    // Não limpamos localStorage do supabase aqui, o signOut já faz isso
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
    const redirectUrl = window.location.origin; // Retorna para a raiz limpa
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
