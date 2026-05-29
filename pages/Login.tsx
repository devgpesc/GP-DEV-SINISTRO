
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, Link, useLocation } = ReactRouterDOM as any;
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getAuthRedirectUrl } from '../services/authRedirect';
import { 
  Loader2, ArrowRight, ShieldCheck, Mail, Lock, 
  LayoutDashboard, Zap, Globe, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import EscLogo from '../components/EscLogo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite');
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Configuracao visual da marca
  const [company] = useState({ name: 'Grupo Esc Sistemas', product: 'EventsCar' });

  useEffect(() => {
    // Only redirect if a user is already present when the component mounts, 
    // or if the component is purely idle. During login, localLoading is true.
    if (user && !localLoading) {
      if (inviteToken) {
         // Auto-redeem for OAuth redirects or previously logged in users
         const redeemInvite = async () => {
             try {
                const { error: acceptError } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
                if (acceptError) throw acceptError;
             } catch (e) {
                console.warn("Auto-redeem fail", e);
             } finally {
                navigate('/', { replace: true });
             }
         };
         redeemInvite();
      } else {
         navigate('/', { replace: true });
      }
    }
  }, [user, localLoading, navigate, inviteToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setError(null);

    try {
      // 1. Autenticacao basica (Email/Senha)
      // Casting supabase.auth to any
      const { data, error: authError } = await (supabase.auth as any).signInWithPassword({ email, password });
      
      if (authError) throw authError;
      if (!data.user) throw new Error("Usuario nao encontrado.");

      // 2. Verificacao de permissao de acesso (vinculo com empresa)
      // Verifica se o usuario tem perfil de Super Admin ou se pertence a alguma empresa ativa
      
      // Checa perfil primeiro
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
        
      // PROCESSA CONVITE SE EXISTIR
      if (inviteToken) {
          try {
              const { error: acceptError } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
              if (acceptError) throw acceptError;
          } catch (e) {
              console.warn("Erro ao processar convite no login", e);
          }
      }

      if (profile?.role === 'super_admin') {
          // Super Admin da plataforma sempre passa
          setLocalLoading(false);
          navigate('/', { replace: true });
          return; 
      }

      // Se nao for admin global, verifica vinculo com tenant ativo
      // NOTA: Removido o inner join com saas_tenants pois usuarios normais nao tem permissao de leitura na tabela saas_tenants devido ao RLS.
      const { data: memberships, error: memberError } = await supabase
        .from('organization_members')
        .select('id, tenant_id')
        .eq('user_id', data.user.id);
        
      const { data: ownedTenants } = await supabase
        .from('saas_tenants')
        .select('id')
        .eq('owner_id', data.user.id);

      const hasMembership = (memberships && memberships.length > 0) || (ownedTenants && ownedTenants.length > 0);

      if (memberError || !hasMembership) {
          // Logout imediato se nao tiver permissao
          await (supabase.auth as any).signOut();
          setLocalLoading(false);
          setError('Acesso negado: este usuario nao possui vinculo com uma empresa ativa.');
          return;
      }

      // Sucesso - O AuthContext detectara a sessao e redirecionara
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
    try {
      // Casting supabase.auth to any
      const { error } = await (supabase.auth as any).signInWithOAuth({
         provider: 'google',
         options: { 
            redirectTo: getAuthRedirectUrl(inviteToken ? `/auth/callback?invite=${inviteToken}` : '/auth/callback'),
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
      
      {/* LADO ESQUERDO (Branding & Valor) - Visivel apenas em Desktop */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-[#0F172A]">
        {/* Background Pattern Sutil */}
        <div className="absolute inset-0 z-0 opacity-20" style={{ 
            backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', 
            backgroundSize: '32px 32px' 
        }}></div>
        
        {/* Gradiente Decorativo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
          {/* LOGO AREA */}
          <div className="mb-12">
             {/* Logo Customizada */}
             <div className="flex items-center gap-4">
                <EscLogo className="w-16 h-16 text-white" classNameText="text-white text-3xl" />
                <img
                  src="/brand/grupo-esc-sistemas.jpeg"
                  alt="Grupo Esc Sistemas"
                  className="h-12 w-28 rounded-lg object-cover object-center opacity-90 ring-1 ring-white/10"
                />
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

      {/* LADO DIREITO (Login Form) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-[#F8FAFC]">
        {/* Aumentado max-w para ficar maior e mais confortavel */}
        <div className="w-full max-w-xl animate-in slide-in-from-right-8 duration-700 fade-in">
          
          {/* Mobile Logo Only */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center flex-col">
             <EscLogo className="w-12 h-12 text-slate-900" classNameText="text-slate-900 text-2xl" />
          </div>

          <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Acesso ao Painel</h2>
              <p className="text-slate-500 text-base mt-2 font-medium">Bem-vindo de volta! Insira suas credenciais.</p>
            </div>

            {error && (
               <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in slide-in-from-top-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <p className="text-sm font-bold leading-relaxed">{error}</p>
               </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail Corporativo</label>
                  <div className="relative group">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
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
                      Entrar na Plataforma <ArrowRight size={20} className="opacity-80"/>
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
               Google Workspace
            </button>

            <div className="mt-10 text-center">
               <p className="text-slate-500 text-sm font-medium">
                 Nao tem uma conta? <Link to="/register" className="text-blue-600 font-bold hover:underline">Criar conta empresarial</Link>
               </p>
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
