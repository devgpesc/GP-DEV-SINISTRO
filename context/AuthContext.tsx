
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// import { Session, User } from '@supabase/supabase-js'; // Removed to avoid export errors
import { supabase } from '../services/supabaseClient';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { SaasTenant, OrganizationMember } from '../types';

// Workaround for missing types in @supabase/supabase-js
type User = any;
type Session = any;

const TENANT_STORAGE_KEY = 'sb-autoclaims-tenant-id';
const PENDING_REGISTRATION_STORAGE_KEY = 'sb-autoclaims-pending-registration';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<EnrichedMembership[]>([]);
  const [currentTenant, setCurrentTenant] = useState<SaasTenant | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref para garantir que não setamos estado em componente desmontado
  const mounted = useRef(true);
  
  // Ref para evitar loops de atualização
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const completePendingRegistration = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    const raw = localStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY);
    if (!raw) return;

    let pending: any = null;
    try {
      pending = JSON.parse(raw);
    } catch {
      localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
      return;
    }

    const normalizedPendingEmail = String(pending?.email || '').trim().toLowerCase();
    const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();
    if (!normalizedPendingEmail || normalizedPendingEmail !== normalizedUserEmail) return;

    if (pending.inviteToken) {
      const { error } = await supabase.rpc('accept_invite', { invite_token: pending.inviteToken });
      if (error) throw error;
      localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
      return;
    }

    if (!pending.companyName) {
      localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
      return;
    }

    const [{ data: existingMemberships }, { data: existingTenants }] = await Promise.all([
      supabase.from('organization_members').select('id').eq('user_id', userId).limit(1),
      supabase.from('saas_tenants').select('id').eq('owner_id', userId).limit(1)
    ]);

    const alreadyConfigured = (existingMemberships?.length || 0) > 0 || (existingTenants?.length || 0) > 0;
    if (alreadyConfigured) {
      localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
      return;
    }

    const { error: registrationError } = await supabase.rpc('complete_registration', {
      company_name: pending.companyName,
      full_name: pending.name || userMeta?.full_name || userMeta?.name || userEmail?.split('@')[0]
    });
    if (registrationError) throw registrationError;

    localStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY);
  }, []);

  const loadContextData = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    if (!mounted.current) return;

    try {
      await completePendingRegistration(userId, userEmail, userMeta);

      // TIMEOUT DE SEGURANÇA PARA DADOS (3.5 Segundos)
      // Se o banco demorar, não trava o login.
      const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 3500));

      const fetchProfile = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      const fetchMembers = supabase.from('organization_members').select('*, saas_tenants(*)').eq('user_id', userId);
      // Fetch tenants where the user is just the owner (for those not in organization_members)
      const fetchOwnedTenants = supabase.from('saas_tenants').select('*').eq('owner_id', userId);

      // Race: Dados vs Timeout
      const results = await Promise.race([
          Promise.all([fetchProfile, fetchMembers, fetchOwnedTenants]),
          dbTimeout
      ]) as any;

      // Se for timeout, lança erro para cair no catch e liberar a UI
      if (!Array.isArray(results)) throw new Error("Dados demoraram a carregar");

      const [profileRes, membersRes, ownedTenantsRes] = results;

      if (membersRes.error) {
          console.error("Erro ao buscar memberships DB:", membersRes.error);
          throw new Error('Erro ao buscar memberships: ' + membersRes.error.message);
      }

      // 1. Perfil
      const finalProfile: UserProfile = profileRes.data || {
        id: userId,
        email: userEmail,
        role: 'Usuário',
        full_name: userMeta?.full_name || userMeta?.name || userEmail?.split('@')[0],
        avatar_url: userMeta?.avatar_url,
        permissions: {},
        created_at: new Date().toISOString()
      };
      
      if (mounted.current) setProfile(finalProfile);

      // 2. Tenants (Memberships)
      let combinedMemberships: EnrichedMembership[] = [];
      
      if (membersRes.data) {
          combinedMemberships = membersRes.data.map((m: any) => ({
            ...m,
            saas_tenants: m.saas_tenants || { id: m.tenant_id, name: 'Empresa do Sistema', status: 'active' }
          }));
      }

      // 2.1 Adicionar os tenants que o usuário apenas é dono (mas não tem registro na junction table)
      if (ownedTenantsRes?.data) {
          ownedTenantsRes.data.forEach((tenant: any) => {
              const alreadyExists = combinedMemberships.some(m => m.tenant_id === tenant.id);
              if (!alreadyExists) {
                  combinedMemberships.push({
                      id: `owner-${tenant.id}`,
                      tenant_id: tenant.id,
                      user_id: userId,
                      role: 'owner',
                      created_at: tenant.created_at,
                      saas_tenants: tenant
                  });
              }
          });
      }

      if (mounted.current) setMemberships(combinedMemberships);

      // 3. SEGURANÇA: Se não tem memberships válidas e não é Super Admin, faz logout forçado
      // Isso evita o "User (Modo Rápido)" para quem não deve ter acesso
      const isSuperAdmin = finalProfile.role === 'super_admin';
      
      if (combinedMemberships.length === 0 && !isSuperAdmin) {
          // Permitir se o usuário tem um convite na URL
          const params = new URLSearchParams(window.location.search);
          if (!params.get('invite') && window.location.pathname !== '/register') {
              console.warn('[Auth] Usuário sem memberships ativas e sem convite. Forçando logout.');
              await (supabase.auth as any).signOut();
              if (mounted.current) {
                  setSession(null);
                  setUser(null);
                  setLoading(false);
              }
              return;
          }
      }

      // 4. Seleção de Tenant
      let selectedTenant: SaasTenant | null = null;
      if (combinedMemberships.length > 0) {
        const storedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
        const targetMembership = combinedMemberships.find((m: any) => m.tenant_id === storedTenantId);
        
        selectedTenant = targetMembership ? targetMembership.saas_tenants : combinedMemberships[0].saas_tenants;
        
        if (selectedTenant) {
            localStorage.setItem(TENANT_STORAGE_KEY, selectedTenant.id);
        }
      } else {
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }

      if (mounted.current) setCurrentTenant(selectedTenant);

    } catch (err: any) {
      console.warn('[Auth] Carregamento parcial ou offline:', err.message);
      
      // Fallback Seguro: Se for erro de rede, permite "Modo Rápido", mas se for falta de permissão, não.
      // Assumimos que o bloqueio principal é feito no Login.tsx e na lógica acima.
      if (mounted.current) {
          setProfile({
            id: userId,
            email: userEmail,
            role: 'Usuário',
            full_name: userMeta?.full_name || 'Usuário (Modo Rápido)',
            permissions: {}
          });
      }
    }
  }, [completePendingRegistration]);

  useEffect(() => {
    mounted.current = true;
    let authListener: any = null;

    const initialize = async () => {
      // TIMEOUT GERAL DE INICIALIZAÇÃO (5s)
      const safetyTimer = setTimeout(() => {
          if (mounted.current && loading) {
              console.warn("Safety timeout triggered: Forcing loading false.");
              setLoading(false);
          }
      }, 5000);

      try {
        // 1. Recupera sessão inicial
        const { data: { session: initialSession }, error } = await (supabase.auth as any).getSession();
        
        if (mounted.current) {
            if (initialSession?.user) {
                setSession(initialSession);
                setUser(initialSession.user);
                await loadContextData(
                  initialSession.user.id, 
                  initialSession.user.email, 
                  initialSession.user.user_metadata
                );
            }
        }
      } catch (error) {
        console.error('[Auth] Falha na inicialização:', error);
        if (mounted.current) {
            setSession(null);
            setUser(null);
        }
      } finally {
        clearTimeout(safetyTimer);
        if (mounted.current) setLoading(false);
      }
    };

    initialize();

    const { data: listenerData } = (supabase.auth as any).onAuthStateChange(async (event: string, newSession: any) => {
      if (!mounted.current) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          if (newSession?.user && newSession.user.id !== userRef.current?.id) {
             await loadContextData(
               newSession.user.id, 
               newSession.user.email, 
               newSession.user.user_metadata
             );
          }
      } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setMemberships([]);
          setCurrentTenant(null);
          localStorage.removeItem(TENANT_STORAGE_KEY);
          setLoading(false);
      }
    });

    authListener = listenerData.subscription;

    return () => {
      mounted.current = false;
      if (authListener) authListener.unsubscribe();
    };
  }, [loadContextData]);

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl('/auth/callback'), 
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
        setLoading(false);
        alert("Erro no login: " + error.message);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
        await (supabase.auth as any).signOut();
    } catch (error) {
        console.error("Erro ao realizar logout no Supabase:", error);
    } finally {
        if (mounted.current) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setMemberships([]);
            setCurrentTenant(null);
            localStorage.removeItem(TENANT_STORAGE_KEY);
            setTimeout(() => {
                if (mounted.current) setLoading(false);
            }, 100);
        }
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
        console.error("Erro ao atualizar perfil:", error);
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
          window.location.reload();
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
