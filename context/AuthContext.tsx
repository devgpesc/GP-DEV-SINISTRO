
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, OrganizationMember } from '../types';

// Extensão do tipo OrganizationMember para incluir os dados da empresa (Join)
interface EnrichedMembership extends OrganizationMember {
  saas_tenants: SaasTenant;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  memberships: EnrichedMembership[]; // Lista de todas as empresas do usuário
  currentTenant: SaasTenant | null;  // Empresa atualmente selecionada
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; role?: string }) => Promise<void>;
  isSuperAdmin: boolean;
  checkPermission: (feature: string) => boolean;
  switchTenant: (tenantId: string) => void; // Função para trocar de empresa
  refreshContext: () => Promise<void>; // Recarrega dados sem deslogar
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Multi-tenant States
  const [memberships, setMemberships] = useState<EnrichedMembership[]>([]);
  const [currentTenant, setCurrentTenant] = useState<SaasTenant | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Referência para evitar loops em useEffects
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // --- CORE LOGIC: Carregar Dados do Contexto (Perfil + Tenants) ---
  const loadContextData = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    try {
      // 1. Busca Perfil Global
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) console.error('[Auth] Erro ao buscar perfil:', profileError.message);

      const finalProfile = profileData || {
        id: userId,
        email: userEmail,
        role: 'Usuário',
        full_name: userMeta?.full_name || 'Usuário',
        permissions: {}
      };
      setProfile(finalProfile);

      // 2. Busca Memberships (Vínculos com Empresas)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*, saas_tenants(*)')
        .eq('user_id', userId);

      if (membersError) throw membersError;

      // Filtra memberships válidos (onde saas_tenants não é null)
      const validMemberships = (membersData as any[])?.filter(m => m.saas_tenants) || [];
      setMemberships(validMemberships);

      // 3. Lógica de Seleção do Tenant Ativo
      if (validMemberships.length > 0) {
        const storedTenantId = localStorage.getItem('sb-autoclaims-tenant-id');
        
        // Tenta encontrar o tenant salvo no storage dentro dos memberships permitidos
        const targetMembership = validMemberships.find(m => m.tenant_id === storedTenantId);
        
        if (targetMembership) {
          setCurrentTenant(targetMembership.saas_tenants);
        } else {
          // Fallback: Seleciona o primeiro da lista e salva
          const defaultTenant = validMemberships[0].saas_tenants;
          setCurrentTenant(defaultTenant);
          localStorage.setItem('sb-autoclaims-tenant-id', defaultTenant.id);
        }
      } else {
        setCurrentTenant(null); // Usuário sem empresa (fluxo de onboarding)
        localStorage.removeItem('sb-autoclaims-tenant-id');
      }

    } catch (err) {
      console.error('[Auth] Falha crítica ao carregar contexto:', err);
    }
  }, []);

  // --- AUTH LISTENER: Inicialização ---
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          if (mounted) {
            await loadContextData(
              initialSession.user.id, 
              initialSession.user.email, 
              initialSession.user.user_metadata
            );
          }
        }
      } catch (err) {
        console.error('[Auth] Erro na inicialização:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Recarrega dados apenas se o usuário mudou ou se não temos perfil carregado
          if (!profileRef.current || profileRef.current.id !== newSession.user.id) {
             await loadContextData(
               newSession.user.id, 
               newSession.user.email, 
               newSession.user.user_metadata
             );
          }
        }
        setLoading(false);
      } 
      else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setMemberships([]);
        setCurrentTenant(null);
        setLoading(false);
        localStorage.removeItem('sb-autoclaims-tenant-id');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadContextData]);

  // --- ACTIONS ---

  const signInWithGoogle = async () => {
    try {
        setLoading(true);
        const { error } = await (supabase.auth as any).signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin, 
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
    } catch (error) {
        setLoading(false);
        alert("Erro ao iniciar login com Google.");
    }
  };

  const signOut = async () => {
    try {
        setLoading(true);
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Erro ao sair:", error);
        setLoading(false);
    }
  };

  const updateProfile = async (data: { full_name?: string; avatar_url?: string; role?: string }) => {
    if (!user) return;
    try {
        const updates: any = {
            id: user.id,
            email: user.email,
            updated_at: new Date().toISOString(),
            ...data
        };
        // Remove undefined keys
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;
        
        setProfile((prev: any) => ({ ...prev, ...updates }));
    } catch (error) {
        console.error("Erro perfil:", error);
        throw error;
    }
  };

  const checkPermission = (feature: string) => {
      if (!profile) return false;
      // Super Admin ou Admin Global tem acesso irrestrito por padrão
      if (profile.role === 'Admin' || profile.role === 'super_admin') return true;
      // Verifica permissões granulares no JSONB do perfil
      return !!profile.permissions?.[feature];
  };

  const switchTenant = (tenantId: string) => {
      const target = memberships.find(m => m.tenant_id === tenantId);
      if (target) {
          setCurrentTenant(target.saas_tenants);
          localStorage.setItem('sb-autoclaims-tenant-id', tenantId);
          // Opcional: Recarregar a página se necessário para limpar estados globais de outras stores
          // window.location.reload(); 
      } else {
          console.warn("Tentativa de troca para tenant inválido:", tenantId);
      }
  };

  const refreshContext = async () => {
      if (user) {
          await loadContextData(user.id, user.email, user.user_metadata);
      }
  };

  const value = {
    user,
    session,
    profile,
    memberships,
    currentTenant,
    loading,
    signOut,
    signInWithGoogle,
    updateProfile,
    isSuperAdmin: profile?.role === 'super_admin', // Apenas super_admin é global
    checkPermission,
    switchTenant,
    refreshContext
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
