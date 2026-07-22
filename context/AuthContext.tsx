
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// import { Session, User } from '@supabase/supabase-js'; // Removed to avoid export errors
import { supabase } from '../services/supabaseClient';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { SaasTenant, OrganizationMember } from '../types';

// Workaround for missing types in @supabase/supabase-js
type User = any;
type Session = any;

const TENANT_STORAGE_KEY = 'sb-autoclaims-tenant-id';
import { readPendingRegistration, clearPendingRegistration } from '../services/pendingRegistration';
import { acceptInviteSafe, repairSessionAccess } from '../services/inviteService';
import { AccessProfile, resolveAccessProfile } from '../services/accessControl';
import { isRootPlatformAdminEmail, resolvePlatformRole } from '../services/platformAdmin';

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
  access: AccessProfile;
  checkPermission: (feature: string) => boolean;
  switchTenant: (tenantId: string) => void;
  refreshContext: (overrideUser?: User) => Promise<boolean>;
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
    const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();

    let pending: any = readPendingRegistration();

    const metaCompanyName = userMeta?.company_name || userMeta?.companyName;
    const metaName = userMeta?.full_name || userMeta?.name;

    if (!pending && metaCompanyName) {
      pending = {
        email: normalizedUserEmail,
        name: metaName,
        companyName: metaCompanyName
      };
    }

    if (!pending) return;

    const normalizedPendingEmail = String(pending?.email || '').trim().toLowerCase();
    if (normalizedPendingEmail && normalizedUserEmail && normalizedPendingEmail !== normalizedUserEmail) return;

    if (pending.inviteToken) {
      await Promise.race([
        acceptInviteSafe(pending.inviteToken),
        new Promise((_, reject) => setTimeout(() => reject(new Error('INVITE_TIMEOUT')), 10000)),
      ]).catch((err) => {
        console.warn('[Auth] acceptInviteSafe timeout/erro:', err?.message || err);
      });
      clearPendingRegistration();
      return;
    }

    if (!pending.companyName) {
      clearPendingRegistration();
      return;
    }

    const [{ data: existingMemberships }, { data: existingTenants }] = await Promise.all([
      supabase.from('organization_members').select('id').eq('user_id', userId).limit(1),
      supabase.from('saas_tenants').select('id').eq('owner_id', userId).limit(1)
    ]);

    const alreadyConfigured = (existingMemberships?.length || 0) > 0 || (existingTenants?.length || 0) > 0;
    if (alreadyConfigured) {
      clearPendingRegistration();
      return;
    }

    const { error: registrationError } = await supabase.rpc('complete_registration', {
      company_name: pending.companyName,
      full_name: pending.name || userMeta?.full_name || userMeta?.name || userEmail?.split('@')[0]
    });
    if (registrationError) throw registrationError;

    clearPendingRegistration();
  }, []);

  const applyRepairedAccess = useCallback((
    userId: string,
    userEmail: string | undefined,
    userMeta: any,
    repaired: {
      memberships?: any[];
      tenants?: any[];
      membershipCount?: number;
    },
    profileData?: any,
  ) => {
    const repairedRows = repaired.memberships || [];
    if (!repairedRows.length) return false;
    const repairedTenants = repaired.tenants || [];
    const tenantByIdRepair = new Map(repairedTenants.map((t: any) => [t.id, t]));
    const combinedFromRepair: EnrichedMembership[] = repairedRows.map((m: any) => ({
      ...m,
      permissions: m.permissions || {},
      module_permissions: m.module_permissions || {},
      saas_tenants: tenantByIdRepair.get(m.tenant_id) || {
        id: m.tenant_id,
        name: 'Empresa do Sistema',
        status: 'active',
      },
    }));
    if (!mounted.current) return true;
    setMemberships(combinedFromRepair);
    const selected = combinedFromRepair[0]?.saas_tenants || null;
    setCurrentTenant(selected);
    if (selected?.id) localStorage.setItem(TENANT_STORAGE_KEY, selected.id);
    setProfile({
      id: userId,
      email: userEmail,
      full_name:
        profileData?.full_name ||
        userMeta?.full_name ||
        userMeta?.name ||
        userEmail?.split('@')[0],
      avatar_url: profileData?.avatar_url || userMeta?.avatar_url,
      permissions: profileData?.permissions || {},
      created_at: profileData?.created_at || new Date().toISOString(),
      ...(profileData || {}),
      role: resolvePlatformRole(userEmail, profileData?.role),
    });
    return true;
  }, []);

  const loadContextData = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
    if (!mounted.current) return;

    try {
      await completePendingRegistration(userId, userEmail, userMeta);

      // 1) Caminho rapido: API session-access (service role) — evita pending-access por RLS/timeout.
      try {
        const repaired = await Promise.race([
          repairSessionAccess(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
        ]);
        if (repaired && (repaired.membershipCount || 0) > 0) {
          applyRepairedAccess(userId, userEmail, userMeta, repaired);
          return;
        }
      } catch (repairFirstErr: any) {
        console.warn('[Auth] repair inicial:', repairFirstErr?.message || repairFirstErr);
      }

      const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 6000));

      const fetchProfile = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      const fetchMembers = supabase
        .from('organization_members')
        .select('id, tenant_id, user_id, role, permissions, module_permissions, created_at')
        .eq('user_id', userId);
      const fetchOwnedTenants = supabase.from('saas_tenants').select('*').eq('owner_id', userId);

      const results = await Promise.race([
          Promise.all([fetchProfile, fetchMembers, fetchOwnedTenants]),
          dbTimeout
      ]) as any;

      if (!Array.isArray(results)) throw new Error("Dados demoraram a carregar");

      const [profileRes, membersRes, ownedTenantsRes] = results;

      if (membersRes.error) {
          console.error("Erro ao buscar memberships DB:", membersRes.error);
          try {
            const repaired = await repairSessionAccess();
            if (applyRepairedAccess(userId, userEmail, userMeta, repaired, profileRes?.data)) return;
          } catch (repairErr: any) {
            console.warn('[Auth] repair apos erro membership:', repairErr?.message || repairErr);
          }
          throw new Error('Erro ao buscar memberships: ' + membersRes.error.message);
      }

      const memberRows = membersRes.data || [];
      const tenantIds = [...new Set(memberRows.map((m: any) => m.tenant_id).filter(Boolean))];
      let linkedTenants: any[] = [];
      if (tenantIds.length > 0) {
        const { data: tenantRows, error: tenantError } = await supabase
          .from('saas_tenants')
          .select('*')
          .in('id', tenantIds);
        if (tenantError) {
          console.warn('[Auth] Falha ao buscar tenants vinculados:', tenantError.message);
        } else {
          linkedTenants = tenantRows || [];
        }
      }

      if (memberRows.length === 0 && !(ownedTenantsRes?.data?.length > 0)) {
        try {
          const repaired = await repairSessionAccess();
          if (applyRepairedAccess(userId, userEmail, userMeta, repaired, profileRes?.data)) return;
        } catch (repairErr: any) {
          console.warn('[Auth] repairSessionAccess:', repairErr?.message || repairErr);
        }
      }

      const tenantById = new Map(linkedTenants.map((tenant: any) => [tenant.id, tenant]));

      // 1. Perfil
      const finalProfile: UserProfile = {
        id: userId,
        email: userEmail,
        full_name:
          profileRes.data?.full_name ||
          userMeta?.full_name ||
          userMeta?.name ||
          userEmail?.split('@')[0],
        avatar_url: profileRes.data?.avatar_url || userMeta?.avatar_url,
        permissions: profileRes.data?.permissions || {},
        created_at: profileRes.data?.created_at || new Date().toISOString(),
        ...(profileRes.data || {}),
        role: resolvePlatformRole(userEmail, profileRes.data?.role),
      };
      
      if (mounted.current) setProfile(finalProfile);

      // 2. Tenants (Memberships)
      let combinedMemberships: EnrichedMembership[] = [];
      
      if (membersRes.data) {
          combinedMemberships = memberRows.map((m: any) => ({
            ...m,
            saas_tenants: tenantById.get(m.tenant_id) || {
              id: m.tenant_id,
              name: 'Empresa do Sistema',
              status: 'active',
            },
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
                      permissions: {},
                      module_permissions: {},
                      created_at: tenant.created_at,
                      saas_tenants: tenant
                  });
              }
          });
      }

      if (mounted.current) setMemberships(combinedMemberships);

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
      console.warn('[Auth] Falha ao carregar contexto:', err.message);
      const onAuthCallback =
        typeof window !== 'undefined' && window.location.pathname === '/auth/callback';

      if (isRootPlatformAdminEmail(userEmail) && mounted.current) {
        setProfile({
          id: userId,
          email: userEmail,
          role: 'super_admin',
          full_name: userMeta?.full_name || userMeta?.name || userEmail?.split('@')[0],
          avatar_url: userMeta?.avatar_url,
          permissions: {},
          created_at: new Date().toISOString(),
        });
        setMemberships([]);
        setCurrentTenant(null);
        return;
      }

      // Em timeout/RLS: tenta API service-role antes de desistir / deslogar.
      try {
        const repaired = await repairSessionAccess();
        if (applyRepairedAccess(userId, userEmail, userMeta, repaired)) return;
      } catch (repairErr: any) {
        console.warn('[Auth] repair no catch:', repairErr?.message || repairErr);
      }

      if (onAuthCallback) {
        throw err;
      }

      // Nao desloga automaticamente: deixa MembershipGate / pending-access tratar.
      if (mounted.current) {
        setProfile({
          id: userId,
          email: userEmail,
          full_name: userMeta?.full_name || userMeta?.name || userEmail?.split('@')[0],
          avatar_url: userMeta?.avatar_url,
          permissions: {},
          created_at: new Date().toISOString(),
          role: resolvePlatformRole(userEmail, undefined),
        });
        setMemberships([]);
        setCurrentTenant(null);
      }
    }
  }, [completePendingRegistration, applyRepairedAccess]);

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
        
        const onAuthCallback =
          typeof window !== 'undefined' && window.location.pathname === '/auth/callback';

        if (mounted.current) {
            if (initialSession?.user) {
                setSession(initialSession);
                setUser(initialSession.user);
                if (!onAuthCallback) {
                  await loadContextData(
                    initialSession.user.id,
                    initialSession.user.email,
                    initialSession.user.user_metadata
                  );
                }
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
             const onAuthCallback =
               typeof window !== 'undefined' && window.location.pathname === '/auth/callback';
             if (!onAuthCallback) {
               await loadContextData(
                 newSession.user.id,
                 newSession.user.email,
                 newSession.user.user_metadata
               );
             }
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
    let invite = '';
    try {
      invite =
        localStorage.getItem('sb-autoclaims-invite-token') ||
        sessionStorage.getItem('sb-autoclaims-invite-token') ||
        '';
    } catch {
      invite = '';
    }
    const callbackPath = invite
      ? `/auth/callback?invite=${encodeURIComponent(invite)}`
      : '/auth/callback';
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(callbackPath),
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

  const access = resolveAccessProfile(profile, memberships, currentTenant);

  const switchTenant = (tenantId: string) => {
      const target = memberships.find(m => m.tenant_id === tenantId);
      if (target) {
          setCurrentTenant(target.saas_tenants);
          localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
          window.location.reload();
      }
  };

  const refreshContext = useCallback(async (overrideUser?: User): Promise<boolean> => {
      let targetUser = overrideUser ?? user;
      if (!targetUser) {
        const { data: { session: currentSession } } = await (supabase.auth as any).getSession();
        targetUser = currentSession?.user ?? null;
      }
      if (!targetUser) return false;

      if (mounted.current) {
        setSession((prev: Session | null) => prev ?? { user: targetUser });
        setUser(targetUser);
      }

      try {
        await loadContextData(targetUser.id, targetUser.email, targetUser.user_metadata);
        return true;
      } catch (error) {
        console.warn('[Auth] refreshContext falhou:', error);
        return false;
      }
  }, [user, loadContextData]);

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
    isSuperAdmin: profile?.role === 'super_admin' || isRootPlatformAdminEmail(user?.email),
    access,
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
