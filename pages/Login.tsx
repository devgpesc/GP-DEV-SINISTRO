
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Loader2, ArrowRight, ShieldCheck, Mail, Lock, 
  LayoutDashboard, Zap, Globe, AlertCircle, Car 
} from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [company, setCompany] = useState({ name: 'AutoClaims Pro', logo: '' });

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
    // Tenta carregar config da empresa do banco
    const fetchSettings = async () => {
        try {
            const { data } = await supabase.from('saas_settings').select('*').limit(1).maybeSingle();
            if (data) {
                setCompany({ 
                    name: data.company_name || 'AutoClaims Pro', 
                    logo: data.logo_url || '' 
                });
            }
        } catch (e) {
            console.error("Erro ao carregar branding", e);
        }
    };
    fetchSettings();
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    setLocalLoading(true);
    setError(null);

    try {
      // Fix: Cast auth to any
      const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
      if (error) throw error;
      // Sucesso é tratado pelo AuthContext
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Invalid login credentials') {
          setError('Credenciais inválidas. Se você criou a conta com o Google, utilize o botão "Entrar com Google".');
      } else {
          setError('Falha na autenticação. Verifique suas credenciais.');
      }
      setLocalLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLocalLoading(true);
    setError(null);
    try {
      // Fix: Cast auth to any
      const { error } = await (supabase.auth as any).signInWithOAuth({
         provider: 'google',
         options: { 
            redirectTo: window.location.origin,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
         }
      });
      
      if (error) throw error;
      // Se não houver erro, o redirecionamento acontecerá automaticamente
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError('Não foi possível iniciar o login com Google. Verifique a configuração do Supabase.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] font-sans">
      
      {/* LADO ESQUERDO (Marketing) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-[#0A1628]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] to-[#1A2F4A] z-0"></div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
             {company.logo ? (
                <img src={company.logo} className="h-12 w-auto bg-white/10 rounded-lg p-1 backdrop-blur-sm object-contain" alt="Logo" />
             ) : (
                <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/50">
                   <Car className="text-white" size={24} />
                </div>
             )}
            <span className="text-white/90 font-bold tracking-widest text-sm uppercase font-mono">{company.name}</span>
          </div>

          <h1 className="text-5xl font-extrabold text-white leading-[1.15] mb-6 tracking-tight">
            Gestão Inteligente de<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Eventos & Sinistros</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed font-light">
            Ambiente de Produção Seguro. Gestão de frota, sinistros e auditoria financeira.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
           {[
             { icon: LayoutDashboard, title: 'Dashboards Executivos', desc: 'KPIs financeiros em tempo real.' },
             { icon: Zap, title: 'Automação de OCs', desc: 'Aprovação inteligente baseada em regras.' },
             { icon: Globe, title: 'Acesso Global', desc: 'SaaS Multi-tenant Escavel.' }
           ].map((item, idx) => (
             <div key={idx} className="group flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:translate-x-2 transition-all duration-300 cursor-default">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 group-hover:text-blue-300 transition-colors">
                  <item.icon size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm tracking-wide">{item.title}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* LADO DIREITO (Formulário) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-[420px] bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 animate-in slide-in-from-right-8 duration-700">
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Acesso Corporativo</h2>
            <p className="text-slate-500 text-sm mt-2 font-medium">Identifique-se para continuar.</p>
          </div>

          {error && (
             <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-bold leading-relaxed">{error}</p>
             </div>
          )}

          <div className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-5">
                 <div className="group relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      type="email" 
                      required 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      placeholder="seu@email.com"
                    />
                 </div>
                 
                 <div className="group relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      type="password" 
                      required 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      placeholder="Sua senha"
                    />
                 </div>

                 <button 
                    type="submit" 
                    disabled={localLoading}
                    className="w-full py-3.5 bg-[#0066FF] text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                    {localLoading ? <Loader2 className="animate-spin" size={20}/> : (
                      <>
                        Entrar no Sistema <ArrowRight size={18} className="opacity-80"/>
                      </>
                    )}
                 </button>
              </form>
              
               <button 
                 onClick={handleGoogle}
                 disabled={localLoading}
                 className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all group disabled:opacity-60"
              >
                 <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                 </svg>
                 Entrar com Google
              </button>
            </div>

          <div className="mt-10 pt-6 border-t border-slate-50 text-center">
             <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <ShieldCheck size={14} className="text-green-500" />
                Produção Online • Supabase
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
