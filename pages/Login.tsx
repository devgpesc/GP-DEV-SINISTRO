
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Car, Mail, Lock, Loader2, ArrowRight, Shield, RefreshCw
} from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, loading: authLoading, clearSessionData, signInWithGoogle } = useAuth();

  // Se detectar token, forçamos um estado visual de carregamento rápido
  const hasAuthToken = window.location.hash.includes('access_token');

  useEffect(() => {
    if (user && !authLoading) {
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
          : "Erro ao acessar o sistema. Tente novamente.");
        setLocalLoading(false);
      }
    } catch (err) {
      setError("Falha na conexão com o servidor.");
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
    if (confirm("Deseja atualizar o ambiente de acesso?")) {
      clearSessionData();
      window.location.reload();
    }
  };

  // Tela de Transição (Melhorada para não travar)
  if (hasAuthToken || (authLoading && !localLoading)) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-sans">
        <div className="relative flex flex-col items-center gap-8">
          <div className="absolute inset-0 bg-blue-600/20 blur-[120px] animate-pulse"></div>
          <Loader2 className="animate-spin text-blue-500 relative z-10" size={64} />
          <div className="text-center relative z-10">
            <h4 className="font-black text-white text-xl tracking-tight uppercase">Autenticando</h4>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-2">Esc Solutions 2026</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex font-sans overflow-hidden">
      {/* LADO ESQUERDO: Branding Institucional (Limpo) */}
      <div className="hidden lg:flex w-1/2 bg-[#020617] relative flex-col justify-between p-20 overflow-hidden border-r border-slate-900 shadow-2xl z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[160px]"></div>
        
        <div className="relative z-10">
          {/* Logo Superior e Nome da Empresa */}
          <div className="flex items-center gap-4 mb-24">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-600/30">
              <Car size={32} />
            </div>
            <div className="h-10 w-[1px] bg-slate-800 mx-1"></div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Esc Solutions</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] mt-1">Sistemas de Alta Performance</span>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-8xl font-black text-white leading-[0.95] tracking-tighter">
              AutoClaims<br/>
              <span className="text-blue-600 italic">Pro</span>
            </h1>
            <div className="h-1.5 w-24 bg-blue-600 rounded-full"></div>
            <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-sm">
              Gestão de sinistros e suprimentos em uma plataforma unificada.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.6em]">Esc Solutions 2026</p>
        </div>
      </div>

      {/* LADO DIREITO: Formulário de Acesso */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 bg-[#F8FAFC] lg:bg-white relative">
        <div className="w-full max-w-sm space-y-12">
          
          {/* Topo Institucional - Esc Solutions */}
          <div className="text-center lg:text-left">
             <div className="inline-flex items-center gap-3 mb-8 lg:mb-12">
                <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                  <Car size={24} />
                </div>
                <div className="flex flex-col items-start">
                    <span className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">Esc Solutions</span>
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Portal Oficial</span>
                </div>
             </div>
             <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Acesse o Sistema</h3>
          </div>

          {error && (
            <div className="p-5 bg-red-50 border border-red-100 rounded-[20px] text-red-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-in slide-in-from-top-4">
              <Shield size={18} />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  required
                  autoFocus
                  className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[20px] focus:ring-[6px] focus:ring-blue-600/5 focus:border-blue-600/20 outline-none font-bold text-slate-800 transition-all placeholder:text-slate-200 text-sm shadow-sm"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Senha</label>
                <button type="button" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Recuperar acesso</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[20px] focus:ring-[6px] focus:ring-blue-600/5 focus:border-blue-600/20 outline-none font-bold text-slate-800 transition-all placeholder:text-slate-200 text-sm shadow-sm"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={localLoading || authLoading}
              className="w-full py-6 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 group"
            >
              {localLoading ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  Entrar no Sistema <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-6 text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Ou utilizar</span>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={localLoading || authLoading}
            className="w-full py-5 bg-white border border-slate-200 rounded-[20px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-5 shadow-sm group"
          >
            {localLoading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="Google" />
                <span className="text-[11px] uppercase tracking-[0.25em]">Entrar com Google</span>
              </>
            )}
          </button>

          <div className="pt-12 flex flex-col items-center gap-6">
            <button 
              onClick={handleResetSession}
              className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-blue-600 transition-all group"
            >
              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" /> 
              Limpar Sessão
            </button>
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em]">Esc Solutions 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
