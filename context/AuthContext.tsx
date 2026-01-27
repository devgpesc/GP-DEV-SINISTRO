
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, mockStorage, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType {
  user: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearSessionData: () => void;
  isSuperAdmin: boolean;
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lista de emails que automaticamente ganham permissão de Super Admin
const SUPER_ADMIN_EMAILS = ['devgpesc@gmail.com', 'aidaadigitall@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    if (!isSupabaseConfigured) return;

    try {
      // Tenta buscar o perfil existente
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const userEmail = email || user?.email;
      const isSuper = SUPER_ADMIN_EMAILS.includes(userEmail);
      const targetRole = isSuper ? 'super_admin' : 'user';

      if (existingProfile) {
        // Atualiza para Super Admin se necessário, mantendo o tenant_id existente
        if (isSuper && existingProfile.role !== 'super_admin') {
            const { data: updated } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', userId).select().single();
            setProfile(updated);
        } else {
            setProfile(existingProfile);
        }
      } else {
        // Se não existe, cria (UPSERT)
        const { data: authUser } = await supabase.auth.getUser();
        const meta = authUser.user?.user_metadata;
        
        const newProfile = { 
          id: userId, 
          full_name: meta?.full_name || meta?.name || 'Usuário',
          email: userEmail,
          role: targetRole,
          created_at: new Date().toISOString(),
          // tenant_id será null inicialmente até que um Super Admin vincule ou crie uma empresa
        };

        const { data: createdProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert([newProfile]) 
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(createdProfile);
      }
    } catch (err) {
      console.error("Erro ao sincronizar perfil:", err);
      // Fallback local
      setProfile({ id: userId, email: email, role: SUPER_ADMIN_EMAILS.includes(email || '') ? 'super_admin' : 'user', tenant_id: null });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleHashConflict = async () => {
      const hash = window.location.hash;
      const isOAuthReturn = hash.includes('access_token') || hash.includes('type=recovery');
      
      if (isOAuthReturn) {
        console.log('[Auth] Token OAuth detectado. Iniciando processamento...');
        setLoading(true);
        await new Promise(r => setTimeout(r, 800));

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && mounted) {
                console.log('[Auth] Sessão recuperada.');
                setUser(session.user);
                await fetchProfile(session.user.id, session.user.email);
                
                window.history.replaceState(null, '', window.location.pathname);
                window.location.hash = '/';
                
                setLoading(false);
                return;
            }
        } catch (e) {
            console.error('[Auth] Erro crítico no OAuth:', e);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, session.user.email);
        }
        setLoading(false);
      }
    };

    handleHashConflict();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = session?.user ?? null;
        if (currentUser) {
            setUser(currentUser);
            if (!user || user.id !== currentUser.id) {
                await fetchProfile(currentUser.id, currentUser.email);
            }
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
      window.location.hash = '/login';
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: redirectUrl,
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });
    if (error) throw error;
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const tenantId = profile?.tenant_id || null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, clearSessionData, isSuperAdmin, tenantId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};
