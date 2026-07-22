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
  type InviteDetails,
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
  CheckCircle2,
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const PendingAccess: React.FC = () => {
  const { user, loading: authLoading, memberships, refreshContext, signOut } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<(InviteDetails & { token?: string }) | null>(null);
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

    if (!(members?.length > 0)) {
      try {
        const repaired = await repairSessionAccess();
        if ((repaired.membershipCount || 0) > 0) {
          members = repaired.memberships;
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

    if ((members?.length || 0) > 0 || (owned?.length || 0) > 0) {
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

  const linkInviteAccess = async (token?: string | null) => {
    setAccepting(true);
    setError(null);

    try {
      const result = await ensureInviteAccess(token, user?.email || null);
      const status = result?.status;

      if (status === 'no_invite') {
        if (token) {
          try {
            const details = await getInviteDetails(token);
            if (details) setPendingInvite({ ...details, token });
          } catch {
            /* ignore */
          }
        }
        throw new Error(
          'Nenhum convite encontrado para este e-mail. Solicite um novo convite ao administrador.',
        );
      }

      // Apos API/RPC, recarrega membership com pequena retentativa.
      for (let i = 0; i < 3; i++) {
        const linked = await verifyMembershipAndRedirect();
        if (linked) {
          addToast('success', 'Convite aceito!', 'Seu acesso foi configurado com sucesso.');
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      throw new Error(
        'Convite processado, mas o acesso ainda nao foi liberado. Clique em "Tentar vincular" ou atualize a pagina (F5).',
      );
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
        if (token) {
          saveInviteToken(token);
          try {
            const details = await getInviteDetails(token);
            if (details && !cancelled) setPendingInvite({ ...details, token });
          } catch {
            /* convite ja usado ou invalido — segue para sync */
          }
        }

        await linkInviteAccess(token);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[PendingAccess]', err);
          setError(err.message || 'Nao foi possivel vincular seu convite.');
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
      const details = await getInviteDetails(extracted);
      if (details) setPendingInvite({ ...details, token: extracted });
      await linkInviteAccess(extracted);
    } catch (err: any) {
      setError(err.message || 'Nao foi possivel aceitar o convite.');
    } finally {
      setLoading(false);
    }
  };

  // Nunca ficar preso em "verificando" se a sessao demorar: apos 8s mostra a UI.
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
          {accepting ? 'Vinculando convite...' : 'Verificando acesso...'}
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
          {pendingInvite ? (
            <>
              <CheckCircle2 className="mx-auto mb-4 text-green-500" size={40} />
              <h1 className="text-xl font-black text-slate-900">Convite encontrado</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Voce foi convidado(a) para acessar{' '}
                <strong className="text-slate-800">{pendingInvite.tenant_name}</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                E-mail do convite: <strong>{pendingInvite.email}</strong>
              </p>
            </>
          ) : (
            <>
              <ShieldAlert className="mx-auto mb-4 text-amber-500" size={40} />
              <h1 className="text-xl font-black text-slate-900">Acesso pendente</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Sua conta foi autenticada, mas nao esta vinculada a nenhuma empresa.
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-600 bg-amber-50 border border-amber-100 rounded-2xl p-3 leading-relaxed">
                Se voce ja teve acesso e foi removido, peca ao administrador para{' '}
                <strong>recriar o acesso</strong> em Equipe (e-mail + senha) ou{' '}
                <strong>redefinir a senha</strong> em Editar usuario.
                Nao e necessario link de convite.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Se ja tem senha definida pelo admin, saia e entre com e-mail/senha. Google so funciona se o admin liberou o mesmo e-mail.
              </p>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              attemptedRef.current = false;
              setLoading(true);
              setError(null);
              const token = resolveInviteToken();
              linkInviteAccess(token)
                .catch((err: any) => setError(err.message || 'Falha ao vincular convite.'))
                .finally(() => setLoading(false));
            }}
            disabled={accepting}
            className="mt-6 w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {accepting ? 'Vinculando...' : 'Reparar acesso e entrar'}
          </button>

          <div className="mt-6 space-y-3 text-left">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Cole o link do novo convite
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="https://eventos.escsistemas.com/login?invite=..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <button
              type="button"
              onClick={handleManualAccept}
              disabled={accepting}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50"
            >
              {accepting ? 'Vinculando...' : 'Validar convite'}
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3">
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
