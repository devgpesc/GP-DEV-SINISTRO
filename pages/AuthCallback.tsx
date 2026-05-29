import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, useLocation } = ReactRouterDOM as any;
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { getAuthRedirectUrl } from '../services/authRedirect';
import {
  clearPendingRegistration,
  readPendingRegistration,
} from '../services/pendingRegistration';

const parseHashParams = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

const waitForAuthSession = (timeoutMs = 6000): Promise<any | null> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (session: any | null) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      clearTimeout(timer);
      resolve(session);
    };

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) finish(session);
    });

    const timer = setTimeout(() => finish(null), timeoutMs);

    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
      if (session) finish(session);
    });
  });

const finishPendingInviteOrRegistration = async (inviteToken: string | null) => {
  const pending = readPendingRegistration();

  if (inviteToken) {
    const { error } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
    if (error) throw error;
    clearPendingRegistration();
    return;
  }

  if (pending?.inviteToken) {
    const { error } = await supabase.rpc('accept_invite', { invite_token: pending.inviteToken });
    if (error) throw error;
    clearPendingRegistration();
    return;
  }

  if (pending?.companyName) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (!user) return;

    const { error } = await supabase.rpc('complete_registration', {
      company_name: pending.companyName,
      full_name: pending.name || user.user_metadata?.full_name || user.email?.split('@')[0],
    });
    if (error) throw error;
    clearPendingRegistration();
  }
};

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const hashParams = parseHashParams();
        const inviteToken = searchParams.get('invite');

        const authErrorCode = hashParams.get('error_code') || searchParams.get('error_code');
        const authError =
          hashParams.get('error_description') ||
          searchParams.get('error_description') ||
          hashParams.get('error') ||
          searchParams.get('error');

        if (authError) {
          const pending = readPendingRegistration();
          if (pending?.email) setResendEmail(pending.email);

          if (authErrorCode === 'otp_expired') {
            throw new Error(
              'O link de confirmacao expirou ou ja foi usado. Solicite um novo e-mail abaixo e abra apenas o link mais recente.',
            );
          }
          throw new Error(decodeURIComponent(String(authError).replace(/\+/g, ' ')));
        }

        // 1) Confirmação por e-mail (token_hash) — funciona sem PKCE no mesmo browser
        const tokenHash = searchParams.get('token_hash');
        const otpType = searchParams.get('type');
        if (tokenHash && otpType) {
          const { error: verifyError } = await (supabase.auth as any).verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (verifyError) throw verifyError;
        } else {
          // 2) Fluxo implícito legado (#access_token)
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error: sessionError } = await (supabase.auth as any).setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            // 3) PKCE (?code=) — OAuth Google ou confirmação recente no mesmo navegador
            const code = searchParams.get('code');
            if (code) {
              await new Promise((r) => setTimeout(r, 150));

              let { data: { session: existingSession } } = await (supabase.auth as any).getSession();
              if (!existingSession) {
                const { error: exchangeError } = await (supabase.auth as any).exchangeCodeForSession(code);
                if (exchangeError) {
                  existingSession = await waitForAuthSession();
                  if (!existingSession) {
                    if (String(exchangeError.message || '').includes('PKCE')) {
                      throw new Error(
                        'Nao foi possivel concluir o login OAuth. Abra o link no mesmo navegador em que iniciou o acesso, ou entre com e-mail e senha. Se usou um link de confirmacao antigo, solicite um novo e-mail.',
                      );
                    }
                    throw exchangeError;
                  }
                }
              }
            }
          }
        }

        const { data: { session }, error: sessionError } = await (supabase.auth as any).getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          await finishPendingInviteOrRegistration(inviteToken);
          addToast('success', 'Acesso confirmado', 'Sua conta foi ativada com sucesso.');
          window.history.replaceState({}, document.title, '/');
          navigate('/', { replace: true });
          return;
        }

        navigate('/login', { replace: true });
      } catch (err: any) {
        console.error('[AuthCallback]', err);
        setError(err.message || 'Nao foi possivel concluir a autenticacao.');
      }
    };

    finishAuth();
  }, [addToast, location.search, navigate]);

  const handleResend = async () => {
    if (!resendEmail) {
      navigate('/login', { replace: true });
      return;
    }

    setResending(true);
    try {
      const pending = readPendingRegistration();
      const inviteQuery = pending?.inviteToken ? `?invite=${pending.inviteToken}` : '';
      const { error: resendError } = await (supabase.auth as any).resend({
        type: 'signup',
        email: resendEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(`/auth/callback${inviteQuery}`),
        },
      });
      if (resendError) throw resendError;
      addToast('success', 'E-mail reenviado', 'Abra o link mais recente na sua caixa de entrada.');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel reenviar o e-mail.');
    } finally {
      setResending(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={36} />
          <h1 className="text-xl font-black text-slate-900">Erro na confirmacao</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">{error}</p>
          <div className="mt-6 flex flex-col gap-3">
            {resendEmail && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmacao'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700">
      <Loader2 className="mb-4 animate-spin text-blue-600" size={34} />
      <p className="text-xs font-black uppercase tracking-widest">Concluindo acesso seguro...</p>
    </div>
  );
};

export default AuthCallback;
