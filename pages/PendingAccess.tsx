import React, { useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Navigate } = ReactRouterDOM as any;
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import {
  ensureInviteAccess,
  getInviteDetails,
  repairSessionAccess,
} from '../services/inviteService';
import {
  readPendingRegistration,
  clearPendingRegistration,
  readInviteToken,
  clearInviteToken,
  saveInviteToken,
} from '../services/pendingRegistration';
import {
  ShieldAlert,
  Loader2,
  LogOut,
  Mail,
  Link as LinkIcon,
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const PendingAccess: React.FC = () => {
  const { user, loading: authLoading, memberships, refreshContext, signOut, applySessionAccess } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const resolveInviteToken = (): string | null => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('invite');
    if (urlToken) return urlToken;
    const storedToken = readInviteToken();
    if (storedToken) return storedToken;
    const pending = readPendingRegistration();
    if (pending?.inviteToken) return pending.inviteToken;
    return null;
  };

  const verifyMembershipAndRedirect = async (): Promise<boolean> => {
    if (!user?.id) return false;

    let members: any[] | null = null;
    const { data: membersData } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    members = membersData;

    if (!(members && members.length > 0)) {
      try {
        const repaired = await repairSessionAccess();
        if ((repaired.membershipCount || 0) > 0) {
          members = repaired.memberships;
          applySessionAccess(repaired, user);
        }
      } catch (err) {
        console.warn('[PendingAccess] repairSessionAccess:', err);
      }
    }

    const { data: owned } = await supabase
      .from('saas_tenants')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if ((members && members.length > 0) || (owned?.length || 0) > 0) {
      clearPendingRegistration();
      clearInviteToken();
      try {
        await Promise.race([
          refreshContext(user),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch {
        /* ignore */
      }
      window.location.replace('/');
      return true;
    }

    return false;
  };

  const tryEnterAgain = async () => {
    setAccepting(true);
    setError(null);
    try {
      const token = resolveInviteToken();
      if (token) {
        await ensureInviteAccess(token, user?.email || null).catch(() => null);
      } else {
        await repairSessionAccess().catch(() => null);
      }
      const linked = await verifyMembershipAndRedirect();
      if (!linked) {
        throw new Error(
          'Seu acesso ainda nao foi liberado. Fale com o administrador da empresa para adicionar seu e-mail na Equipe.',
        );
      }
      addToast('success', 'Acesso liberado', 'Bem-vindo.');
    } finally {
      setAccepting(false);
    }
  };

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
    if (attemptedRef.current) {
      setLoading(false);
      return;
    }

    attemptedRef.current = true;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const alreadyLinked = await verifyMembershipAndRedirect();
        if (alreadyLinked || cancelled) return;
        const token = resolveInviteToken();
        if (token) saveInviteToken(token);
        await tryEnterAgain().catch((err: any) => {
          if (!cancelled) setError(err.message || 'Nao foi possivel liberar o acesso.');
        });
      } catch (err: any) {
        if (!cancelled) {
          console.error('[PendingAccess]', err);
          setError(err.message || 'Nao foi possivel liberar o acesso.');
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
  }, [user, authLoading, memberships.length]);

  const handleManualAccept = async () => {
    const raw = manualToken.trim();
    if (!raw) {
      setError('Cole o codigo ou link do convite.');
      return;
    }

    let extracted: string | null = null;
    if (raw.includes('invite=')) {
      try {
        extracted = new URL(raw.startsWith('http') ? raw : `https://x.com/?${raw}`).searchParams.get(
          'invite',
        );
      } catch {
        extracted = null;
      }
    } else {
      extracted = raw;
    }

    if (!extracted) {
      setError('Link de convite invalido.');
      return;
    }

    saveInviteToken(extracted);
    setLoading(true);
    try {
      await getInviteDetails(extracted).catch(() => null);
      await ensureInviteAccess(extracted, user?.email || null);
      const linked = await verifyMembershipAndRedirect();
      if (!linked) {
        throw new Error('Convite processado, mas o acesso ainda nao foi liberado.');
      }
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel aceitar o convite.');
    } finally {
      setLoading(false);
    }
  };

  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);
  useEffect(() => {
    if (!authLoading) {
      setAuthWaitTimedOut(false);
      return;
    }
    const t = setTimeout(() => setAuthWaitTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [authLoading]);

  if ((authLoading && !authWaitTimedOut) || (loading && !error && !authWaitTimedOut)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">
          {accepting ? 'Liberando acesso...' : 'Verificando acesso...'}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(false);
            setAuthWaitTimedOut(true);
          }}
          className="mt-4 text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest"
        >
          Demorando? Continuar
        </button>
      </div>
    );
  }

  if (!user && !authLoading) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Carregando sessao...</p>
        <button
          type="button"
          onClick={() => window.location.replace('/login')}
          className="text-xs font-bold text-red-400 hover:text-red-600"
        >
          Ir para o login
        </button>
      </div>
    );
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
          <ShieldAlert className="mx-auto mb-4 text-amber-500" size={40} />
          <h1 className="text-xl font-black text-slate-900">Acesso ainda nao liberado</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Sua conta esta autenticada, mas o administrador ainda nao liberou o acesso a uma empresa.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-600 bg-amber-50 border border-amber-100 rounded-2xl p-3 leading-relaxed">
            Fale com o administrador para <strong>adicionar seu e-mail na Equipe</strong> (com senha).
            Depois saia e entre novamente com e-mail e senha.
          </p>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => signOut().then(() => window.location.replace('/login'))}
            className="mt-6 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <LogOut size={14} /> Sair e entrar com e-mail e senha
          </button>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              tryEnterAgain()
                .catch((err: any) => setError(err.message || 'Falha ao liberar acesso.'))
                .finally(() => setLoading(false));
            }}
            disabled={accepting}
            className="mt-3 w-full py-3 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {accepting ? 'Tentando...' : 'Tentar liberar acesso novamente'}
          </button>

          <details className="mt-6 text-left border-t border-slate-100 pt-4">
            <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer">
              Avancado (legado)
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Cole o link de convite antigo
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="https://eventos.escsistemas.com/login?invite=..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleManualAccept}
                disabled={accepting}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50"
              >
                Validar convite legado
              </button>
            </div>
          </details>

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
