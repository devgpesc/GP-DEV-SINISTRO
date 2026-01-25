
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura.', time: '10 min', icon: ShoppingBag, color: 'blue' },
    { id: 2, title: 'Prazo de Cotação', desc: 'EVT-2024-012 vence em 1 hora.', time: '1h', icon: Clock, color: 'amber' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-blue-600 p-2 rounded-lg"><Car className="text-white" size={24} /></div>
            <h1 className="text-xl font-bold tracking-tight">AutoClaims<span className="text-blue-500">Pro</span></h1>
          </div>
          <nav className="space-y-1">
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />
            <NavItem to="/eventos" icon={FileText} label="Eventos" active={location.pathname === '/eventos'} />
            <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} />
            <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} />
            <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} />
            <hr className="my-4 border-slate-800" />
            <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} />
            <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} />
            <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} />
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" active={location.pathname === '/configuracoes'} />
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-3">
            <UserCircle size={32} className="text-slate-400" />
            <div><p className="text-sm font-semibold">Admin Master</p><p className="text-xs text-slate-500 italic">Unidade Matriz</p></div>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 relative">
        <header className="flex justify-between items-center mb-8">
          <div><h2 className="text-2xl font-bold text-slate-800">Seja bem-vindo, Gestor</h2><p className="text-slate-500">Operações e Inteligência em tempo real.</p></div>
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-400 hover:text-blue-600 relative transition-all"
            >
              <Bell size={24} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 animate-in fade-in slide-in-from-top-2">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Notificações</h4>
                    <button onClick={() => setShowNotifications(false)}><X size={16}/></button>
                 </div>
                 <div className="max-h-64 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className="p-4 hover:bg-slate-50 border-b border-slate-50 flex gap-3 transition-all cursor-pointer">
                         <div className={`p-2 rounded-lg bg-${n.color}-50 text-${n.color}-600`}><n.icon size={18}/></div>
                         <div>
                            <p className="text-xs font-bold text-slate-800">{n.title}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{n.desc}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{n.time} atrás</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
            <div className="h-10 w-px bg-slate-200 mx-2"></div>
            <div className="text-right"><p className="text-sm font-medium">15 de Maio, 2024</p><p className="text-xs text-slate-400">Status: Operacional</p></div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};

export default Layout;
