
import React from 'react';
import { Navigate, Outlet } from 'https://esm.sh/react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

interface PrivateRouteProps {
  children?: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // 1. ESTADO DE LOADING (Bloqueio Total)
  // Se o contexto diz que está carregando (seja verificando sessão ou processando OAuth),
  // mostramos o Splash Screen. NÃO redirecionamos.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-6 animate-pulse">
           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-lg border border-blue-100">
              <ShieldCheck size={32} />
           </div>
           <div className="flex flex-col items-center gap-2">
             <div className="flex items-center gap-2 text-blue-600 font-bold">
               <Loader2 className="animate-spin" size={20} />
               <span className="text-sm uppercase tracking-widest">Sincronizando Sessão...</span>
             </div>
             <p className="text-xs text-slate-400">Verificando credenciais de acesso seguro.</p>
           </div>
        </div>
      </div>
    );
  }

  // 2. VERIFICAÇÃO DE USUÁRIO
  // Só chegamos aqui se loading === false. Se não tiver usuário, tchau.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. RENDERIZAÇÃO
  // Usuário autenticado e carregamento finalizado.
  return children ? <>{children}</> : <Outlet />;
};
