import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, useLocation } = ReactRouterDOM as any;
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const authError = searchParams.get('error_description') || hashParams.get('error_description');

        if (authError) throw new Error(authError);

        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await (supabase.auth as any).exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session }, error: sessionError } = await (supabase.auth as any).getSession();
        if (sessionError) throw sessionError;

        const inviteToken = searchParams.get('invite');
        if (session?.user && inviteToken) {
          const { error: inviteError } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
          if (inviteError) throw inviteError;
          addToast('success', 'Convite aceito', 'Seu acesso foi vinculado a empresa.');
        }

        if (session?.user) {
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={36} />
          <h1 className="text-xl font-black text-slate-900">Erro na confirmacao</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-6 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
          >
            Voltar ao login
          </button>
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
