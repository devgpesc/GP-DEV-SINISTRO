
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

interface PrivateRouteProps {
  children?: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // 1. ESTADO DE CARREGAMENTO (Bloqueante)
  // Enquanto o Supabase verifica a sessão (getSession), mostramos o Loading.
  // Isso impede que o router redirecione para /login prematuramente.
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

  // 2. NÃO AUTENTICADO
  // Se terminou de carregar e não tem usuário, manda pro login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. AUTENTICADO
  // Renderiza o conteúdo protegido (Outlet para rotas aninhadas ou children direto)
  return children ? <>{children}</> : <Outlet />;
};
