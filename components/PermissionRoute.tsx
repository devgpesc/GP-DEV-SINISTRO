import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AccessProfile } from '../services/accessControl';
import { ShieldAlert } from 'lucide-react';

type PermissionRouteProps = {
  children: React.ReactNode;
  require: keyof AccessProfile | ((access: AccessProfile) => boolean);
  fallback?: string;
};

export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  require,
  fallback = '/',
}) => {
  const { access } = useAuth();

  const allowed = typeof require === 'function'
    ? require(access)
    : !!access[require];

  if (!allowed) {
    return (
      <div className="py-24 text-center">
        <ShieldAlert className="mx-auto text-amber-500 mb-4" size={40} />
        <h2 className="text-xl font-black text-slate-800 mb-2">Acesso restrito</h2>
        <p className="text-sm text-slate-500 mb-6">Você não possui permissão para acessar esta área.</p>
        <a href={fallback} className="text-blue-600 font-bold text-sm">Voltar ao painel</a>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionRoute;
