
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck
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
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura.', time: '10 min', icon: ShoppingBag, color: 'blue' },
    { id: 2, title: 'Prazo de Cotação', desc: 'EVT-2024-012 vence em 1 hora.', time: '1h', icon: Clock, color: 'amber' },
    { id: 3, title: 'Entrega Realizada', desc: 'Fornecedor TAURO confirmou entrega.', time: '2h', icon: Truck, color: 'green' },
  ]);

  const clearAll = () => {
    setNotifications([]);
  };

  const removeNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

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
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-2xl transition-all relative group ${showNotifications ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm'}`}
              >
                <Bell size={22} className={notifications.length > 0 && !showNotifications ? 'animate-[bell-swing_2s_ease-in-out_infinite]' : ''} />
                {notifications.length > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                      {notifications.length}
                    </span>
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-20"></span>
                  </>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-4 w-96 bg-white border border-slate-200 shadow-2xl rounded-[32px] z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-[0.2em] text-blue-400">Notificações</h4>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">Você tem {notifications.length} alertas pendentes</p>
                    </div>
                    {notifications.length > 0 && (
                      <button 
                        onClick={clearAll}
                        className="text-[10px] font-black uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all"
                      >
                        <CheckCheck size={14}/> Limpar Tudo
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className="p-5 hover:bg-white border-b border-slate-100 flex gap-4 transition-all cursor-pointer group relative">
                          <div className={`p-3 rounded-2xl bg-${n.color}-50 text-${n.color}-600 border border-${n.color}-100 shadow-sm h-fit`}>
                            <n.icon size={20}/>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-black text-slate-800 tracking-tight">{n.title}</p>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{n.time} atrás</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.desc}</p>
                            <div className="mt-3 flex gap-2">
                               <button className="text-[9px] font-black uppercase text-blue-600 hover:underline">Ver Detalhes</button>
                               <span className="text-slate-200 text-[10px]">|</span>
                               <button onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }} className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500">Ignorar</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                           <Bell size={24}/>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Tudo limpo!</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Nenhuma notificação nova no momento.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-4 bg-white border-t border-slate-100 text-center">
                      <button className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 tracking-[0.2em] transition-all">Ver Histórico Completo</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="h-10 w-px bg-slate-200 mx-2"></div>
            <div className="text-right"><p className="text-sm font-medium">15 de Maio, 2024</p><p className="text-xs text-slate-400">Status: Operacional</p></div>
          </div>
        </header>
        {children}
      </main>

      <style>{`
        @keyframes bell-swing {
          0%, 100% { transform: rotate(0); }
          5%, 15% { transform: rotate(10deg); }
          10%, 20% { transform: rotate(-10deg); }
          25% { transform: rotate(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default Layout;
