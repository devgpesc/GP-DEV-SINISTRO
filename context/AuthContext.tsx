
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, OrganizationMember } from '../types';

// --- CONSTANTES & TIPOS ---

const TENANT_STORAGE_KEY = 'sb-autoclaims-tenant-id';

// Interface flexível para o perfil do usuário, compatível com legado e futuro
interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  permissions?: Record<string, boolean>;
  [key: string]: any; // Permite campos extras sem quebrar tipagem estrita
}

// Extensão do tipo OrganizationMember para incluir os dados da empresa (Join)
interface EnrichedMembership extends OrganizationMember {
  saas_tenants: SaasTenant;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: EnrichedMembership[]; // Lista de todas as empresas do usuário
  currentTenant: SaasTenant | null;  // Empresa atualmente selecionada
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; role?: string }) => Promise<void>;
  isSuperAdmin: boolean;
  checkPermission: (feature: string) => boolean;
  switchTenant: (tenantId: string) => void;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- PROVIDER ---

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Multi-tenant State
  const [memberships, setMemberships] = useState<EnrichedMembership[]>([]);
  const [currentTenant, setCurrentTenant] = useState<SaasTenant | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(true);

  // Refs para controle de fluxo e evitar loops
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // --- CORE LOGIC: CARREGAMENTO DE DADOS ---

  const loadContextData = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    try {
      // 1. Busca Perfil Global (com fallback robusto)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('[Auth] Aviso ao buscar perfil (usando fallback):', profileError.message);
      }

      // Garante um objeto de perfil mesmo se o banco falhar ou estiver vazio (delay de trigger)
      const finalProfile: UserProfile = profileData || {
        id: userId,
        email: userEmail,
        role: 'Usuário',
        full_name: userMeta?.full_name || userMeta?.name || 'Usuário',
        avatar_url: userMeta?.avatar_url,
        permissions: {},
        created_at: new Date().toISOString() // Mock date
      };
      
      setProfile(finalProfile);

      // 2. Busca Memberships (Vínculos com Empresas)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*, saas_tenants(*)')
        .eq('user_id', userId);

      if (membersError) throw membersError;

      // Filtra memberships válidos (garante que saas_tenants não é null por integridade)
      const validMemberships = (membersData as any[])?.filter(m => m.saas_tenants) || [];
      setMemberships(validMemberships);

      // 3. Lógica de Seleção do Tenant Ativo
      let selectedTenant: SaasTenant | null = null;

      if (validMemberships.length > 0) {
        const storedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
        
        // Tenta encontrar o tenant salvo no storage dentro dos memberships permitidos
        const targetMembership = validMemberships.find(m => m.tenant_id === storedTenantId);
        
        if (targetMembership) {
          selectedTenant = targetMembership.saas_tenants;
        } else {
          // Fallback: Seleciona o primeiro da lista
          selectedTenant = validMemberships[0].saas_tenants;
        }
        
        // Persiste a escolha (ou a revalidação)
        if (selectedTenant) {
            localStorage.setItem(TENANT_STORAGE_KEY, selectedTenant.id);
        }
      } else {
        // Usuário sem empresa (fluxo de onboarding ou convite pendente)
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }

      setCurrentTenant(selectedTenant);

    } catch (err) {
      console.error('[Auth] Falha crítica ao carregar contexto:', err);
      // Não quebramos a app, mas o usuário ficará com perfil limitado/fallback
    }
  }, []);

  // --- AUTH LIFECYCLE ---

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (initialSession?.user && mounted) {
          setSession(initialSession);
          setUser(initialSession.user);
          await loadContextData(
            initialSession.user.id, 
            initialSession.user.email, 
            initialSession.user.user_metadata
          );
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
          // Recarrega dados apenas se o usuário mudou ou se não temos perfil carregado (evita reload no refresh de token)
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
        // Limpeza Total de Estado
        setSession(null);
        setUser(null);
        setProfile(null);
        setMemberships([]);
        setCurrentTenant(null);
        localStorage.removeItem(TENANT_STORAGE_KEY);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadContextData]);

  // --- ACTIONS PÚBLICAS ---

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
        // O estado será limpo pelo listener onAuthStateChange('SIGNED_OUT')
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
        // Remove undefined keys para não enviar null para o banco
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;
        
        // Atualização Otimista
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
          localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
          
          // Opcional: Disparar evento customizado se outras partes da app precisarem reagir imediatamente
          // window.dispatchEvent(new CustomEvent('tenantChanged', { detail: tenantId }));
      } else {
          console.warn("[Auth] Tentativa de troca para tenant inválido ou não autorizado:", tenantId);
      }
  };

  const refreshContext = async () => {
      if (user) {
          setLoading(true);
          await loadContextData(user.id, user.email, user.user_metadata);
          setLoading(false);
      }
  };

  // --- CONTEXT VALUE ---

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
    isSuperAdmin: profile?.role === 'super_admin',
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
