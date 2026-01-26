
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured, mockStorage } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Car, Mail, Lock, Loader2, ArrowRight, ShieldCheck, Info, RefreshCw } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signInWithGoogle, clearSessionData } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      // Modo Demonstração / Fallback Local
      setTimeout(() => {
        const mockUser = { id: 'mock-user-123', email: email };
        mockStorage.set('mock_user', mockUser);
        setLoading(false);
        window.location.href = '/#/';
        window.location.reload();
      }, 800);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : authError.message);
        setLoading(false);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor.");
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    if (confirm("Isso irá limpar todos os dados de acesso salvos no navegador. Deseja continuar?")) {
      clearSessionData();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      {/* Alerta de Modo Demo (Apenas se não houver URL ou Key) */}
      {!isSupabaseConfigured && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-lg bg-amber-50 border border-amber-200 p-6 rounded-[32px] shadow-2xl z-50 animate-in slide-in-from-top-4 duration-500">
          <div className="flex gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl h-fit">
              <Info size={24} className="text-amber-600" />
            </div>
            <div>
              <h4 className="font-black text-amber-900 text-sm uppercase tracking-widest mb-1">Modo de Demonstração</h4>
              <p className="text-amber-800 text-xs font-medium">Credenciais do Supabase não encontradas ou inválidas. O sistema usará armazenamento local.</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-[28px] text-white shadow-2xl shadow-blue-600/30 mb-6">
            <Car size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter">AutoClaims<span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-500 mt-2 font-medium">Gestão Inteligente de Sinistros & Compras</p>
        </div>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-slate-200 border border-slate-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldCheck size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 transition-all"
                  placeholder="exemplo@empresa.com"
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
              disabled={loading}
              className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Entrar no Sistema <ArrowRight size={18}/></>}
            </button>
          </form>

          <div className="mt-8 relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ou entrar com</span>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full mt-6 py-4 bg-white border border-slate-200 rounded-[20px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google Workspace
          </button>
          
          <p className="text-center mt-6 text-xs font-bold text-slate-400">
            Ainda não tem conta? <Link to="/register" className="text-blue-600 hover:underline">Cadastre-se</Link>
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button 
            onClick={handleResetSession}
            className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all group"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
            Limpar Cache de Acesso
          </button>

          <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
            Desenvolvido por <span className="text-slate-800">Esc Solutions</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
