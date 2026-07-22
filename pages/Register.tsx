import React, { useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useSearchParams, useNavigate } = ReactRouterDOM as any;
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { auditService } from '../services/auditService';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { savePendingRegistration, saveInviteToken } from '../services/pendingRegistration';
import {
  ensureInviteAccess,
  getInviteDetails,
  acceptInvite,
  type InviteDetails,
} from '../services/inviteService';
import {
  Mail,
  Lock,
  User,
  Loader2,
  ArrowLeft,
  Building,
  AlertCircle,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Chrome,
  CheckCircle2,
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const Register: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('invite');
  const { user, loading: authLoading, memberships, refreshContext } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(inviteFromUrl);
  const [inviteData, setInviteData] = useState<InviteDetails | null>(null);
  const [verifyingInvite, setVerifyingInvite] = useState(!!inviteFromUrl);
  const [inviteStatusError, setInviteStatusError] = useState<string | null>(null);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [linkingSession, setLinkingSession] = useState(false);
  const sessionLinkAttempted = useRef(false);

  useEffect(() => {
    if (!inviteFromUrl) {
      setInviteToken(null);
      setInviteData(null);
      setVerifyingInvite(false);
      setInviteStatusError(null);
      return;
    }

    let cancelled = false;
    setInviteToken(inviteFromUrl);
    saveInviteToken(inviteFromUrl);
    setVerifyingInvite(true);
    setInviteStatusError(null);
    setError(null);

    (async () => {
      try {
        const invite = await getInviteDetails(inviteFromUrl);
        if (cancelled) return;

        if (!invite) {
          setInviteStatusError('Convite invalido ou expirado. Solicite um novo link ao administrador.');
          setInviteData(null);
          return;
        }

        const status = String(invite.status || '').toLowerCase();
        if (status === 'cancelled') {
          setInviteStatusError('Este convite foi cancelado. Solicite um novo convite ao administrador.');
          setInviteData(invite);
          return;
        }

        setInviteData(invite);
        setEmail(invite.email || '');
        setName(invite.name || '');
        setCompanyName(invite.tenant_name || 'Empresa Convidada');
        setInviteStatusError(null);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Erro ao verificar convite:', err);
        setInviteStatusError(err.message || 'Erro ao carregar dados do convite.');
        setInviteData(null);
      } finally {
        if (!cancelled) setVerifyingInvite(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteFromUrl]);

  // Sessao existente + convite: vincular e entrar (nao mostrar cadastro).
  useEffect(() => {
    if (authLoading || !user || !inviteFromUrl) return;
    if (memberships.length > 0) {
      navigate('/', { replace: true });
      return;
    }
    if (sessionLinkAttempted.current) return;

    sessionLinkAttempted.current = true;
    let cancelled = false;
    setLinkingSession(true);

    (async () => {
      try {
        saveInviteToken(inviteFromUrl);
        await ensureInviteAccess(inviteFromUrl);
        if (cancelled) return;
        await refreshContext(user);
        window.location.assign('/');
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[Register] sessao+convite:', err);
        setInviteStatusError(
          err?.message ||
            'Nao foi possivel vincular o convite a sessao atual. Use o mesmo e-mail do convite ou va ao login.',
        );
        setLinkingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, memberships.length, inviteFromUrl, navigate, refreshContext]);

  const redirectToHomeWithFreshContext = () => {
    window.location.assign('/');
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError(null);

    const trimmedCompanyName = companyName.trim();
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!inviteToken && !trimmedCompanyName) {
      setError('Informe o nome da empresa antes de continuar com Google.');
      setLoading(false);
      return;
    }

    if (inviteStatusError && !inviteData) {
      setError(inviteStatusError);
      setLoading(false);
      return;
    }

    try {
      if (inviteToken) saveInviteToken(inviteToken);

      savePendingRegistration({
        email: normalizedEmail || undefined,
        name: trimmedName || undefined,
        companyName: inviteToken ? undefined : trimmedCompanyName,
        inviteToken: inviteToken || undefined,
      });

      const { error: oauthError } = await (supabase.auth as any).signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(
            inviteToken ? `/auth/callback?invite=${inviteToken}` : '/auth/callback',
          ),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (oauthError) throw oauthError;
    } catch (err: any) {
      console.error('Google register error:', err);
      setError(err.message || 'Nao foi possivel iniciar o cadastro com Google.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedCompanyName = companyName.trim();

    if (!trimmedName || !normalizedEmail || !password.trim()) {
      setError('Por favor, preencha todos os campos obrigatorios: nome, e-mail e senha.');
      setLoading(false);
      return;
    }

    if (!inviteToken && !trimmedCompanyName) {
      setError('O nome da empresa e obrigatorio para criar uma nova conta.');
      setLoading(false);
      return;
    }

    if (inviteToken && inviteStatusError && !inviteData) {
      setError(inviteStatusError);
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('A confirmacao de senha nao confere.');
      setLoading(false);
      return;
    }

    try {
      if (inviteToken) saveInviteToken(inviteToken);

      const { data, error: signUpError } = await (supabase.auth as any).signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(
            inviteToken ? `/auth/callback?invite=${inviteToken}` : '/auth/callback',
          ),
          data: {
            full_name: trimmedName,
            name: trimmedName,
            company_name: inviteToken ? undefined : trimmedCompanyName,
            registration_type: inviteToken ? 'invite' : 'business',
          },
        },
      });

      if (signUpError) {
        const signUpMessage = (signUpError.message || '').toLowerCase();
        if (
          signUpMessage.includes('error sending confirmation email') ||
          signUpMessage.includes('error sending confirmation mail')
        ) {
          throw new Error(
            'Nao foi possivel enviar o e-mail de confirmacao. Verifique SMTP e URLs de redirecionamento no Supabase.',
          );
        }
        if (signUpMessage.includes('security purposes') || signUpMessage.includes('request this after')) {
          throw new Error('Por seguranca, aguarde alguns segundos antes de tentar cadastrar novamente.');
        }
        if (signUpError.message.includes('unique') || signUpMessage.includes('already registered')) {
          throw new Error('ALREADY_REGISTERED');
        }
        throw signUpError;
      }

      if (!data.user) {
        savePendingRegistration({
          email: normalizedEmail,
          name: trimmedName,
          companyName: inviteToken ? undefined : trimmedCompanyName,
          inviteToken: inviteToken || undefined,
        });
        addToast('success', 'Cadastro enviado!', 'Confirme seu e-mail para concluir o acesso.');
        setAwaitingEmailConfirmation(true);
        setLoading(false);
        return;
      }

      if (inviteToken && inviteData) {
        if (!data.session) {
          savePendingRegistration({
            email: normalizedEmail,
            name: trimmedName,
            inviteToken,
          });
          addToast('success', 'Cadastro realizado!', 'Confirme seu e-mail para concluir o convite.');
          setAwaitingEmailConfirmation(true);
          setLoading(false);
          return;
        }

        await acceptInvite(inviteToken);
        await auditService.log('Accept Invite', 'Invitation', inviteData.id, {
          tenant: inviteData.tenant_id,
        });
        addToast('success', 'Cadastro concluido!', `Voce agora faz parte de ${trimmedCompanyName}.`);
        setTimeout(redirectToHomeWithFreshContext, 1200);
        return;
      }

      if (data.session) {
        const { error: registrationError } = await supabase.rpc('complete_registration', {
          company_name: trimmedCompanyName,
          full_name: trimmedName,
        });
        if (registrationError) throw registrationError;

        await auditService.log('Register', 'User', data.user.id, {
          email: data.user.email,
          company: trimmedCompanyName,
        });
        addToast('success', 'Conta criada!', `Bem-vindo a ${trimmedCompanyName}.`);
        setTimeout(redirectToHomeWithFreshContext, 1200);
        return;
      }

      savePendingRegistration({
        email: normalizedEmail,
        name: trimmedName,
        companyName: trimmedCompanyName,
      });
      addToast('success', 'Cadastro realizado!', 'Verifique seu e-mail para confirmar a conta.');
      setAwaitingEmailConfirmation(true);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      if (err?.message === 'ALREADY_REGISTERED') {
        setError('Este e-mail ja possui conta. Use o login com o link do convite.');
      } else {
        setError(err.message || 'Erro de conexao. Verifique sua internet e tente novamente.');
      }
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setResendingEmail(true);
    setError(null);
    try {
      const inviteQuery = inviteToken ? `?invite=${inviteToken}` : '';
      const { error: resendError } = await (supabase.auth as any).resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(`/auth/callback${inviteQuery}`),
        },
      });
      if (resendError) throw resendError;
      addToast('success', 'E-mail reenviado', 'Use o link mais recente (links antigos expiram).');
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel reenviar o e-mail.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleActivateWithoutEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setResendingEmail(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/activate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          inviteToken: inviteToken || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Falha ao ativar conta.');

      addToast('success', 'Conta ativada!', 'Agora faca login com e-mail e senha.');
      window.location.assign(inviteToken ? `/login?invite=${inviteToken}` : '/login');
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel ativar a conta.');
    } finally {
      setResendingEmail(false);
    }
  };

  if (linkingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">
          Vinculando convite a sua sessao...
        </p>
        <button
          type="button"
          onClick={() => {
            setLinkingSession(false);
            window.location.assign(inviteFromUrl ? `/login?invite=${inviteFromUrl}` : '/login');
          }}
          className="mt-2 text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest"
        >
          Ir para o login
        </button>
      </div>
    );
  }

  if (awaitingEmailConfirmation) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-green-500" size={48} />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Confirme seu e-mail</h2>
          <p className="text-sm text-slate-500 font-medium mb-2">
            Enviamos um link para <strong className="text-slate-800">{email}</strong>.
          </p>
          <p className="text-xs text-slate-400 font-semibold mb-6">
            Abra o e-mail mais recente e clique no botao de confirmacao. Links antigos expiram ao
            solicitar um novo. Entrar com Google nao exige este e-mail.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleActivateWithoutEmail}
            disabled={resendingEmail}
            className="w-full py-4 mb-3 bg-blue-600 text-white rounded-[22px] font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {resendingEmail ? 'Ativando...' : 'Nao recebi o e-mail — ativar conta agora'}
          </button>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendingEmail}
            className="w-full py-4 mb-3 border border-slate-200 text-slate-700 rounded-[22px] font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {resendingEmail ? 'Aguarde...' : 'Reenviar e-mail de confirmacao'}
          </button>
          <Link
            to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
            className="block w-full py-4 border border-slate-200 rounded-[22px] font-black text-xs uppercase tracking-widest text-slate-600 hover:border-blue-200 hover:text-blue-600"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  const alreadyRegistered = (error || '').toLowerCase().includes('ja possui conta');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-6 scale-125">
            <EscLogo className="w-16 h-16 text-slate-900" classNameText="text-slate-900 text-3xl" />
          </div>

          <h2 className="text-3xl font-black text-slate-800 tracking-tighter mt-2">
            Events<span className="text-blue-600">Car</span>
          </h2>
        </div>

        <Link
          to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> {inviteToken ? 'Ja tenho conta, entrar' : 'Voltar ao Login'}
        </Link>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
            {inviteToken ? 'Aceitar Convite' : 'Criar Conta Empresarial'}
          </h2>

          {inviteToken ? (
            <div className="mb-6 space-y-3">
              {verifyingInvite ? (
                <p className="text-sm text-slate-500 font-bold flex items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={14} /> Validando convite...
                </p>
              ) : inviteData ? (
                <p className="text-sm text-blue-600 font-bold flex items-center gap-2">
                  <LinkIcon size={14} /> Voce foi convidado para: {companyName}
                </p>
              ) : (
                <p className="text-sm text-slate-500 font-medium">
                  Informe seus dados para aceitar o convite.
                </p>
              )}

              <p className="text-xs text-slate-600 font-semibold bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                Com <strong>Google</strong> nao ha e-mail de confirmacao — use o mesmo e-mail do
                convite. E-mail de confirmacao so aparece no cadastro com senha.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 font-medium mb-2">
                Comece a gerenciar sua frota e sinistros hoje.
              </p>
              <p className="text-xs text-amber-600 font-bold mb-6 bg-amber-50 border border-amber-100 rounded-xl p-3">
                Para entrar em uma empresa existente, voce precisa de um convite do administrador. Nao
                e possivel se cadastrar diretamente em outra empresa.
              </p>
            </>
          )}

          {inviteStatusError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-bold text-amber-800 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{inviteStatusError}</span>
              </div>
              {inviteToken && (
                <Link
                  to={`/login?invite=${inviteToken}`}
                  className="inline-flex w-full justify-center py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Ir para login com este convite
                </Link>
              )}
            </div>
          )}

          {error && (
            <div
              className={`mb-6 p-4 border rounded-2xl flex flex-col gap-3 text-xs font-bold animate-in slide-in-from-top-2 ${
                error.toLowerCase().includes('verifique') || error.toLowerCase().includes('confirm')
                  ? 'bg-green-50 border-green-100 text-green-700'
                  : 'bg-red-50 border-red-100 text-red-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {alreadyRegistered && inviteToken && (
                <Link
                  to={`/login?invite=${inviteToken}`}
                  className="inline-flex w-full justify-center py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Ir para login com este convite
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {!inviteToken && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">
                  Nome da Sua Empresa
                </label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    required
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Transportadora Silva"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">
                Seu Nome
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  readOnly={!!inviteToken && !!inviteData}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">
                Definir Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || verifyingInvite}
              className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : inviteToken ? (
                'Entrar na Empresa'
              ) : (
                'Criar Conta & Acessar'
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">ou</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={loading || verifyingInvite}
            className="w-full py-4 bg-white text-slate-700 border border-slate-200 rounded-[22px] font-black text-xs uppercase tracking-widest hover:border-blue-200 hover:text-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Chrome size={18} />}
            {inviteToken ? 'Continuar com Google' : 'Criar com Google'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
