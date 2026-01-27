
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Loader2, ArrowRight, ShieldCheck, 
  LayoutDashboard, Bell, Lock, AlertCircle, RefreshCw
} from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timer para mostrar o botão de "Reset" se demorar muito
  const [showResetButton, setShowResetButton] = useState(false);
  
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle, clearSessionData } = useAuth();

  const isHashTokenPresent = window.location.hash.includes('access_token') || 
                             window.location.hash.includes('type=recovery');

  useEffect(() => {
    // Redireciona se o usuário já estiver autenticado
    if (user && !authLoading) {
      console.log('[Login] Usuário detectado, redirecionando para dashboard...');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Ativa o botão de reset após 8 segundos de espera se estiver travado carregando
  useEffect(() => {
    let timer: any;
    if (authLoading || isHashTokenPresent || localLoading) {
        timer = setTimeout(() => setShowResetButton(true), 8000);
    } else {
        setShowResetButton(false);
    }
    return () => clearTimeout(timer);
  }, [authLoading, isHashTokenPresent, localLoading]);

  const handleForceReset = () => {
      console.log('[Login] Forçando reset da sessão...');
      clearSessionData();
      // Remove hash da URL e recarrega
      window.history.replaceState(null, '', window.location.pathname);
      window.location.hash = '/login';
      window.location.reload();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading || authLoading) return;
    
    setLocalLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password 
      });
      
      if (authError) {
        setError("Credenciais inválidas. Verifique e-mail e senha.");
        setLocalLoading(false);
      }
    } catch (err) {
      setError("Falha na conexão.");
      setLocalLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Não setamos loading false aqui pois o redirect acontecerá
    } catch (err: any) {
      console.error(err);
      setError("Erro ao iniciar Google Auth: " + (err.message || 'Erro desconhecido'));
      setLocalLoading(false);
    }
  };

  // Tela de Loading (Global ou Local)
  if (authLoading || isHashTokenPresent || (localLoading && !error)) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(10,22,40,0.9),rgba(10,22,40,0.9)),url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center"></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-shimmer bg-[length:200%_100%]"></div>
        
        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in duration-700">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
              <ShieldCheck className="text-white" size={32} />
           </div>
           <div className="text-center">
             <h2 className="text-2xl font-bold text-white tracking-tight">ESC Solutions</h2>
             <div className="flex flex-col items-center gap-3 mt-4 text-blue-200 text-sm font-medium">
               <div className="flex items-center gap-2">
                 <Loader2 className="animate-spin" size={16} />
                 <span>
                    {isHashTokenPresent ? 'Processando credenciais seguras...' : 'Autenticando acesso...'}
                 </span>
               </div>
               
               {showResetButton && (
                   <div className="flex flex-col items-center gap-2 mt-4 animate-in fade-in">
                     <p className="text-xs text-red-300">O processo está demorando mais que o esperado.</p>
                     <button 
                       onClick={handleForceReset}
                       className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
                     >
                       <RefreshCw size={14}/> Reiniciar Login
                     </button>
                   </div>
               )}
             </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans bg-[#F8FAFC]">
      {/* LADO ESQUERDO: Identidade Visual ESC Solutions (Mantido igual) */}
      <div className="hidden lg:flex w-1/2 bg-[#0A1628] relative flex-col justify-between p-16 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0A1628] via-[#0f224a] to-[#0A1628] z-0"></div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-blue-900/20 to-transparent"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-blue-600 p-2.5 rounded-xl">
               <span className="font-black text-white text-xl tracking-tighter">ESC</span>
            </div>
            <span className="text-white/80 font-bold tracking-widest text-sm uppercase">Solutions</span>
          </div>

          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Sistema Integrado de<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Eventos & Sinistros</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            Gerencie e monitore eventos críticos com segurança, eficiência e controle total em tempo real.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
           <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400"><LayoutDashboard size={24}/></div>
              <div>
                <h3 className="text-white font-bold">Dashboards em Tempo Real</h3>
                <p className="text-slate-400 text-xs mt-0.5">Visão completa da operação financeira e logística.</p>
              </div>
           </div>
           <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400"><Lock size={24}/></div>
              <div>
                <h3 className="text-white font-bold">Segurança Avançada</h3>
                <p className="text-slate-400 text-xs mt-0.5">Proteção de dados com criptografia de ponta a ponta.</p>
              </div>
           </div>
        </div>

        <div className="relative z-10 text-slate-500 text-xs font-medium">
          © 2026 ESC Solutions. Todos os direitos reservados.
        </div>
      </div>

      {/* LADO DIREITO: Formulário de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 animate-in slide-in-from-right-8 duration-500">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Bem-vindo de volta</h2>
            <p className="text-slate-500 text-sm">Acesse sua conta para continuar.</p>
          </div>

          {error && (
             <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in slide-in-from-top-2">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-bold leading-relaxed">{error}</p>
             </div>
          )}

          <div className="space-y-6">
            <button 
               onClick={handleGoogleLogin}
               disabled={localLoading}
               className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all group disabled:opacity-50"
            >
               <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
               Continuar com Google
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <span className="relative bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Ou email</span>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
               <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 group-focus-within:text-blue-600 transition-colors">E-mail Corporativo</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300"
                    placeholder="voce@empresa.com"
                  />
               </div>
               
               <div className="group">
                  <div className="flex justify-between items-center mb-2">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider group-focus-within:text-blue-600 transition-colors">Senha</label>
                  </div>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                  />
               </div>

               <button 
                  type="submit" 
                  disabled={localLoading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
               >
                  {localLoading ? <Loader2 className="animate-spin" size={20}/> : (
                    <>
                      Entrar no Sistema <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                    </>
                  )}
               </button>
            </form>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                <Lock size={12} />
                <span>Ambiente Seguro com SSL/TLS</span>
             </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
