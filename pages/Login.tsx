
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, Link, useLocation } = ReactRouterDOM as any;
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { saveInviteToken, readInviteToken } from '../services/pendingRegistration';
import { ensureInviteAccess, getInviteDetails, type InviteDetails } from '../services/inviteService';
import { 
  Loader2, ArrowRight, ShieldCheck, Mail, Lock, 
  LayoutDashboard, Zap, Globe, AlertCircle, Eye, EyeOff, Link as LinkIcon
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite') || readInviteToken();
  const { user, loading: authLoading, memberships, isSuperAdmin, refreshContext } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteDetails | null>(null);
  
  const [company] = useState({ name: 'Grupo Esc Sistemas', product: 'EventsCar' });

  useEffect(() => {
    if (!inviteToken) return;
    saveInviteToken(inviteToken);
    getInviteDetails(inviteToken)
      .then((details) => {
        if (details) {
          setInviteInfo(details);
          setEmail(details.email || '');
        }
      })
      .catch(() => setError('Convite invalido ou expirado.'));
  }, [inviteToken]);

  useEffect(() => {
    if (!user || localLoading || authLoading) return;

    const redirectIfReady = async () => {
      if (isSuperAdmin || memberships.length > 0) {
        navigate('/', { replace: true });
        return;
      }

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
        await refreshContext();
        navigate('/', { replace: true });
        return;
      }

      // Sem acesso: nao redirecionar automaticamente — deixar usuario clicar em Entrar/Google
    };

    redirectIfReady();
  }, [user, localLoading, authLoading, navigate, memberships.length, isSuperAdmin, refreshContext]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await (supabase.auth as any).signInWithPassword({ email, password });
      
      if (authError) throw authError;
      if (!data.user) throw new Error("Usuario nao encontrado.");

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.role === 'super_admin') {
          setLocalLoading(false);
          navigate('/', { replace: true });
          return; 
      }

      const { data: members } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1);

      const { data: owned } = await supabase
        .from('saas_tenants')
        .select('id')
        .eq('owner_id', data.user.id)
        .limit(1);

      if ((members?.length || 0) > 0 || (owned?.length || 0) > 0) {
        await refreshContext();
        setLocalLoading(false);
        navigate('/', { replace: true });
        return;
      }

      if (inviteToken) {
        const accepted = await processInviteAfterAuth();
        const { data: membersAfter } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1);

        if (accepted || (membersAfter?.length || 0) > 0) {
          await refreshContext();
          setLocalLoading(false);
          navigate('/', { replace: true });
          return;
        }

        setLocalLoading(false);
        setError('Nao foi possivel vincular o convite. Confirme se esta usando o e-mail ludimilar589@gmail.com.');
        return;
      }

      const { data: memberships } = await supabase
        .from('organization_members')
        .select('id, tenant_id')
        .eq('user_id', data.user.id);
        
      const { data: ownedTenants } = await supabase
        .from('saas_tenants')
        .select('id')
        .eq('owner_id', data.user.id);

      const hasMembership = (memberships && memberships.length > 0) || (ownedTenants && ownedTenants.length > 0);

      if (!hasMembership) {
          setLocalLoading(false);
          setError('Sua conta nao possui vinculo com uma empresa. Solicite um convite ao administrador.');
          return;
      }

      setLocalLoading(false);
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Invalid login credentials') {
          setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else {
          setError(err.message || 'Nao foi possivel conectar. Tente novamente mais tarde.');
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
    <div className="min-h-screen flex bg-[#F8FAFC] font-sans selection:bg-blue-100 selection:text-blue-900">
      
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-[#0F172A]">
        <div className="absolute inset-0 z-0 opacity-20" style={{ 
            backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', 
            backgroundSize: '32px 32px' 
        }}></div>
        
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="mb-12">
             <div className="flex items-center gap-3">
                <EscLogo className="w-16 h-16 text-white" classNameText="text-white text-3xl" />
             </div>
          </div>

          <h1 className="text-5xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
            Gestao de Sinistros <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Inteligente & Agil</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed font-light mb-10">
            Plataforma completa para abertura, rastreamento e auditoria financeira de eventos automotivos.
          </p>

          <div className="space-y-5">
             {[
               { icon: LayoutDashboard, label: 'Dashboards Executivos em Tempo Real' },
               { icon: Zap, label: 'Automacao de Cotacoes e OCs' },
               { icon: ShieldCheck, label: 'Auditoria e Compliance Financeiro' }
             ].map((item, idx) => (
               <div key={idx} className="flex items-center gap-4 group">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                    <item.icon size={20} />
                  </div>
                  <span className="text-slate-300 font-medium text-sm">{item.label}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-[#F8FAFC]">
        <div className="w-full max-w-xl animate-in slide-in-from-right-8 duration-700 fade-in">
          
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center flex-col">
             <EscLogo className="w-12 h-12 text-slate-900" classNameText="text-slate-900 text-2xl" />
          </div>

          <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {inviteInfo ? 'Entrar e aceitar convite' : 'Acesso ao Painel'}
              </h2>
              <p className="text-slate-500 text-base mt-2 font-medium">
                {inviteInfo
                  ? `Convite para ${inviteInfo.tenant_name}`
                  : 'Bem-vindo de volta! Insira suas credenciais.'}
              </p>
            </div>

            {inviteInfo && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-blue-700">
                <LinkIcon className="shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-bold leading-relaxed">
                  Use o e-mail <strong>{inviteInfo.email}</strong> para entrar e vincular sua conta a empresa.
                </p>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
                  <div className="relative group">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        readOnly={!!inviteInfo}
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-base font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
                        placeholder="nome@empresa.com"
                      />
                  </div>
               </div>
               
               <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha</label>
                    <a href="#" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">Esqueceu?</a>
                  </div>
                  <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-base font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
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
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
               >
                  {localLoading ? <Loader2 className="animate-spin" size={22}/> : (
                    <>
                      {inviteInfo ? 'Entrar e aceitar convite' : 'Entrar na Plataforma'} <ArrowRight size={20} className="opacity-80"/>
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
               className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all group disabled:opacity-60"
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

          <div className="mt-8 text-center space-y-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                <ShieldCheck size={12} className="text-green-600" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ambiente Seguro SSL</span>
             </div>
             <p className="text-xs text-slate-500 font-black">© 2026 {company.product} by {company.name}.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
