
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Car, LogOut } from 'lucide-react';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, signOut } = useAuth();

  // 1. BLOQUEIO DE RENDERIZAÇÃO COM OPÇÃO DE SAÍDA:
  // Se o Supabase ainda está verificando o cookie/localStorage, mostramos um Loading.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative flex items-center justify-center mb-8">
            <div className="w-20 h-20 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <Car className="text-blue-600 animate-pulse" size={28} />
            </div>
        </div>
        <h3 className="text-slate-700 font-bold text-lg mb-2">Iniciando Sistema</h3>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse mb-8">
            Restaurando Sessão...
        </p>
        
        {/* BOTÃO DE EMERGÊNCIA PARA DESTRAVAR */}
        <button 
            onClick={() => {
                // Força limpeza do localStorage e recarrega
                localStorage.clear(); 
                signOut().then(() => window.location.reload());
            }}
            className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full cursor-pointer"
        >
            <LogOut size={14} /> Demorando muito? Sair
        </button>
      </div>
    );
  }

  // 2. VERIFICAÇÃO FINAL:
  if (!user) {
    return <Navigate to="/login" />;
  }

  // 3. SUCESSO:
  return <>{children}</>;
};
