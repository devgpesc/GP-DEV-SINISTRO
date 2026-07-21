import React, { useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, Navigate } = ReactRouterDOM as any;
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import {
  ensureInviteAccess,
  getInviteDetails,
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

const PendingAccess: React.FC = () => {
  const { user, loading: authLoading, memberships, signOut } = useAuth();
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

    const { data: members } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    const { data: owned } = await supabase
      .from('saas_tenants')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if ((members?.length || 0) > 0 || (owned?.length || 0) > 0) {
      clearPendingRegistration();
      clearInviteToken();
      window.location.replace('/');
      return true;
    }

    return false;
  };

  const linkInviteAccess = async (token?: string | null) => {
    setAccepting(true);
    setError(null);

    try {
      const result = await ensureInviteAccess(token);
      const status = result?.status;

      if (status === 'no_invite') {
        if (token) {
          const details = await getInviteDetails(token);
          if (details) setPendingInvite({ ...details, token });
        }
        throw new Error('Nenhum convite encontrado para este e-mail. Solicite um novo convite ao administrador.');
      }

      const linked = await verifyMembershipAndRedirect();
      if (!linked) {
        throw new Error('Convite processado, mas o acesso ainda nao foi liberado. Atualize a pagina ou tente novamente.');
      }

      addToast('success', 'Convite aceito!', 'Seu acesso foi configurado com sucesso.');
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
    if (attemptedRef.current) return;

    attemptedRef.current = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const alreadyLinked = await verifyMembershipAndRedirect();
        if (alreadyLinked) return;

        const token = resolveInviteToken();
        if (token) {
          saveInviteToken(token);
          const details = await getInviteDetails(token);
          if (details) setPendingInvite({ ...details, token });
        }

        await linkInviteAccess(token);
      } catch (err: any) {
        console.error('[PendingAccess]', err);
        setError(err.message || 'Nao foi possivel vincular seu convite.');
      } finally {
        setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => setLoading(false), 12000);
    run().finally(() => clearTimeout(safetyTimer));

    return () => clearTimeout(safetyTimer);
  }, [user, authLoading, memberships.length]);

  const handleManualAccept = async () => {
    const raw = manualToken.trim();
    if (!raw) {
      setError('Cole o codigo ou link do convite.');
      return;
    }

    const extracted = raw.includes('invite=')
      ? new URL(raw.startsWith('http') ? raw : `https://x.com/?${raw}`).searchParams.get('invite')
      : raw;

    if (!extracted) {
      setError('Link de convite invalido.');
      return;
    }

    saveInviteToken(extracted);
    attemptedRef.current = false;
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

  if (authLoading || (loading && !error)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">
          {accepting ? 'Vinculando convite...' : 'Verificando acesso...'}
        </p>
        {error && (
          <p className="text-xs font-bold text-red-600 text-center max-w-sm">{error}</p>
        )}
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
            </>
          ) : (
            <>
              <ShieldAlert className="mx-auto mb-4 text-amber-500" size={40} />
              <h1 className="text-xl font-black text-slate-900">Acesso pendente</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Sua conta foi autenticada, mas ainda nao possui vinculo com uma empresa.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Cole o link de convite ou clique em tentar novamente.
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
              linkInviteAccess(resolveInviteToken())
                .catch((err: any) => setError(err.message || 'Falha ao vincular convite.'))
                .finally(() => setLoading(false));
            }}
            disabled={accepting}
            className="mt-6 w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {accepting ? 'Vinculando...' : 'Tentar vincular convite novamente'}
          </button>

          <div className="mt-6 space-y-3 text-left">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Ou cole o link do convite
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
