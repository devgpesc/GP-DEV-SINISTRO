
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Car, Mail, Lock, Loader2, ArrowRight, 
  ShieldCheck, RefreshCw, AlertTriangle, 
  Globe, Shield, ChevronRight, Activity, Zap, CheckCircle2
} from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, loading: authLoading, clearSessionData, signInWithGoogle } = useAuth();

  // Verifica se estamos processando um retorno do OAuth
  const isReturningFromOAuth = window.location.href.includes('access_token') || 
                               window.location.hash.includes('access_token');

  useEffect(() => {
    if (user && !authLoading) {
      console.log('[Login] Usuário detectado, redirecionando para Home...');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

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
        setError(authError.message === "Invalid login credentials" 
          ? "Credenciais inválidas. Verifique seu e-mail e senha." 
          : authError.message);
        setLocalLoading(false);
      }
    } catch (err) {
      setError("Falha na autenticação. Verifique sua conexão.");
      setLocalLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError("Erro no acesso Google: " + err.message);
      setLocalLoading(false);
    }
  };

  const handleResetSession = () => {
    if (confirm("Deseja resetar a sessão e limpar cookies de produção?")) {
      clearSessionData();
      window.location.reload();
    }
  };

  // Tela de Loading de Transição (Crucial para evitar que o usuário veja o login antes do redirect)
  if (isReturningFromOAuth || (authLoading && !localLoading)) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 font-sans">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-[100px] animate-pulse"></div>
          <div className="relative bg-slate-900 border border-slate-800 p-16 rounded-[48px] shadow-2xl flex flex-col items-center gap-8 max-w-sm w-full">
            <Loader2 className="animate-spin text-blue-500" size={64} />
            <div className="text-center">
              <h4 className="font-black text-white text-xl tracking-tight">Autenticando</h4>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] mt-2">Sincronizando com Workspace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans overflow-hidden">
      {/* PAINEL ESQUERDO: Visual & Branding (Ocupa 50-60% no desktop) */}
      <div className="hidden lg:flex w-[55%] bg-[#020617] relative flex-col justify-between p-16 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/30">
              <Car size={32} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">
              AutoClaims<span className="text-blue-500 italic">Pro</span>
            </h1>
          </div>

          <div className="space-y-12 max-w-lg">
            <h2 className="text-6xl font-black text-white leading-[1.1] tracking-tighter">
              Gestão de Sinistros com <span className="text-blue-500">Inteligência Estratégica.</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed">
              Otimize cotações, gerencie ordens de compra e reduza custos operacionais em uma única interface corporativa robusta.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-widest">
                  <Zap size={14}/> Velocidade
                </div>
                <p className="text-white text-2xl font-black tracking-tight">+85%</p>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No processamento de RFQs</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400 font-black text-[10px] uppercase tracking-widest">
                  <CheckCircle2 size={14}/> Economia
                </div>
                <p className="text-white text-2xl font-black tracking-tight">R$ 1.2M+</p>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Poupados por parceiros</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Network Operational</p>
          </div>
          <span className="text-slate-800">|</span>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">v2.5 High-Speed Core</p>
        </div>
      </div>

      {/* PAINEL DIREITO: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 relative bg-white">
        <div className="w-full max-w-sm space-y-12">
          <div className="lg:hidden text-center mb-12">
             <div className="inline-flex items-center justify-center p-5 bg-[#020617] rounded-[28px] text-white shadow-xl mb-6">
                <Car size={32} />
             </div>
             <h1 className="text-4xl font-black text-[#020617] tracking-tighter">AutoClaims<span className="text-blue-600">Pro</span></h1>
          </div>

          <div className="space-y-2">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Acesso ao Hub</h3>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Portal Corporativo de Seguros</p>
          </div>

          {error && (
            <div className="p-5 bg-rose-50 border border-rose-100 rounded-[28px] text-rose-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-in slide-in-from-top-4">
              <div className="bg-rose-100 p-2 rounded-xl"><Shield size={18} /></div>
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail Profissional</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  required
                  autoFocus
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-[6px] focus:ring-blue-600/5 focus:border-blue-600/20 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300 text-sm"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sua Senha</label>
                <button type="button" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Recuperar</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-[6px] focus:ring-blue-600/5 focus:border-blue-600/20 focus:bg-white outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300 text-sm"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={localLoading || authLoading}
              className="w-full py-6 bg-[#020617] text-white rounded-[28px] font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(2,6,23,0.3)] hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 overflow-hidden group"
            >
              {localLoading ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  Acessar Produção <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-6 text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">SSO Integration</span>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={localLoading || authLoading}
            className="w-full py-5 bg-white border border-slate-200 rounded-[24px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-5 shadow-sm group"
          >
            {localLoading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="Google" />
                <span className="text-[11px] uppercase tracking-[0.25em]">Google Workspace</span>
              </>
            )}
          </button>

          <div className="pt-8 flex flex-col items-center gap-6">
            <button 
              onClick={handleResetSession}
              className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-all group"
            >
              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" /> 
              Resetar Endpoint
            </button>
            <p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.4em]">Powered by Esc Solutions © 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
