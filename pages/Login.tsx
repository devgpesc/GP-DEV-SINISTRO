
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, Link, useLocation } = ReactRouterDOM as any;
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { purgeOversizedAuthCookies } from '../services/authStorage';
import { useAuth } from '../context/AuthContext';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { saveInviteToken, readInviteToken } from '../services/pendingRegistration';
import { ensureInviteAccess, getInviteDetails, repairSessionAccess, type InviteDetails } from '../services/inviteService';
import { 
  Loader2, ArrowRight, ShieldCheck, Mail, Lock, 
  LayoutDashboard, Zap, Globe, AlertCircle, Eye, EyeOff, Link as LinkIcon,
  Building2
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite') || readInviteToken();
  const { user, loading: authLoading, memberships, isSuperAdmin, refreshContext, applySessionAccess } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteDetails | null>(null);
  const sessionInviteAttempted = useRef(false);
  
  const [company] = useState({ name: 'Grupo Esc Sistemas', product: 'EventsCar' });
  const isLocalHost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const productPill = isLocalHost ? 'Localhost' : 'Producao';
  const featureCards = [
    { icon: LayoutDashboard, title: 'Operação em tempo real' },
    { icon: Zap, title: 'Cotação, compra e entrega no mesmo fluxo' },
    { icon: ShieldCheck, title: 'Auditoria e acesso por empresa' },
  ];

  useEffect(() => {
    // Cookies legados de sessao estouram o header e quebram /api + login.
    purgeOversizedAuthCookies();
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    saveInviteToken(inviteToken);
    getInviteDetails(inviteToken)
      .then((details) => {
        if (details) {
          setInviteInfo(details);
          setEmail(details.email || '');
        } else {
          setError('Convite invalido ou expirado.');
        }
      })
      .catch((err: any) => setError(err?.message || 'Convite invalido ou expirado.'));
  }, [inviteToken]);

  useEffect(() => {
    if (!user || localLoading || authLoading) return;

    if (isSuperAdmin || memberships.length > 0) {
      navigate('/', { replace: true });
      return;
    }

    // Usuario autenticado sem empresa + convite na URL: vincular automaticamente.
    const token = inviteToken || readInviteToken();
    if (!token || sessionInviteAttempted.current) return;

    sessionInviteAttempted.current = true;
    let cancelled = false;
    setLocalLoading(true);
    (async () => {
      try {
        saveInviteToken(token);
        await ensureInviteAccess(token);
        if (cancelled) return;
        await refreshContext(user);
        window.location.assign('/');
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Nao foi possivel aceitar o convite com a sessao atual.');
        setLocalLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, localLoading, authLoading, navigate, memberships.length, isSuperAdmin, inviteToken, refreshContext]);

  const processInviteAfterAuth = async (): Promise<boolean> => {
    const token = inviteToken || readInviteToken();
    if (!token) {
      try {
        await ensureInviteAccess(null);
        await refreshContext();
        return true;
      } catch {
        return false;
      }
    }
    try {
      await ensureInviteAccess(token);
      await refreshContext();
      return true;
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel aceitar o convite.');
      return false;
    }
  };

  const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const activateUnconfirmedAccount = async (targetEmail: string) => {
    const response = await fetch('/api/auth/activate-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail,
        inviteToken: inviteToken || readInviteToken() || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Nao foi possivel ativar a conta.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1 tentativa + 1 retry em falha de rede (Failed to fetch).
      const tryPasswordLogin = async () =>
        withTimeout(
          (supabase.auth as any).signInWithPassword({ email: normalizedEmail, password }),
          25000,
          'Tempo esgotado ao autenticar. Verifique sua conexao e tente novamente.',
        );

      let authResult: any;
      try {
        authResult = await tryPasswordLogin();
      } catch (firstErr: any) {
        const m = String(firstErr?.message || '').toLowerCase();
        if (m.includes('failed to fetch') || m.includes('network') || firstErr?.name === 'TypeError') {
          await new Promise((r) => setTimeout(r, 800));
          authResult = await tryPasswordLogin();
        } else {
          throw firstErr;
        }
      }

      let authError = authResult?.error;
      let data = authResult?.data;

      // Conta criada, mas e-mail de confirmacao nao chegou
      const unconfirmed =
        String(authError?.message || '').toLowerCase().includes('email not confirmed') ||
        String(authError?.message || '').toLowerCase().includes('email_not_confirmed');

      if (unconfirmed) {
        await withTimeout(
          activateUnconfirmedAccount(normalizedEmail),
          20000,
          'Tempo esgotado ao ativar a conta. Tente novamente.',
        );
        authResult = await withTimeout(
          (supabase.auth as any).signInWithPassword({ email: normalizedEmail, password }),
          15000,
          'Tempo esgotado ao autenticar apos ativacao.',
        );
        authError = authResult?.error;
        data = authResult?.data;
      }

      if (authError) throw authError;
      if (!data?.user) throw new Error("Usuario nao encontrado.");

      // Perfil nao deve bloquear o login (RLS lento / ausente).
      let profile: any = null;
      try {
        const profileRes: any = await withTimeout(
          supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
          4000,
          'profile-timeout',
        );
        profile = profileRes?.data;
      } catch {
        console.warn('[Login] perfil demorou; seguindo sem bloquear.');
      }

      if (profile?.role === 'super_admin') {
          setLocalLoading(false);
          navigate('/', { replace: true });
          return; 
      }

      // Repara vinculo (service role) antes de decidir pending-access.
      try {
        const repaired = await withTimeout(
          repairSessionAccess(),
          15000,
          'Tempo esgotado ao liberar acesso da empresa.',
        );
        if ((repaired.membershipCount || 0) > 0) {
          applySessionAccess(repaired, data.user);
          setLocalLoading(false);
          navigate('/', { replace: true });
          return;
        }
      } catch (repairErr: any) {
        console.warn('[Login] repairSessionAccess:', repairErr);
        // Nao aborta ainda — tenta SELECT local.
      }

      const membersRes: any = await withTimeout(
        supabase.from('organization_members').select('id').eq('user_id', data.user.id).limit(1),
        6000,
        'Tempo esgotado ao verificar acesso.',
      );
      const members = membersRes?.data;

      const ownedRes: any = await withTimeout(
        supabase.from('saas_tenants').select('id').eq('owner_id', data.user.id).limit(1),
        6000,
        'Tempo esgotado ao verificar empresa.',
      );
      const owned = ownedRes?.data;

      if ((members?.length || 0) > 0 || (owned?.length || 0) > 0) {
        await withTimeout(refreshContext(data.user), 12000, 'Tempo esgotado ao carregar contexto.');
        setLocalLoading(false);
        window.location.replace('/');
        return;
      }

      if (inviteToken || readInviteToken()) {
        const accepted = await withTimeout(
          processInviteAfterAuth(),
          20000,
          'Tempo esgotado ao vincular convite.',
        );
        try {
          const repairedAfter = await repairSessionAccess();
          if ((repairedAfter.membershipCount || 0) > 0) {
            await refreshContext(data.user);
            setLocalLoading(false);
            window.location.replace('/');
            return;
          }
        } catch {
          /* ignore */
        }
        const { data: membersAfter } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1);

        if (accepted || (membersAfter?.length || 0) > 0) {
          setLocalLoading(false);
          window.location.replace('/');
          return;
        }

        setLocalLoading(false);
        setError('Nao foi possivel liberar o acesso. Peca ao administrador para recriar seu usuario na Equipe.');
        return;
      }

      setLocalLoading(false);
      setError('Seu acesso ainda nao foi liberado. Peca ao administrador da empresa para adicionar seu e-mail na Equipe.');
    } catch (err: any) {
      console.error(err);
      purgeOversizedAuthCookies();
      const msg = String(err?.message || err?.error_description || '');
      const lower = msg.toLowerCase();
      const looksLikeNetwork =
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network request failed') ||
        lower.includes('load failed') ||
        (err?.name === 'TypeError' && (!msg || lower.includes('fetch') || lower.includes('network')));
      if (lower.includes('invalid login credentials')) {
          setError(
            'E-mail ou senha incorretos. Se a conta foi criada com Google, use o botao Google (Gmail) abaixo.',
          );
      } else if (lower.includes('email not confirmed')) {
          setError('E-mail ainda nao confirmado. Use "Google (Gmail)" ou peca ao admin para redefinir sua senha.');
      } else if (looksLikeNetwork) {
          setError(
            'Falha de conexao com o servidor. Atualize com Ctrl+Shift+R, desative bloqueador/VPN e tente de novo. Conta Google: use o botao Google (Gmail).',
          );
      } else {
          setError(msg || 'Nao foi possivel conectar. Tente novamente mais tarde.');
      }
      setLocalLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLocalLoading(true);
    setError(null);
    const token = inviteToken || readInviteToken();
    if (token) saveInviteToken(token);
    try {
      const { error } = await (supabase.auth as any).signInWithOAuth({
         provider: 'google',
         options: { 
            redirectTo: getAuthRedirectUrl(token ? `/auth/callback?invite=${token}` : '/auth/callback'),
            queryParams: { access_type: 'offline', prompt: 'consent' },
         }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError('Erro ao iniciar login com Google.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(360px,0.72fr)_minmax(520px,1.28fr)]">
        <aside className="hidden bg-[#101827] p-9 lg:flex lg:flex-col lg:justify-between xl:p-11">
          <div>
            <div className="mb-14 flex items-center justify-between">
              <EscLogo className="h-10 w-10 text-white" classNameText="text-white text-[22px]" />
              <span className="px-3 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-300">
                {productPill}
              </span>
            </div>

            <div className="max-w-md">
              <p className="mb-3 text-xs font-semibold uppercase text-blue-300">Plataforma de sinistros</p>
              <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                Controle operacional do início à entrega.
              </h1>
              <p className="mt-4 max-w-sm text-[15px] leading-6 text-slate-300">
                Uma visão clara dos casos, cotações, compras e responsáveis em cada etapa.
              </p>
            </div>

            <div className="mt-9 border-t border-white/10">
              {featureCards.map((item) => (
                <div key={item.title} className="flex items-center gap-3 border-b border-white/10 py-4">
                  <item.icon size={17} className="shrink-0 text-blue-300" />
                  <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={15} className="text-emerald-400" />
            Sessão protegida e trilha de auditoria
          </div>
        </aside>

        <main className="flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-[460px] animate-in fade-in duration-300">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 lg:hidden">
              <EscLogo className="h-8 w-8 text-slate-900" classNameText="text-slate-900 text-lg" />
              <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
                {productPill}
              </span>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-blue-700">
                      {inviteInfo ? 'Convite ativo' : 'Acesso restrito'}
                    </p>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {inviteInfo ? 'Entrar e aceitar convite' : 'Entrar no sistema'}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {inviteInfo
                        ? `Convite para ${inviteInfo.tenant_name}`
                        : 'Use uma conta cadastrada na empresa ou continue com Google.'}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      {isSupabaseConfigured ? `${productPill} conectado ao Supabase` : 'Supabase nao configurado'}
                    </p>
                  </div>
                  <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white sm:flex">
                    <Building2 size={18} />
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-7">

            {inviteInfo && (
              <div className="mb-6 space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-blue-700">
                  <LinkIcon className="shrink-0 mt-0.5" size={18} />
                  <p className="text-xs font-bold leading-relaxed">
                    Use o e-mail <strong>{inviteInfo.email}</strong> para entrar e vincular sua conta a empresa.
                  </p>
                </div>
              </div>
            )}

            {error && (
               <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in slide-in-from-top-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <p className="text-sm font-bold leading-relaxed">{error}</p>
               </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">E-mail</label>
                  <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        readOnly={!!inviteInfo}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-[15px] font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        placeholder="nome@empresa.com"
                      />
                  </div>
               </div>
               
               <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha</label>
                    <a href="#" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">Esqueceu?</a>
                  </div>
                  <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-[15px] font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        placeholder="********"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-2"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                  </div>
               </div>

               <button 
                  type="submit" 
                  disabled={localLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
               >
                  {localLoading ? <Loader2 className="animate-spin" size={22}/> : (
                    <>
                      {inviteInfo ? 'Entrar e aceitar convite' : 'Entrar na plataforma'} <ArrowRight size={20} className="opacity-80"/>
                    </>
                  )}
               </button>
            </form>

            <div className="relative my-5 flex items-center py-1">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-300 uppercase">Ou continue com</span>
                <div className="flex-grow border-t border-slate-100"></div>
            </div>
            
            <button 
               onClick={handleGoogle}
               disabled={localLoading}
               className="group flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
               <Globe size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors"/>
               Google (Gmail)
            </button>

            <div className="mt-6 space-y-1 text-center">
               <p className="text-slate-500 text-sm font-medium">
                 Nao tem conta?{' '}
                 <Link
                   to={inviteToken ? `/register?invite=${inviteToken}` : '/register'}
                   className="text-blue-600 font-bold hover:underline"
                 >
                   {inviteToken ? 'Criar conta com convite' : 'Criar conta empresarial'}
                 </Link>
               </p>
               {!inviteToken && (
                 <p className="text-xs text-slate-400">
                   Para entrar em empresa existente, solicite um convite ao administrador.
                 </p>
               )}
            </div>
              </div>
            </section>

            <div className="mt-4 text-center">
              <p className="text-xs font-semibold text-slate-500">© 2026 {company.product} by {company.name}.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
