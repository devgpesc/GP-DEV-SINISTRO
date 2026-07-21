import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Navigate } = ReactRouterDOM as any;
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { Car, LogOut } from 'lucide-react';

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
    return <MembershipGate />;
  }

  return <>{children}</>;
};

const MembershipGate: React.FC = () => {
  const { user, refreshContext } = useAuth();
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!user?.id) {
        setChecking(false);
        return;
      }

      const { data: members } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const { data: owned } = await supabase
        .from('saas_tenants')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      if ((members?.length || 0) > 0 || (owned?.length || 0) > 0) {
        await refreshContext();
        window.location.replace('/');
        return;
      }

      if (!cancelled) setChecking(false);
    };

    verify();
    return () => { cancelled = true; };
  }, [user?.id, refreshContext]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to="/pending-access" replace />;
};
