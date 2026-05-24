import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useNavigate, useSearchParams } = ReactRouterDOM as any;
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { auditService } from '../services/auditService';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { Mail, Lock, User, Loader2, ArrowLeft, Building, AlertCircle, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import EscLogo from '../components/EscLogo';

const PENDING_REGISTRATION_STORAGE_KEY = 'sb-autoclaims-pending-registration';

const Register: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [verifyingInvite, setVerifyingInvite] = useState(false);

  useEffect(() => {
    const token = searchParams.get('invite');
    if (token) {
      setInviteToken(token);
      verifyInvite(token);
    }
  }, [searchParams]);

  const verifyInvite = async (token: string) => {
    setVerifyingInvite(true);
    setError(null);
    try {
      const { data: invite, error: inviteError } = await supabase.rpc('get_invite_details', { invite_token: token });

      if (inviteError) throw inviteError;
      if (!invite) throw new Error('Convite invalido ou expirado.');

      setInviteData({ ...invite, tenant_name: invite.tenant_name });
      setEmail(invite.email || '');
      setName(invite.name || '');
      setCompanyName(invite.tenant_name || 'Empresa Convidada');
    } catch (err: any) {
      console.error('Erro ao verificar convite:', err);
      setError(err.message || 'Erro ao carregar dados do convite.');
      setInviteToken(null);
    } finally {
      setVerifyingInvite(false);
    }
  };

  const savePendingRegistration = (payload: Record<string, any>) => {
    localStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString()
    }));
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
      const { data, error: signUpError } = await (supabase.auth as any).signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(inviteToken ? `/auth/callback?invite=${inviteToken}` : '/auth/callback'),
          data: {
            full_name: trimmedName,
            name: trimmedName
          }
        }
      });

      if (signUpError) {
        const signUpMessage = (signUpError.message || '').toLowerCase();
        if (signUpMessage.includes('error sending confirmation email') || signUpMessage.includes('error sending confirmation mail')) {
          throw new Error('Nao foi possivel enviar o e-mail de confirmacao. Verifique SMTP e URLs de redirecionamento no Supabase.');
        }
        if (signUpError.message.includes('unique') || signUpMessage.includes('already registered')) {
          throw new Error('Este e-mail ja esta cadastrado. Tente fazer login.');
        }
        throw signUpError;
      }

      if (!data.user) throw new Error('Nao foi possivel criar o usuario.');

      if (inviteToken && inviteData) {
        if (!data.session) {
          savePendingRegistration({
            email: normalizedEmail,
            name: trimmedName,
            inviteToken
          });
          addToast('success', 'Cadastro realizado!', 'Confirme seu e-mail para concluir o convite.');
          setError('Conta criada! Confirme seu e-mail para ativar o acesso a empresa.');
          setLoading(false);
          return;
        }

        const { error: acceptError } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
        if (acceptError) throw acceptError;

        await auditService.log('Accept Invite', 'Invitation', inviteData.id, { tenant: inviteData.tenant_id });
        addToast('success', 'Cadastro concluido!', `Voce agora faz parte de ${trimmedCompanyName}.`);
        setTimeout(() => navigate('/'), 1200);
        return;
      }

      if (data.session) {
        const { error: registrationError } = await supabase.rpc('complete_registration', {
          company_name: trimmedCompanyName,
          full_name: trimmedName
        });
        if (registrationError) throw registrationError;

        await auditService.log('Register', 'User', data.user.id, { email: data.user.email, company: trimmedCompanyName });
        addToast('success', 'Conta criada!', `Bem-vindo a ${trimmedCompanyName}.`);
        setTimeout(() => navigate('/'), 1200);
        return;
      }

      savePendingRegistration({
        email: normalizedEmail,
        name: trimmedName,
        companyName: trimmedCompanyName
      });
      addToast('success', 'Cadastro realizado!', 'Verifique seu e-mail para confirmar a conta.');
      setError('Conta criada! Verifique sua caixa de entrada e spam para confirmar o e-mail.');
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro de conexao. Verifique sua internet e tente novamente.');
      setLoading(false);
    }
  };

  if (verifyingInvite) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-6 scale-125">
            <EscLogo className="w-16 h-16 text-slate-900" classNameText="text-slate-900 text-3xl" />
          </div>

          <h2 className="text-3xl font-black text-slate-800 tracking-tighter mt-2">EVENT<span className="text-blue-600">PRO</span></h2>
        </div>

        <Link to={inviteToken ? `/login?invite=${inviteToken}` : '/login'} className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft size={16} /> {inviteToken ? 'Ja tenho conta, entrar' : 'Voltar ao Login'}
        </Link>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
            {inviteToken ? 'Aceitar Convite' : 'Criar Conta Empresarial'}
          </h2>
          {inviteToken ? (
            <p className="text-sm text-blue-600 font-bold mb-6 flex items-center gap-2"><LinkIcon size={14} /> Voce foi convidado para: {companyName}</p>
          ) : (
            <p className="text-sm text-slate-500 font-medium mb-6">Comece a gerenciar sua frota e sinistros hoje.</p>
          )}

          {error && (
            <div className={`mb-6 p-4 border rounded-2xl flex items-start gap-3 text-xs font-bold animate-in slide-in-from-top-2 ${error.toLowerCase().includes('verifique') || error.toLowerCase().includes('confirm') ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {!inviteToken && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Nome da Sua Empresa</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Transportadora Silva" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Seu Nome</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com" readOnly={!!inviteToken} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Definir Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4">
              {loading ? <Loader2 className="animate-spin" size={20} /> : (inviteToken ? 'Entrar na Empresa' : 'Criar Conta & Acessar')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
