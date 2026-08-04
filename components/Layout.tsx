import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useLocation } = ReactRouterDOM as any;
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserCheck, Mail, Phone, MapPin, Key,
  Camera, Save, Loader2, Edit3, AlertCircle, LogOut, ChevronDown, Zap, Sparkles, Info, Menu, Hexagon, Wrench,
  Download, PanelLeftClose, PanelLeftOpen, Type, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { auditService } from '../services/auditService';
import AIChatWindow from './AIChatWindow';
import SupportWidget from './SupportWidget';
import EscLogo from './EscLogo';
import {
  getStoredTypographyPreset,
  storeTypographyPreset,
  TYPOGRAPHY_PRESETS,
  TypographyPresetId,
} from '../utils/typography';

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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const NavItem = ({ to, icon: Icon, label, active, badge, onClick, collapsed = false }: { to: string, icon: any, label: string, active: boolean, badge?: string, onClick?: () => void, collapsed?: boolean }) => (
  <Link 
    to={to} 
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={label}
    className={`relative flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 transition-colors group ${collapsed ? 'lg:justify-center lg:px-2' : ''} ${
      active 
        ? 'bg-[#2155D4] text-white'
        : 'text-[#B7C0D1] hover:bg-white/[0.07] hover:text-white'
    }`}
  >
    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-white' : 'text-[#9CA8BD] group-hover:text-white'} />
    <span className={`text-[13px] font-semibold ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
    {badge && (
      <span className={`absolute right-3 top-1/2 -translate-y-1/2 bg-[#58A6FF] text-[#0D1424] text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${collapsed ? 'lg:hidden' : ''}`}>
        {badge}
      </span>
    )}
  </Link>
);

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Indicadores e visão geral da operação' },
  '/eventos': { title: 'Sinistros', subtitle: 'Abertura, prazos e acompanhamento dos casos' },
  '/posicionamento': { title: 'Posicionamento', subtitle: 'Acompanhamento do veículo e evidências do reparo' },
  '/cotacoes': { title: 'Cotações', subtitle: 'Comparação de propostas e decisão de compra' },
  '/compras': { title: 'Compras', subtitle: 'Ordens de compra e aprovações' },
  '/entregas': { title: 'Entregas', subtitle: 'Recebimento, responsáveis e histórico' },
  '/associados': { title: 'Associados', subtitle: 'Clientes e segurados cadastrados' },
  '/fornecedores': { title: 'Fornecedores', subtitle: 'Rede de oficinas e fornecedores' },
  '/veiculos': { title: 'Veículos', subtitle: 'Frota vinculada aos associados' },
  '/catalogo': { title: 'Catálogo', subtitle: 'Peças e serviços disponíveis' },
  '/relatorios': { title: 'Relatórios', subtitle: 'Análises operacionais e financeiras' },
  '/notificacoes': { title: 'Notificações', subtitle: 'Alertas e histórico de atividades' },
  '/saas-admin': { title: 'Gestão SaaS', subtitle: 'Empresas, acessos e instâncias' },
  '/configuracoes': { title: 'Administração', subtitle: 'Configurações e permissões da plataforma' },
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, profile, isSuperAdmin, signOut, updateProfile, access } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [typographyPreset, setTypographyPreset] = useState<TypographyPresetId>(getStoredTypographyPreset);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('eventscar:sidebar-collapsed') === 'true');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  
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
  const canPreviewTypography = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

  const selectTypographyPreset = (preset: TypographyPresetId) => {
    setTypographyPreset(preset);
    storeTypographyPreset(preset);
  };

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
    setShowNotifications(false);
  }, [location.pathname]);

  useEffect(() => {
    if (showProfileModal) {
        setEditName(profile?.full_name || user?.user_metadata?.full_name || '');
        setEditAvatar(profile?.avatar_url || user?.user_metadata?.avatar_url || '');
    }
  }, [showProfileModal]);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

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
      const systemIds = notifications
        .filter(n => typeof n.id === 'string' && n.id.startsWith('sys-'))
        .map(n => n.id);
      if (dbIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', dbIds);
      }
      if (systemIds.length > 0) {
          const dismissedSys = JSON.parse(sessionStorage.getItem('dismissedSysNotifs') || '[]');
          sessionStorage.setItem('dismissedSysNotifs', JSON.stringify([...new Set([...dismissedSys, ...systemIds])]));
      }
      setNotifications([]);
      setShowNotifications(false);
      addToast('success', 'Atualizado', 'Notificações arquivadas.');
  };

  const unreadCount = notifications.length;
  const pageMeta = PAGE_META[location.pathname] || PAGE_META['/'];
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Usuário';
  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();

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

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('eventscar:sidebar-collapsed', String(next));
      return next;
    });
  };

  const handleInstallApp = async () => {
    if (!installPrompt) {
      addToast('warning', 'Instalação do aplicativo', 'Use a opção Instalar aplicativo ou Adicionar à tela inicial no menu do navegador.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
      addToast('success', 'Aplicativo instalado', 'O EventsCar já pode ser aberto como aplicativo.');
    }
  };

  return (
    <div className={`app-shell flex min-h-screen overflow-x-hidden bg-[#F4F7FB] print:bg-white ${isSidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
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
      <div className="app-toast-container fixed right-3 top-3 z-[120] flex flex-col gap-3 pointer-events-none sm:right-6 sm:top-6">
        {toasts.map(toast => (
          <div key={toast.id} className="app-toast flex min-w-0 items-start gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 duration-300 pointer-events-auto sm:min-w-[320px]">
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
          className="fixed inset-0 z-30 bg-[#0D1424]/70 backdrop-blur-sm lg:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Responsive */}
      <aside className={`
        app-sidebar fixed left-0 top-0 z-40 flex h-[100dvh] w-[min(88vw,300px)] flex-col border-r border-white/[0.05] bg-[#101827] text-white transition-[width,transform] duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[232px]'} lg:translate-x-0 print:hidden
      `}>
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-4 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-[#182235] text-[#A6B0C3] shadow-sm hover:border-blue-400 hover:text-white lg:flex"
          aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          title={isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>

        <div className={`flex min-h-0 flex-1 flex-col p-3 ${isSidebarCollapsed ? 'lg:px-3' : ''}`}>
          <div className={`mb-5 flex h-10 shrink-0 items-center justify-between px-1 ${isSidebarCollapsed ? 'lg:justify-center' : ''}`}>
            
            {/* LOGO CUSTOMIZADA ESC */}
            <EscLogo className="w-9 h-9 text-white shrink-0" classNameText={`text-white text-[19px] ${isSidebarCollapsed ? 'lg:hidden' : ''}`} />

            <button onClick={() => setIsMobileMenuOpen(false)} className="text-[#A6B0C3] hover:text-white lg:hidden" aria-label="Fechar menu">
                <X size={24}/>
            </button>
          </div>
          
          <nav className="sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
            <p className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#738098] ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Menu</p>
            {canAccessDashboard && (
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
            )}
            {canAccessEvents && (
              <NavItem to="/eventos" icon={FileText} label="Sinistros" active={location.pathname === '/eventos'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
            )}
            {canAccessEvents && (
              <NavItem to="/posicionamento" icon={Wrench} label="Posicionamento" active={location.pathname.startsWith('/posicionamento')} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
            )}

            {hasFlowModules && (
              <>
                <p className={`px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#738098] ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Fluxo</p>
                {canAccessQuotations && (
                  <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
                {canAccessPurchases && (
                  <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
                {canAccessDeliveries && (
                  <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
              </>
            )}

            {hasRegistryModules && (
              <>
                <p className={`px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#738098] ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Cadastros</p>
                {canAccessAssociates && (
                  <NavItem to="/associados" icon={UserCheck} label="Associados" active={location.pathname === '/associados'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
                {canAccessSuppliers && (
                  <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
                {canAccessVehicles && (
                  <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
                {canAccessCatalog && (
                  <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
                )}
              </>
            )}

            {canViewReports && (
                <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} onClick={closeMobileMenu} collapsed={isSidebarCollapsed} />
            )}

          </nav>
        </div>
        
        <div className={`mt-auto shrink-0 space-y-0.5 border-t border-white/[0.06] p-3 ${isSidebarCollapsed ? 'lg:px-3' : ''}`}>
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallApp}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[#A6B0C3] transition-all hover:bg-[#20293A] hover:text-white ${isSidebarCollapsed ? 'lg:justify-center lg:px-3' : ''}`}
              title={isSidebarCollapsed ? 'Instalar aplicativo' : undefined}
              aria-label="Instalar aplicativo"
            >
              <Download size={18} strokeWidth={1.9} />
              <span className={`text-[13px] font-semibold ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Instalar aplicativo</span>
            </button>
          )}
          {isSuperAdmin && (
            <Link
              to="/saas-admin"
              onClick={closeMobileMenu}
              title={isSidebarCollapsed ? 'Gestão SaaS' : undefined}
              aria-label="Gestão SaaS"
              className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${isSidebarCollapsed ? 'lg:justify-center lg:px-3' : ''} ${
                location.pathname === '/saas-admin'
                  ? 'bg-[#30394B] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'text-[#A6B0C3] hover:bg-[#20293A] hover:text-white'
              }`}
            >
              <Globe size={18} strokeWidth={location.pathname === '/saas-admin' ? 2.3 : 1.9} className={location.pathname === '/saas-admin' ? 'text-[#58A6FF]' : 'text-[#A6B0C3]'} />
              <span className={`text-[13px] font-semibold ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Gestão SaaS</span>
              <span className={`ml-auto rounded-md bg-[#58A6FF] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#0D1424] ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                Super
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setShowProfileModal(true); closeMobileMenu(); }}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[#A6B0C3] transition-all hover:bg-[#20293A] hover:text-white ${isSidebarCollapsed ? 'lg:justify-center lg:px-3' : ''}`}
            title={isSidebarCollapsed ? 'Plataforma' : undefined}
            aria-label="Plataforma"
          >
            <Hexagon size={18} strokeWidth={1.9} />
            <span className={`text-[13px] font-semibold ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Plataforma</span>
          </button>
          {(isSuperAdmin || canManageSettings) && (
            <Link
              to="/configuracoes"
              onClick={closeMobileMenu}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[#A6B0C3] transition-all hover:bg-[#20293A] hover:text-white ${isSidebarCollapsed ? 'lg:justify-center lg:px-3' : ''}`}
              title={isSidebarCollapsed ? 'Admin' : undefined}
              aria-label="Admin"
            >
              <ShieldCheck size={18} strokeWidth={1.9} />
              <span className={`text-[13px] font-semibold ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Admin</span>
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[#A6B0C3] transition-all hover:bg-[#20293A] hover:text-white ${isSidebarCollapsed ? 'lg:justify-center lg:px-3' : ''}`}
            title={isSidebarCollapsed ? 'Sair' : undefined}
            aria-label="Sair"
          >
            <LogOut size={18} strokeWidth={1.9} />
            <span className={`text-[13px] font-semibold ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`relative min-w-0 w-full flex-1 transition-[margin] duration-300 ${isSidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[232px]'} print:ml-0 print:w-full`}>
        {/* ... (Main Content Header remains the same) ... */}
        <div className="mobile-app-bar sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-50" aria-label="Abrir menu" aria-expanded={isMobileMenuOpen}>
                <Menu size={24}/>
            </button>
            
            {/* LOGO CUSTOMIZADA MOBILE */}
            <EscLogo className="w-6 h-6 text-slate-800" classNameText="text-slate-800 text-base" showText={true} />

            <div className="flex items-center gap-1">
              <button onClick={() => setIsAiChatOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-50" aria-label="Abrir assistente">
                <Sparkles size={19}/>
              </button>
              <Link to="/notificacoes" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-50" aria-label="Abrir notificações">
                  <Bell size={20}/>
                  {unreadCount > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>}
              </Link>
            </div>
        </div>

        <header className="app-desktop-topbar sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur lg:flex print:hidden">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight text-slate-900">{pageMeta.title}</h1>
            <p className="truncate text-xs leading-tight text-slate-500">{pageMeta.subtitle}</p>
          </div>
          
          <div className="relative hidden items-center gap-4 lg:flex">
            <button 
                onClick={() => setIsAiChatOpen(true)}
                className="flex min-h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
                <Sparkles size={15} /> Assistente IA
            </button>

            {canPreviewTypography && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypography((current) => !current);
                    setShowNotifications(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    showTypography
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  aria-label="Testar tipografia"
                  title="Testar tipografia"
                >
                  <Type size={18} />
                </button>

                {showTypography && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTypography(false)} />
                    <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">Tipografia do sistema</p>
                        <p className="mt-0.5 text-xs text-slate-500">Compare ao vivo neste ambiente local.</p>
                      </div>
                      <div className="space-y-1 p-2">
                        {TYPOGRAPHY_PRESETS.map((preset) => {
                          const isSelected = typographyPreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => selectTypographyPreset(preset.id)}
                              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${
                                isSelected
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl font-bold text-slate-900 shadow-sm ${preset.sampleClassName}`}>
                                Aa
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-sm font-bold text-slate-900 ${preset.sampleClassName}`}>
                                  {preset.name}
                                </span>
                                <span className="block truncate text-[11px] text-slate-500">{preset.description}</span>
                              </span>
                              {isSelected && <Check size={17} className="shrink-0 text-blue-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="relative">
              <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowTypography(false);
                  }}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors group ${
                    showNotifications 
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : unreadCount > 0
                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <div className={unreadCount > 0 && !showNotifications ? 'animate-bell-ring' : ''}>
                    <Bell size={18} strokeWidth={showNotifications || unreadCount > 0 ? 2.3 : 1.9} />
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
                  <div className="absolute right-0 top-full z-50 mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 origin-top-right">
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
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 hover:bg-blue-200"
              aria-label={`Abrir perfil de ${displayName}`}
              title={displayName}
            >
              {editAvatar || profile?.avatar_url ? (
                <img src={profile?.avatar_url || editAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : userInitials}
            </button>
          </div>
        </header>

        <div className="app-page-content p-3 sm:p-4 lg:p-6 xl:p-7 print:p-0">
          {children}
        </div>
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
