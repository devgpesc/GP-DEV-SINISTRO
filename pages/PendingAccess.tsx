import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, Navigate } = ReactRouterDOM as any;
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  acceptInvite,
  getInviteDetails,
  getMyPendingInvite,
  type InviteDetails,
} from '../services/inviteService';
import { readPendingRegistration, clearPendingRegistration, readInviteToken, clearInviteToken, saveInviteToken } from '../services/pendingRegistration';
import {
  ShieldAlert,
  Loader2,
  LogOut,
  Mail,
  Building,
  Link as LinkIcon,
  CheckCircle2,
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
};

const PendingAccess: React.FC = () => {
  const { user, loading: authLoading, memberships, signOut, refreshContext } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<(InviteDetails & { token?: string }) | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    if (memberships.length > 0) {
      window.location.replace('/');
      return;
    }

    let cancelled = false;

    const resolveInviteToken = async (): Promise<string | null> => {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('invite');
      if (urlToken) return urlToken;

      const storedToken = readInviteToken();
      if (storedToken) return storedToken;

      const pending = readPendingRegistration();
      if (pending?.inviteToken) return pending.inviteToken;

      const myInvite = await withTimeout(getMyPendingInvite(), 8000);
      return myInvite?.token || null;
    };

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await resolveInviteToken();
        if (cancelled) return;

        if (token) {
          saveInviteToken(token);
          const details = await withTimeout(getInviteDetails(token), 8000);
          if (details) {
            setPendingInvite({ ...details, token });
          }

          const emailMatches =
            !details?.email ||
            user.email?.toLowerCase() === details.email?.toLowerCase();

          if (emailMatches) {
            setAccepting(true);
            try {
              await acceptInvite(token);
              const ok = await refreshContext();
              clearPendingRegistration();
              clearInviteToken();
              if (ok) {
                addToast('success', 'Convite aceito!', 'Seu acesso foi configurado com sucesso.');
                window.location.replace('/');
                return;
              }
            } catch (acceptErr: any) {
              console.warn('[PendingAccess] auto-accept:', acceptErr);
              setError(acceptErr.message || 'Nao foi possivel aceitar o convite automaticamente.');
            } finally {
              if (!cancelled) setAccepting(false);
            }
          }
        }
      } catch (err: any) {
        console.error('[PendingAccess]', err);
        if (!cancelled) {
          setError(err.message || 'Erro ao carregar convite.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 10000);

    run().finally(() => clearTimeout(safetyTimer));

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [user, authLoading, memberships.length, refreshContext, addToast]);

  const handleAcceptInvite = async (token: string) => {
    setAccepting(true);
    setError(null);
    try {
      await acceptInvite(token);
      const ok = await refreshContext();
      clearPendingRegistration();
      clearInviteToken();
      if (!ok) throw new Error('Nao foi possivel carregar sua empresa apos aceitar o convite.');
      addToast('success', 'Convite aceito!', 'Seu acesso foi configurado com sucesso.');
      window.location.replace('/');
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel aceitar o convite.');
    } finally {
      setAccepting(false);
    }
  };

  const handleManualAccept = async () => {
    const token = manualToken.trim();
    if (!token) {
      setError('Cole o codigo ou link do convite.');
      return;
    }

    const extracted = token.includes('invite=')
      ? new URL(token.startsWith('http') ? token : `https://x.com/?${token}`).searchParams.get('invite')
      : token;

    if (!extracted) {
      setError('Link de convite invalido.');
      return;
    }

    saveInviteToken(extracted);
    await handleAcceptInvite(extracted);
  };

  if (authLoading || (loading && !error && !pendingInvite)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {accepting ? 'Aceitando convite...' : 'Verificando acesso...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (memberships.length > 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 flex flex-col items-center">
          <EscLogo className="w-14 h-14 text-slate-900" classNameText="text-slate-900 text-2xl" />
        </div>

        <div className="rounded-3xl border border-amber-100 bg-white p-8 shadow-xl text-center">
          {pendingInvite ? (
            <>
              <CheckCircle2 className="mx-auto mb-4 text-green-500" size={40} />
              <h1 className="text-xl font-black text-slate-900">Convite encontrado</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Voce foi convidado(a) para acessar <strong className="text-slate-800">{pendingInvite.tenant_name}</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                E-mail do convite: <strong>{pendingInvite.email}</strong>
              </p>
              {user?.email?.toLowerCase() !== pendingInvite.email?.toLowerCase() && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-bold text-amber-700">
                  Voce esta logado como <strong>{user?.email}</strong>, mas o convite foi enviado para <strong>{pendingInvite.email}</strong>.
                  Saia e entre com o e-mail correto.
                </div>
              )}
            </>
          ) : (
            <>
              <ShieldAlert className="mx-auto mb-4 text-amber-500" size={40} />
              <h1 className="text-xl font-black text-slate-900">Acesso pendente</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Sua conta foi autenticada, mas ainda nao possui vinculo com uma empresa.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Cole o link de convite recebido do administrador ou solicite um novo convite.
              </p>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          {pendingInvite?.token && user?.email?.toLowerCase() === pendingInvite.email?.toLowerCase() && (
            <button
              type="button"
              onClick={() => handleAcceptInvite(pendingInvite.token!)}
              disabled={accepting}
              className="mt-6 w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {accepting ? 'Aceitando convite...' : 'Aceitar convite e entrar'}
            </button>
          )}

          {!pendingInvite && (
            <div className="mt-6 space-y-3 text-left">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Tem um link de convite?
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Cole o link ou codigo do convite"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              <button
                type="button"
                onClick={handleManualAccept}
                disabled={accepting}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50"
              >
                {accepting ? 'Verificando...' : 'Validar convite'}
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 w-full py-3 border border-slate-200 rounded-2xl font-bold text-xs uppercase text-slate-600 hover:border-blue-200 hover:text-blue-600"
            >
              <Building size={16} /> Criar nova conta empresarial
            </Link>
            <button
              type="button"
              onClick={() => signOut().then(() => window.location.replace('/login'))}
              className="flex items-center justify-center gap-2 w-full py-3 text-slate-400 font-bold text-xs uppercase hover:text-red-500"
            >
              <LogOut size={14} /> Sair e usar outra conta
            </button>
          </div>

          {user?.email && (
            <p className="mt-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-1">
              <Mail size={12} /> Logado como {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingAccess;
