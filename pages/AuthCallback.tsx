import React, { useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, useLocation } = ReactRouterDOM as any;
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getAuthRedirectUrl } from '../services/authRedirect';
import {
  clearPendingRegistration,
  readPendingRegistration,
} from '../services/pendingRegistration';
import { acceptInviteSafe, ensureInviteAccess } from '../services/inviteService';
import { saveInviteToken, readInviteToken } from '../services/pendingRegistration';

const parseHashParams = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const waitForAuthSession = (timeoutMs = 10000): Promise<any | null> =>
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
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) finish(session);
    });

    const timer = setTimeout(() => finish(null), timeoutMs);

    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
      if (session) finish(session);
    });
  });

const stripAuthParamsFromUrl = (inviteToken: string | null) => {
  const nextPath = inviteToken ? `/auth/callback?invite=${inviteToken}` : '/auth/callback';
  window.history.replaceState({}, document.title, nextPath);
};

const finishPendingInviteOrRegistration = async (inviteToken: string | null) => {
  const pending = readPendingRegistration();

  if (inviteToken) {
    await acceptInviteSafe(inviteToken);
    clearPendingRegistration();
    return;
  }

  if (pending?.inviteToken) {
    await acceptInviteSafe(pending.inviteToken);
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
  const { refreshContext } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [slow, setSlow] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    const slowTimer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

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

        const tokenHash = searchParams.get('token_hash');
        const otpType = searchParams.get('type');
        if (tokenHash && otpType) {
          stripAuthParamsFromUrl(inviteToken);
          const { error: verifyError } = await withTimeout(
            (supabase.auth as any).verifyOtp({ token_hash: tokenHash, type: otpType }),
            15000,
            'Tempo esgotado ao confirmar o e-mail. Tente novamente.',
          ) as { error: any };
          if (verifyError) throw verifyError;
        } else {
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            window.history.replaceState({}, document.title, window.location.pathname);
            const { error: sessionError } = await (supabase.auth as any).setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            const code = searchParams.get('code');
            if (code) {
              stripAuthParamsFromUrl(inviteToken);

              let existingSession = await waitForAuthSession(2000);
              if (!existingSession) {
                const { error: exchangeError } = await withTimeout(
                  (supabase.auth as any).exchangeCodeForSession(code),
                  15000,
                  'Tempo esgotado ao concluir login com Google. Tente novamente.',
                ) as { error: any };
                if (exchangeError) {
                  existingSession = await waitForAuthSession(8000);
                  if (!existingSession) {
                    if (String(exchangeError.message || '').includes('PKCE')) {
                      throw new Error(
                        'Nao foi possivel concluir o login OAuth. Inicie o acesso com Google novamente no mesmo navegador, sem limpar cookies durante o processo.',
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
          const storedInvite = inviteToken || readInviteToken() || readPendingRegistration()?.inviteToken;
          if (storedInvite) saveInviteToken(storedInvite);

          try {
            await ensureInviteAccess(storedInvite || null);
          } catch (inviteErr) {
            console.warn('[AuthCallback] ensureInviteAccess:', inviteErr);
          }

          if (!storedInvite) {
            await finishPendingInviteOrRegistration(inviteToken);
          }

          clearPendingRegistration();

          const { data: memberships } = await supabase
            .from('organization_members')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1);

          const { data: ownedTenants } = await supabase
            .from('saas_tenants')
            .select('id')
            .eq('owner_id', session.user.id)
            .limit(1);

          const hasAccess = (memberships?.length || 0) > 0 || (ownedTenants?.length || 0) > 0;

          if (hasAccess) {
            await refreshContext(session.user);
            addToast('success', 'Acesso confirmado', 'Sua conta foi ativada com sucesso.');
            window.location.replace('/');
            return;
          }

          addToast('success', 'Conta confirmada', 'Vinculando seu convite...');
          const pendingPath = storedInvite
            ? `/pending-access?invite=${encodeURIComponent(storedInvite)}`
            : '/pending-access';
          window.location.replace(pendingPath);
          return;
        }

        navigate('/login', { replace: true });
      } catch (err: any) {
        console.error('[AuthCallback]', err);
        setError(err.message || 'Nao foi possivel concluir a autenticacao.');
      }
    };

    finishAuth();
  }, [addToast, location.search, navigate, refreshContext]);

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700 p-6">
      <Loader2 className="mb-4 animate-spin text-blue-600" size={34} />
      <p className="text-xs font-black uppercase tracking-widest">Concluindo acesso seguro...</p>
      {slow && (
        <div className="mt-8 max-w-sm text-center">
          <p className="text-sm font-semibold text-slate-500">
            Demorando mais que o normal. Aguarde ou volte ao login e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
          >
            Voltar ao login
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;
