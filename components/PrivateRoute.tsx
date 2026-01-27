import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

export const PrivateRoute: React.FC = () => {
  const { user, loading } = useAuth();

  // Se estiver carregando (inicialização ou callback OAuth), exibe Splash
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
               <span className="text-sm uppercase tracking-widest font-mono">Autenticando...</span>
             </div>
             <p className="text-xs text-slate-400 font-medium">Estabelecendo conexão segura TLS.</p>
           </div>
        </div>
      </div>
    );
  }

  // Se parou de carregar e não tem user, redireciona
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se tem user, renderiza rota
  return <Outlet />;
};