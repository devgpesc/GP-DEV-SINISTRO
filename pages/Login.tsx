
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Car, Mail, Lock, Loader2, ArrowRight, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('devgpesc@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signInWithGoogle, clearSessionData } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Tentativa de login real no Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password 
      });
      
      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Credenciais inválidas. Verifique seu e-mail e senha no novo projeto.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
      } else if (data.user) {
        navigate('/');
      }
    } catch (err) {
      setError("Erro de conexão com a rede ou com o servidor Supabase.");
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    if (confirm("Deseja limpar todos os dados de sessão e cookies? Use isso se estiver tendo problemas de login persistentes.")) {
      clearSessionData();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-[28px] text-white shadow-2xl shadow-blue-600/30 mb-6">
            <Car size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter">AutoClaims<span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-500 mt-2 font-medium">Gestão Inteligente • Produção</p>
        </div>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-slate-200 border border-slate-100">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-[10px] font-black uppercase flex items-center gap-3">
              <AlertTriangle size={18} /> Configuração pendente no servidor
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldCheck size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 transition-all"
                  placeholder="devgpesc@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Acessar Produção <ArrowRight size={18}/></>}
            </button>
          </form>

          <div className="mt-8 relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">v 1.2.0</span>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full mt-6 py-4 bg-white border border-slate-200 rounded-[20px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google Workspace
          </button>
          
          <p className="text-center mt-6 text-xs font-bold text-slate-400">
            Novo por aqui? <Link to="/register" className="text-blue-600 hover:underline">Solicitar Acesso</Link>
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button 
            onClick={handleResetSession}
            className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all group"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
            Resetar Cookies de Produção
          </button>

          <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
            Backend: <span className="text-slate-800 tracking-tighter">yxawavenbognqiihaesh</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
