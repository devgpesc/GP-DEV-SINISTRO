
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Car, Mail, Lock, User, Loader2, ArrowLeft } from 'lucide-react';

const Register: React.FC = () => {
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      alert("Cadastro realizado! Verifique seu email para confirmar.");
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest mb-8 transition-colors">
          <ArrowLeft size={16}/> Voltar ao Login
        </Link>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-8">Criar Conta</h2>
          
          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl">{error}</div>}

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="password" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20">
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Cadastrar agora'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
