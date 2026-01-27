
import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children?: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, active, badge }: { to: string, icon: any, label: string, active: boolean, badge?: string }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative group ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
    {badge && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-500 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
        {badge}
      </span>
    )}
  </Link>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, profile, isSuperAdmin, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura.', time: '10 min', icon: ShoppingBag, color: 'blue' },
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-blue-600 p-2 rounded-lg"><Car className="text-white" size={24} /></div>
            <h1 className="text-xl font-bold tracking-tight">AutoClaims<span className="text-blue-500">Pro</span></h1>
          </div>
          
          <nav className="space-y-1">
            {isSuperAdmin && (
              <div className="mb-6 pb-6 border-b border-slate-800">
                <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Administração Global</p>
                <NavItem to="/saas-admin" icon={Globe} label="Gestão SaaS" active={location.pathname === '/saas-admin'} badge="Super" />
              </div>
            )}

            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-2">Operacional</p>
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />
            <NavItem to="/eventos" icon={FileText} label="Eventos" active={location.pathname === '/eventos'} />
            <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} />
            <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} />
            <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} />
            
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-6">Gestão</p>
            <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} />
            <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} />
            <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} />
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" active={location.pathname === '/configuracoes'} />
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-3">
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-700" alt="Avatar" />
            ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                    <UserCircle size={24} className="text-slate-400" />
                </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile?.full_name || user?.email}</p>
              <div className="flex items-center gap-1">
                {isSuperAdmin ? (
                    <span className="text-[9px] font-black bg-amber-500 text-slate-900 px-1.5 rounded uppercase tracking-wide flex items-center gap-1 w-fit">
                        <ShieldCheck size={8}/> Super Admin
                    </span>
                ) : (
                    <p className="text-xs text-slate-500 italic">Usuário</p>
                )}
              </div>
            </div>
            <button onClick={signOut} className="text-slate-500 hover:text-white transition-colors" title="Sair">
                <X size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 relative">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {isSuperAdmin ? 'Painel Mestre' : 'Visão Operacional'}
            </h2>
            <p className="text-slate-500">
                {isSuperAdmin ? 'Controle total de todas as instâncias do sistema.' : 'Operações e Inteligência em tempo real.'}
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-2xl transition-all relative group ${showNotifications ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm'}`}
              >
                <Bell size={22} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>
          </div>
        </header>
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default Layout;
