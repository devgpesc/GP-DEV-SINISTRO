
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Car } from 'lucide-react';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  // 1. BLOQUEIO DE RENDERIZAÇÃO:
  // Se o Supabase ainda está verificando o cookie/localStorage, mostramos um Loading.
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative flex items-center justify-center mb-6">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <Car className="text-blue-600" size={24} />
            </div>
        </div>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
            Restaurando Sessão...
        </p>
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
