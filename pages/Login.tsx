
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
  CheckCircle2, Building2
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
    { icon: LayoutDashboard, title: 'Operacao ao vivo', desc: 'Sinistros, prazos e etapas em um painel unico.' },
    { icon: Zap, title: 'Cotacao ate compra', desc: 'Comparacao, aprovacao e OCs com trilha auditavel.' },
    { icon: ShieldCheck, title: 'Controle financeiro', desc: 'Historico, permissoes e recompra sem perda de dados.' },
  ];
  const loginChecks = [
    'Acesso por empresa',
    'Convites e Google OAuth',
    'Sessoes protegidas',
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
    <div className="min-h-screen bg-[#F4F7FB] font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.82fr)_minmax(560px,1.18fr)]">
        <aside className="relative hidden overflow-hidden bg-[#111827] lg:flex lg:flex-col lg:justify-between p-12 xl:p-14">
          <div className="absolute inset-0 opacity-[0.16]" style={{
            backgroundImage: 'linear-gradient(rgba(96,165,250,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.32) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950/30 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-12">
              <EscLogo className="w-12 h-12 text-white" classNameText="text-white text-[26px]" />
              <span className="px-3 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-300">
                {productPill}
              </span>
            </div>

            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300 mb-4">
                Plataforma de sinistros
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight mb-6">
                Gestão clara para cada etapa do sinistro.
              </h1>
              <p className="text-[17px] text-slate-300 max-w-md leading-7 font-medium">
                Abra casos, acompanhe prazos, aprove compras e mantenha a auditoria completa sem perder contexto.
              </p>
            </div>

            <div className="mt-10 grid gap-3">
              {featureCards.map((item) => (
                <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/12 text-blue-300 flex items-center justify-center border border-blue-400/15 shrink-0">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white">{item.title}</h3>
                    <p className="text-[13px] font-medium text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {[
              ['24h', 'SLA e prazos'],
              ['100%', 'Auditoria'],
              ['Multi', 'Empresa'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-2xl font-extrabold text-white">{value}</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex items-center justify-center p-4 md:p-8 xl:p-12">
          <div className="w-full max-w-[520px] animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <div className="lg:hidden flex items-center justify-between mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <EscLogo className="w-9 h-9 text-slate-900" classNameText="text-slate-900 text-xl" />
              <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
                {productPill}
              </span>
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)] overflow-hidden">
              <div className="px-6 md:px-8 pt-7 pb-6 border-b border-slate-100 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 mb-2">
                      {inviteInfo ? 'Convite ativo' : 'Acesso restrito'}
                    </p>
                    <h2 className="text-2xl md:text-[32px] font-extrabold text-slate-950 tracking-tight">
                      {inviteInfo ? 'Entrar e aceitar convite' : 'Entrar no sistema'}
                    </h2>
                    <p className="text-[15px] text-slate-500 mt-2 font-medium leading-relaxed">
                      {inviteInfo
                        ? `Convite para ${inviteInfo.tenant_name}`
                        : 'Use uma conta cadastrada na empresa ou continue com Google.'}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      {isSupabaseConfigured ? `${productPill} conectado ao Supabase` : 'Supabase nao configurado'}
                    </p>
                  </div>
                  <div className="hidden sm:flex w-11 h-11 rounded-xl bg-blue-600 text-white items-center justify-center shadow-lg shadow-blue-600/20">
                    <Building2 size={22} />
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">

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

            <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">E-mail</label>
                  <div className="relative group">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        readOnly={!!inviteInfo}
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[16px] font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
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
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[16px] font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
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
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-extrabold text-[15px] shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
               >
                  {localLoading ? <Loader2 className="animate-spin" size={22}/> : (
                    <>
                      {inviteInfo ? 'Entrar e aceitar convite' : 'Entrar na plataforma'} <ArrowRight size={20} className="opacity-80"/>
                    </>
                  )}
               </button>
            </form>

            <div className="mt-8 mb-8 relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-300 uppercase">Ou continue com</span>
                <div className="flex-grow border-t border-slate-100"></div>
            </div>
            
            <button 
               onClick={handleGoogle}
               disabled={localLoading}
               className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all group disabled:opacity-60"
            >
               <Globe size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors"/>
               Google (Gmail)
            </button>

            <div className="mt-10 text-center space-y-2">
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

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {loginChecks.map((check) => (
                <div key={check} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-500">{check}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                <ShieldCheck size={12} className="text-green-600" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sessao segura</span>
              </div>
              <p className="text-xs text-slate-500 font-black">© 2026 {company.product} by {company.name}.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
