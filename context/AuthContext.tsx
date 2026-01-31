
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, OrganizationMember } from '../types';

// --- CONSTANTES & TIPOS ---

const TENANT_STORAGE_KEY = 'sb-autoclaims-tenant-id';

// Interface flexível para o perfil do usuário
interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  permissions?: Record<string, boolean>;
  [key: string]: any;
}

interface EnrichedMembership extends OrganizationMember {
  saas_tenants: SaasTenant;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: EnrichedMembership[];
  currentTenant: SaasTenant | null;
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
  // Estados de Autenticação
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Estados Multi-tenant
  const [memberships, setMemberships] = useState<EnrichedMembership[]>([]);
  const [currentTenant, setCurrentTenant] = useState<SaasTenant | null>(null);
  
  // Estado de UI (Inicia true para bloquear render até check inicial)
  const [loading, setLoading] = useState(true);

  // Refs para controle de fluxo assíncrono (evita updates em componentes desmontados)
  const mounted = useRef(true);
  
  // Ref para evitar loops de reload se o profile mudar
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // --- CORE: CARREGAMENTO DE DADOS (Blindado contra falhas) ---
  const loadContextData = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    try {
      if (!mounted.current) return;

      // 1. Busca Perfil (com tratamento de erro silencioso)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('[Auth] Perfil não encontrado ou erro RLS:', profileError.message);
      }

      // Garante objeto de perfil mesmo se falhar (Fallback)
      const finalProfile: UserProfile = profileData || {
        id: userId,
        email: userEmail,
        role: 'Usuário', // Default seguro
        full_name: userMeta?.full_name || userMeta?.name || 'Usuário',
        avatar_url: userMeta?.avatar_url,
        permissions: {},
        created_at: new Date().toISOString()
      };
      
      if (mounted.current) setProfile(finalProfile);

      // 2. Busca Tenants (Memberships)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*, saas_tenants(*)')
        .eq('user_id', userId);

      // Filtra memberships válidos (onde o join funcionou)
      const validMemberships = (membersData as any[])?.filter(m => m.saas_tenants) || [];
      
      if (mounted.current) setMemberships(validMemberships);

      // 3. Lógica de Seleção do Tenant (Persistência vs Fallback)
      let selectedTenant: SaasTenant | null = null;

      if (validMemberships.length > 0) {
        const storedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
        
        // Tenta restaurar tenant salvo
        const targetMembership = validMemberships.find(m => m.tenant_id === storedTenantId);
        
        if (targetMembership) {
          selectedTenant = targetMembership.saas_tenants;
        } else {
          // Se não houver salvo ou for inválido, pega o primeiro
          selectedTenant = validMemberships[0].saas_tenants;
        }
        
        // Atualiza storage com a decisão final
        if (selectedTenant) {
            localStorage.setItem(TENANT_STORAGE_KEY, selectedTenant.id);
        }
      } else {
        // Usuário sem empresa
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }

      if (mounted.current) setCurrentTenant(selectedTenant);

    } catch (err) {
      console.error('[Auth] Erro crítico ao carregar contexto:', err);
      // Não damos throw para não quebrar a Promise.all do initialize
    }
  }, []);

  // --- LIFECYCLE DE INICIALIZAÇÃO (Com Safety Valve) ---
  useEffect(() => {
    mounted.current = true;
    let authListener: any = null;

    // Função de inicialização isolada
    const initializeAuth = async () => {
      try {
        // 1. Obtém sessão inicial
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.warn('[Auth] Erro ao recuperar sessão:', error.message);
            throw error; // Vai para o catch, limpa estado e libera loading
        }

        if (initialSession?.user) {
          if (mounted.current) {
            setSession(initialSession);
            setUser(initialSession.user);
            // Carrega dados vitais
            await loadContextData(
              initialSession.user.id, 
              initialSession.user.email, 
              initialSession.user.user_metadata
            );
          }
        } else {
          // Sem sessão válida (Logout explícito ou token expirado irremediavelmente)
          if (mounted.current) {
             setSession(null);
             setUser(null);
             setProfile(null);
             setMemberships([]);
             setCurrentTenant(null);
          }
        }
      } catch (err) {
        console.error('[Auth] Falha na inicialização:', err);
        // Em caso de erro grave, garantimos logout para evitar estado zumbi
        if (mounted.current) {
            setSession(null);
            setUser(null);
        }
      } finally {
        // CRÍTICO: Libera o loading SEMPRE, independente do que aconteceu acima
        if (mounted.current) setLoading(false);
      }
    };

    // SAFETY VALVE: Timeout forçado de 6 segundos
    // Se o Supabase travar (rede/socket), isso força a liberação da UI.
    const safetyTimeout = setTimeout(() => {
        if (loading && mounted.current) {
            console.warn('[Auth] Timeout de segurança ativado. Forçando liberação de UI.');
            setLoading(false);
        }
    }, 6000);

    // Inicia processo
    initializeAuth();

    // Configura Listener para eventos futuros (Login, Logout, Refresh)
    const { data: listenerData } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;

      // Sincroniza sessão
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
           // Só recarrega dados se o usuário mudou (evita reload em refresh de token simples)
           if (!profileRef.current || profileRef.current.id !== newSession.user.id) {
               await loadContextData(
                 newSession.user.id, 
                 newSession.user.email, 
                 newSession.user.user_metadata
               );
           }
        }
      } 
      else if (event === 'SIGNED_OUT') {
        // Limpeza atômica
        setProfile(null);
        setMemberships([]);
        setCurrentTenant(null);
        localStorage.removeItem(TENANT_STORAGE_KEY);
        setLoading(false); // Garante que não fique preso
      }
    });

    authListener = listenerData.subscription;

    return () => {
      mounted.current = false;
      clearTimeout(safetyTimeout);
      if (authListener) authListener.unsubscribe();
    };
  }, [loadContextData]);

  // --- AÇÕES ---

  const signInWithGoogle = async () => {
    try {
        setLoading(true); // UI Lock intencional durante redirect
        const { error } = await (supabase.auth as any).signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin, 
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
    } catch (error) {
        setLoading(false); // Libera se falhar
        alert("Erro ao iniciar login com Google.");
    }
  };

  const signOut = async () => {
    try {
        setLoading(true);
        await supabase.auth.signOut();
        // O estado será limpo pelo listener SIGNED_OUT
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
      if (profile.role === 'Admin' || profile.role === 'super_admin') return true;
      return !!profile.permissions?.[feature];
  };

  const switchTenant = (tenantId: string) => {
      const target = memberships.find(m => m.tenant_id === tenantId);
      if (target) {
          setCurrentTenant(target.saas_tenants);
          localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
          window.location.reload(); // Reload forçado para garantir limpeza de cache de queries antigas
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
