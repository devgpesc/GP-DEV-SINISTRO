
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { auditService } from '../services/auditService';
import { Car, Mail, Lock, User, Loader2, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

const Register: React.FC = () => {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await (supabase.auth as any).signUp({
        email,
        password,
        options: {
          data: { 
            full_name: name,
            name: name
          }
        }
      });

      if (signUpError) {
        console.error("Erro detalhado:", signUpError);
        if (signUpError.message.includes("unique")) {
            setError("Este e-mail já está cadastrado.");
        } else {
            setError(signUpError.message);
        }
        setLoading(false);
      } else if (data.user) {
        // Sucesso no registro
        
        // Tenta logar automaticamente (Funciona se o Supabase não exigir email confirm)
        if (data.session) {
             // Auditoria de Registro
             await auditService.log('Register', 'User', data.user.id, { email: data.user.email });
             
             addToast('success', 'Bem-vindo!', 'Conta criada e conectada.');
             setTimeout(() => navigate('/'), 1000);
        } else {
             // Caso exija confirmação de email
             addToast('success', 'Cadastro Realizado!', 'Verifique seu e-mail para confirmar a conta.');
             setError("Conta criada! Por favor, verifique sua caixa de entrada (e spam) para clicar no link de confirmação antes de fazer login.");
             setLoading(false); // Para o loading para o usuário ler a mensagem
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
           <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-[28px] text-white shadow-2xl mb-6">
             <Car size={32} />
           </div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tighter">EVENT<span className="text-blue-600">PRO</span></h2>
        </div>

        <Link to="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft size={16}/> Voltar ao Login
        </Link>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-8">Criar Cadastro de Produção</h2>
          
          {error && (
            <div className={`mb-6 p-4 border rounded-2xl flex items-start gap-3 text-xs font-bold animate-in slide-in-from-top-2 ${error.includes('verifique') ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                <AlertCircle size={18} className="shrink-0 mt-0.5"/> 
                <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="password" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Finalizar Registro'}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
          Ambiente de Produção <span className="text-slate-800">Esc Solutions</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
