import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Navigate } = ReactRouterDOM as any;
import { useAuth } from '../context/AuthContext';
import { Car, LogOut, ShieldAlert } from 'lucide-react';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, memberships, isSuperAdmin, signOut } = useAuth();

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
        
        <button 
            onClick={() => {
                localStorage.clear(); 
                signOut().then(() => window.location.replace('/login'));
            }}
            className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full cursor-pointer"
        >
            <LogOut size={14} /> Demorando muito? Sair
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (memberships.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 text-amber-500" size={36} />
          <h1 className="text-xl font-black text-slate-900">Acesso nao configurado</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Sua conta foi autenticada, mas ainda nao possui vinculo com uma empresa ativa.
            Solicite um convite ao administrador ou crie uma conta empresarial.
          </p>
          <button
            type="button"
            onClick={() => signOut().then(() => window.location.replace('/login'))}
            className="mt-6 rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
