
import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabaseClient';

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
    { id: 2, title: 'SLA Crítico', desc: 'Evento EVT-2024-022 excedeu 48h sem cotação.', time: '2h', icon: AlertTriangle, color: 'red' },
    { id: 3, title: 'Entrega Realizada', desc: 'Peças da OC-2024-003 recebidas na oficina.', time: '1d', icon: CheckCircle2, color: 'green' },
  ]);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 print:bg-white">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20 print:hidden">
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

            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Operacional</p>
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
          {/* Indicador de Status do Ambiente */}
          <div className={`mb-4 px-3 py-2 rounded-lg border flex items-center gap-2 ${isSupabaseConfigured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
             {isSupabaseConfigured ? <Wifi size={14} /> : <WifiOff size={14} />}
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest">{isSupabaseConfigured ? 'Produção Online' : 'Modo Offline'}</p>
                <p className="text-[9px] opacity-70">{isSupabaseConfigured ? 'Conectado ao DB' : 'Dados Locais'}</p>
             </div>
          </div>

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

      <main className="flex-1 ml-64 p-8 relative print:ml-0 print:p-0 print:w-full">
        <header className="flex justify-between items-center mb-8 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {isSuperAdmin ? 'Painel Mestre' : 'Visão Operacional'}
            </h2>
            <p className="text-slate-500">
                {isSuperAdmin ? 'Controle total de todas as instâncias do sistema.' : 'Operações e Inteligência em tempo real.'}
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-2xl transition-all relative group ${showNotifications ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm'}`}
                >
                  <Bell size={22} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"></span>
                  )}
              </button>

              {/* Dropdown de Notificações */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-4 w-80 bg-white rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
                   <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-800 text-sm">Notificações</h3>
                      {notifications.length > 0 && (
                        <button onClick={clearAllNotifications} className="text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                          Limpar Tudo
                        </button>
                      )}
                   </div>
                   <div className="max-h-[300px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                           <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                              <Bell size={20} />
                           </div>
                           <p className="text-xs font-bold text-slate-400">Tudo limpo por aqui!</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 group relative">
                             <div className={`shrink-0 w-10 h-10 rounded-xl bg-${n.color}-50 text-${n.color}-600 flex items-center justify-center`}>
                                <n.icon size={18} />
                             </div>
                             <div className="flex-1 min-w-0 pr-6">
                                <div className="flex justify-between items-start mb-0.5">
                                   <p className="font-bold text-slate-800 text-xs truncate">{n.title}</p>
                                   <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{n.time}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">{n.desc}</p>
                             </div>
                             <button 
                                onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                                className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="Remover notificação"
                             >
                                <X size={14} />
                             </button>
                          </div>
                        ))
                      )}
                   </div>
                   {notifications.length > 0 && (
                     <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                        <Link to="/notificacoes" className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors">Ver Histórico Completo</Link>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        </header>
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default Layout;
