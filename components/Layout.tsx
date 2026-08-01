import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useLocation } = ReactRouterDOM as any;
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserCheck, Mail, Phone, MapPin, Key,
  Camera, Save, Loader2, Edit3, AlertCircle, LogOut, ChevronDown, Zap, Sparkles, Info, Menu, Hexagon, Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { auditService } from '../services/auditService';
import AIChatWindow from './AIChatWindow';
import SupportWidget from './SupportWidget';
import EscLogo from './EscLogo';

// ... (Interfaces remain same)
interface LayoutProps {
  children?: React.ReactNode;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

interface NotificationItem {
    id: string | number;
    title: string;
    desc: string;
    time: string;
    icon: any;
    color: string;
    read: boolean;
    link?: string;
}

const NavItem = ({ to, icon: Icon, label, active, badge, onClick }: { to: string, icon: any, label: string, active: boolean, badge?: string, onClick?: () => void }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group min-h-[46px] ${
      active 
        ? 'bg-[#30394B] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
        : 'text-[#A6B0C3] hover:bg-[#20293A] hover:text-white'
    }`}
  >
    <Icon size={19} strokeWidth={active ? 2.3 : 1.9} className={active ? 'text-[#58A6FF]' : 'text-[#A6B0C3] group-hover:text-white'} />
    <span className="font-semibold text-[13px]">{label}</span>
    {badge && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#58A6FF] text-[#0D1424] text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
        {badge}
      </span>
    )}
  </Link>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, profile, isSuperAdmin, signOut, updateProfile, access } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Profile Edit States
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // REAL NOTIFICATIONS STATE
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Acesso: membros da empresa têm fluxo operacional completo por padrão
  const {
    canAccessDashboard,
    canAccessEvents,
    canAccessQuotations,
    canAccessPurchases,
    canAccessDeliveries,
    canAccessAssociates,
    canAccessSuppliers,
    canAccessVehicles,
    canAccessCatalog,
    canAccessNotifications,
    canApprovePurchases,
    canViewReports,
    canManageSettings,
  } = access;

  const hasFlowModules =
    canAccessQuotations || canAccessPurchases || canAccessDeliveries;
  const hasRegistryModules =
    canAccessAssociates || canAccessSuppliers || canAccessVehicles || canAccessCatalog;

  // AUTOMATIC AUDIT LOGGING FOR NAVIGATION (adiado — nao compete com dashboard)
  useEffect(() => {
      if (!user) return;
      const timer = window.setTimeout(() => {
        auditService.log('Navigate', 'Page', location.pathname, { path: location.pathname });
      }, 1500);
      return () => clearTimeout(timer);
  }, [location.pathname, user]);

  useEffect(() => {
    if (showProfileModal) {
        setEditName(profile?.full_name || user?.user_metadata?.full_name || '');
        setEditAvatar(profile?.avatar_url || user?.user_metadata?.avatar_url || '');
    }
  }, [showProfileModal]);

  // Notificacoes em idle — libera primeira pintura
  useEffect(() => {
      if (!user) return;
      let interval: ReturnType<typeof setInterval> | undefined;
      const start = window.setTimeout(() => {
        loadNotifications();
        interval = setInterval(loadNotifications, 90000);
      }, 2000);
      return () => {
        clearTimeout(start);
        if (interval) clearInterval(interval);
      };
  }, [user, profile]);

  const loadNotifications = async () => {
      setLoadingNotifications(true);
      const newNotifications: NotificationItem[] = [];
      const dismissedSys = JSON.parse(sessionStorage.getItem('dismissedSysNotifs') || '[]');

      try {
          if (canApprovePurchases && !dismissedSys.includes('sys-po-pending')) {
              const { count } = await supabase.from('purchase_orders')
                  .select('*', { count: 'exact', head: true })
                  .eq('status', 'Gerada');
              
              if (count && count > 0) {
                  newNotifications.push({
                      id: 'sys-po-pending',
                      title: 'Aprovações Pendentes',
                      desc: `Existem ${count} ordens de compra aguardando aprovação financeira.`,
                      time: 'Agora',
                      icon: ShoppingBag,
                      color: 'blue',
                      read: false,
                      link: '/compras'
                  });
              }
          }

          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          
          if (!dismissedSys.includes('sys-evt-sla')) {
              const { count: lateEventsCount } = await supabase.from('events')
                  .select('*', { count: 'exact', head: true })
                  .eq('status', 'Em Cotação')
                  .lt('created_at', twoDaysAgo.toISOString());

              if (lateEventsCount && lateEventsCount > 0) {
                  newNotifications.push({
                      id: 'sys-evt-sla',
                      title: 'Atenção ao SLA',
                      desc: `${lateEventsCount} eventos estão em cotação há mais de 48h.`,
                      time: 'Urgente',
                      icon: AlertTriangle,
                      color: 'amber',
                      read: false,
                      link: '/eventos'
                  });
              }
          }

          const { data: dbNotifs, error: notifError } = await supabase.from('notifications')
              .select('*')
              .eq('user_id', user?.id)
              .eq('read', false)
              .order('created_at', { ascending: false })
              .limit(10);

          if (notifError) {
              if (!String(notifError.message || '').includes('does not exist')) {
                  console.warn('[Notifications]', notifError.message);
              }
          } else if (dbNotifs) {
              dbNotifs.forEach((n: any) => {
                  newNotifications.push({
                      id: n.id,
                      title: n.title,
                      desc: n.message,
                      time: new Date(n.created_at).toLocaleDateString(),
                      icon: n.type === 'warning' ? AlertTriangle : n.type === 'success' ? CheckCircle2 : Info,
                      color: n.type === 'warning' ? 'red' : n.type === 'success' ? 'green' : 'slate',
                      read: n.read,
                      link: n.link
                  });
              });
          }

          setNotifications(newNotifications);

      } catch (err) {
          console.error("Erro ao carregar notificações", err);
      } finally {
          setLoadingNotifications(false);
      }
  };

  const markAsRead = async (id: string | number) => {
      if (typeof id === 'string' && id.startsWith('sys-')) {
          const dismissedSys = JSON.parse(sessionStorage.getItem('dismissedSysNotifs') || '[]');
          sessionStorage.setItem('dismissedSysNotifs', JSON.stringify([...dismissedSys, id]));
          setNotifications(prev => prev.filter(n => n.id !== id));
          return;
      }

      if (typeof id === 'string') {
          await supabase.from('notifications').update({ read: true }).eq('id', id);
          setNotifications(prev => prev.filter(n => n.id !== id));
      }
  };

  const clearAllNotifications = async () => {
      const dbIds = notifications.filter(n => typeof n.id === 'string' && !n.id.startsWith('sys-')).map(n => n.id);
      if (dbIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', dbIds);
      }
      loadNotifications();
      addToast('success', 'Atualizado', 'Notificações arquivadas.');
  };

  const unreadCount = notifications.length;

  const addToast = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast('warning', 'Arquivo muito grande', 'A imagem deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
        addToast('warning', 'Nome Obrigatório', 'Por favor, informe seu nome de exibição.');
        return;
    }
    setIsSavingProfile(true);
    try {
        await updateProfile({
            full_name: editName,
            avatar_url: editAvatar,
        });
        addToast('success', 'Perfil Atualizado', 'Suas informações foram salvas com sucesso.');
        setTimeout(() => setShowProfileModal(false), 800);
    } catch (error: any) {
        addToast('error', 'Erro ao Salvar', error.message);
    } finally {
        setIsSavingProfile(false);
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="app-shell flex min-h-screen bg-[#F4F7FB] print:bg-white overflow-x-hidden">
      <style>{`
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          20%, 60% { transform: rotate(15deg); }
          40%, 80% { transform: rotate(-15deg); }
        }
        .animate-bell-ring {
          animation: bell-ring 2s infinite ease-in-out;
          transform-origin: top center;
        }
      `}</style>

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[120] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-200 flex items-start gap-4 min-w-[320px] animate-in slide-in-from-right-10 duration-300 pointer-events-auto">
             <div className={`p-2 rounded-xl ${
                toast.type === 'success' ? 'bg-green-100 text-green-600' : 
                toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
             }`}>
                {toast.type === 'success' ? <CheckCircle2 size={20}/> : 
                 toast.type === 'error' ? <X size={20}/> : <AlertCircle size={20}/>}
             </div>
             <div>
                <h4 className="text-sm font-bold text-slate-800">{toast.title}</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{toast.message}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#0D1424]/70 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar - Responsive */}
      <aside className={`
        fixed top-0 left-0 h-full w-[270px] bg-[#111827] text-white flex flex-col z-40 transition-transform duration-300 ease-in-out border-r border-white/[0.04]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 print:hidden
      `}>
        {/* ... (Sidebar Content remains the same) ... */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-7 px-1">
            
            {/* LOGO CUSTOMIZADA ESC */}
            <EscLogo className="w-9 h-9 text-white shrink-0" classNameText="text-white text-[19px]" />

            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-[#A6B0C3] hover:text-white">
                <X size={24}/>
            </button>
          </div>
          
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] pr-1 custom-scrollbar">
            <p className="px-3 pb-2 text-[10px] font-bold text-[#738098] uppercase tracking-[0.22em]">Menu</p>
            {canAccessDashboard && (
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} onClick={closeMobileMenu} />
            )}
            {canAccessEvents && (
              <NavItem to="/eventos" icon={FileText} label="Sinistros" active={location.pathname === '/eventos'} onClick={closeMobileMenu} />
            )}
            {canAccessEvents && (
              <NavItem to="/posicionamento" icon={Wrench} label="Posicionamento" active={location.pathname.startsWith('/posicionamento')} onClick={closeMobileMenu} />
            )}

            {hasFlowModules && (
              <>
                <p className="px-3 pt-4 pb-2 text-[10px] font-bold text-[#738098] uppercase tracking-[0.22em]">Fluxo</p>
                {canAccessQuotations && (
                  <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} onClick={closeMobileMenu} />
                )}
                {canAccessPurchases && (
                  <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} onClick={closeMobileMenu} />
                )}
                {canAccessDeliveries && (
                  <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} onClick={closeMobileMenu} />
                )}
              </>
            )}

            {hasRegistryModules && (
              <>
                <p className="px-3 pt-4 pb-2 text-[10px] font-bold text-[#738098] uppercase tracking-[0.22em]">Cadastros</p>
                {canAccessAssociates && (
                  <NavItem to="/associados" icon={UserCheck} label="Associados" active={location.pathname === '/associados'} onClick={closeMobileMenu} />
                )}
                {canAccessSuppliers && (
                  <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} onClick={closeMobileMenu} />
                )}
                {canAccessVehicles && (
                  <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} onClick={closeMobileMenu} />
                )}
                {canAccessCatalog && (
                  <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} onClick={closeMobileMenu} />
                )}
              </>
            )}

            {canViewReports && (
                <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} onClick={closeMobileMenu} />
            )}

          </nav>
        </div>
        
        <div className="mt-auto border-t border-white/[0.06] p-4 space-y-1">
          {isSuperAdmin && (
            <Link
              to="/saas-admin"
              onClick={closeMobileMenu}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                location.pathname === '/saas-admin'
                  ? 'bg-[#30394B] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'text-[#A6B0C3] hover:bg-[#20293A] hover:text-white'
              }`}
            >
              <Globe size={18} strokeWidth={location.pathname === '/saas-admin' ? 2.3 : 1.9} className={location.pathname === '/saas-admin' ? 'text-[#58A6FF]' : 'text-[#A6B0C3]'} />
              <span className="font-semibold text-[13px]">Gestão SaaS</span>
              <span className="ml-auto bg-[#58A6FF] text-[#0D1424] text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                Super
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setShowProfileModal(true); closeMobileMenu(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#A6B0C3] hover:bg-[#20293A] hover:text-white transition-all"
          >
            <Hexagon size={18} strokeWidth={1.9} />
            <span className="font-semibold text-[13px]">Plataforma</span>
          </button>
          {(isSuperAdmin || canManageSettings) && (
            <Link
              to="/configuracoes"
              onClick={closeMobileMenu}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#A6B0C3] hover:bg-[#20293A] hover:text-white transition-all"
            >
              <ShieldCheck size={18} strokeWidth={1.9} />
              <span className="font-semibold text-[13px]">Admin</span>
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#A6B0C3] hover:bg-[#20293A] hover:text-white transition-all"
          >
            <LogOut size={18} strokeWidth={1.9} />
            <span className="font-semibold text-[13px]">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-[270px] p-4 md:p-8 relative print:ml-0 print:p-0 print:w-full min-w-0 w-full">
        {/* ... (Main Content Header remains the same) ... */}
        <div className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl">
                <Menu size={24}/>
            </button>
            
            {/* LOGO CUSTOMIZADA MOBILE */}
            <EscLogo className="w-6 h-6 text-slate-800" classNameText="text-slate-800 text-base" showText={true} />

            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-600 hover:bg-slate-50 rounded-xl"
            >
                <Bell size={20}/>
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>}
            </button>
        </div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
          <div className="hidden md:block">
            <h2 className="text-2xl font-bold text-slate-800">
                {isSuperAdmin ? 'Painel Mestre' : 'Visão Operacional'}
            </h2>
            <p className="text-slate-500">
                {isSuperAdmin ? 'Controle total de todas as instâncias do sistema.' : 'Operações e Inteligência em tempo real.'}
            </p>
          </div>
          
          <div className="hidden md:flex items-center gap-4 relative">
            <button 
                onClick={() => setIsAiChatOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
                <Sparkles size={16} /> IA Visionária
            </button>

            <div className="relative">
              <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-2xl transition-all relative group duration-300 ${
                    showNotifications 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-110' 
                      : unreadCount > 0
                        ? 'bg-white text-blue-600 shadow-lg shadow-blue-200 border border-blue-100 hover:bg-blue-50'
                        : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'
                  }`}
                >
                  <div className={unreadCount > 0 && !showNotifications ? 'animate-bell-ring' : ''}>
                    <Bell size={24} strokeWidth={showNotifications || unreadCount > 0 ? 2.5 : 2} />
                  </div>
                  
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 border-2 border-white items-center justify-center text-[9px] font-bold text-white shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                  )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                  <div className="absolute right-0 top-full mt-4 w-96 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 origin-top-right ring-1 ring-black/5">
                     <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                        <div className="flex items-center gap-3">
                           <div className="bg-blue-100 p-2 rounded-xl text-blue-700"><Bell size={18} /></div>
                           <div>
                               <h3 className="font-bold text-slate-800 text-sm">Notificações</h3>
                               <p className="text-[10px] text-slate-500 font-medium">
                                   {loadingNotifications ? 'Atualizando...' : `${unreadCount} pendentes`}
                               </p>
                           </div>
                        </div>
                        {notifications.length > 0 && (
                          <button 
                            onClick={clearAllNotifications} 
                            className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Limpar Tudo
                          </button>
                        )}
                     </div>
                     <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                        {loadingNotifications ? (
                            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={24}/></div>
                        ) : notifications.length === 0 ? (
                          <div className="p-12 text-center">
                             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <CheckCheck size={32} />
                             </div>
                             <p className="text-sm font-bold text-slate-600">Tudo limpo!</p>
                             <p className="text-xs text-slate-400 mt-1">Você está em dia com as tarefas.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <Link to={n.link || '#'} key={n.id} onClick={() => { if(n.link) setShowNotifications(false); markAsRead(n.id); }} className="block">
                                <div className="p-4 mb-1 rounded-2xl hover:bg-blue-50/50 transition-all flex gap-4 group relative cursor-pointer border border-transparent hover:border-blue-100">
                                <div className={`shrink-0 w-10 h-10 rounded-xl bg-${n.color}-50 text-${n.color}-600 flex items-center justify-center shadow-sm`}>
                                    <n.icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0 pr-8">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className={`font-bold text-xs truncate ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">{n.time}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{n.desc}</p>
                                </div>
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(n.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                                    title="Arquivar notificação"
                                >
                                    <CheckCheck size={16} />
                                </button>
                                {!n.read && (
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                )}
                                </div>
                            </Link>
                          ))
                        )}
                     </div>
                     <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-center backdrop-blur-md">
                        <Link to="/notificacoes" onClick={() => setShowNotifications(false)} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-2 py-1">
                           Ver Histórico Completo <ChevronDown size={12}/>
                        </Link>
                     </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <button 
              onClick={() => setIsAiChatOpen(true)}
              className="md:hidden fixed bottom-6 right-6 z-[90] bg-indigo-600 text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center animate-in zoom-in"
          >
              <Sparkles size={20} />
          </button>
        </header>
        
        {children}
      </main>

      <AIChatWindow isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
      
      {/* NOVO WIDGET DE SUPORTE */}
      <SupportWidget />

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
           <div className="relative bg-white w-full max-w-sm rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20">
              <div className="h-28 bg-gradient-to-br from-indigo-600 to-blue-700 relative z-0 flex justify-end p-4">
                 <button onClick={() => setShowProfileModal(false)} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-all backdrop-blur-sm z-30">
                    <X size={18}/>
                 </button>
              </div>
              <div className="px-8 pb-8 -mt-14 relative z-20">
                 <div className="flex justify-center mb-6">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       <div className="w-28 h-28 rounded-[36px] bg-white p-1.5 shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-300">
                          {editAvatar ? (
                             <img src={editAvatar} className="w-full h-full rounded-[30px] object-cover border-2 border-slate-100" />
                          ) : (
                             <div className="w-full h-full rounded-[30px] bg-slate-50 flex items-center justify-center text-slate-300 border-2 border-slate-100">
                                <UserCircle size={48}/>
                             </div>
                          )}
                       </div>
                       <div className="absolute bottom-0 right-0 bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                          <Camera size={16}/>
                       </div>
                       <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </div>
                 </div>
                 <div className="space-y-6 text-center">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome de Exibição</label>
                       <div className="relative group">
                          <input 
                             className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-b-2 border-slate-100 hover:border-blue-300 focus:border-blue-500 outline-none pb-2 transition-all placeholder:text-slate-300 relative z-30"
                             value={editName} onChange={e => setEditName(e.target.value)} placeholder="Seu Nome"
                          />
                          <Edit3 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" size={16}/>
                       </div>
                       <p className="text-xs font-medium text-slate-500">{user?.email}</p>
                    </div>
                    <div className="pt-2 space-y-3">
                        <button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                           {isSavingProfile ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Perfil</>}
                        </button>
                        <button onClick={signOut} className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                           <LogOut size={16}/> Sair do Sistema
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
