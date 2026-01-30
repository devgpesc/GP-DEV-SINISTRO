
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserCheck, Mail, Phone, MapPin, Key,
  Camera, Save, Loader2, Edit3, AlertCircle, LogOut, ChevronDown, Zap, Sparkles, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import AIChatWindow from './AIChatWindow';

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
  const { user, profile, isSuperAdmin, signOut, updateProfile, checkPermission } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  
  // Company Logo
  const [companyLogo, setCompanyLogo] = useState('');
  
  // Profile Edit States
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // REAL NOTIFICATIONS STATE
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Permissions Logic
  const role = profile?.role || 'Usuário';
  const isManagerOrAdmin = role === 'Gerente' || role === 'Admin' || role === 'super_admin';
  
  // Permissões Específicas
  const canViewFinancial = isManagerOrAdmin || checkPermission('financial_view');
  const canApprove = isManagerOrAdmin || checkPermission('approve_purchases');
  const canManageTeam = isManagerOrAdmin || checkPermission('manage_users');
  const canViewReports = isManagerOrAdmin || checkPermission('view_reports');

  useEffect(() => {
    const fetchLogo = async () => {
        try {
            const { data } = await supabase.from('saas_settings').select('logo_url').limit(1).maybeSingle();
            if (data?.logo_url) setCompanyLogo(data.logo_url);
        } catch (e) {
            console.error("Erro logo", e);
        }
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    if (showProfileModal) {
        setEditName(profile?.full_name || user?.user_metadata?.full_name || '');
        setEditAvatar(profile?.avatar_url || user?.user_metadata?.avatar_url || '');
        setEditRole(profile?.role || 'user');
    }
  }, [showProfileModal]);

  // --- CARREGAMENTO DE NOTIFICAÇÕES REAIS ---
  useEffect(() => {
      if (!user) return;
      loadNotifications();
      
      // Opcional: Polling a cada 60s
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
  }, [user, profile]); // Recarrega se o perfil mudar (permissões)

  const loadNotifications = async () => {
      setLoadingNotifications(true);
      const newNotifications: NotificationItem[] = [];

      try {
          // 1. Verificar Alertas de Sistema (Dinâmicos)
          
          // A) Ordens de Compra Pendentes (Se tiver permissão de aprovar)
          if (canApprove) {
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

          // B) Eventos Atrasados (Exemplo SLA: > 2 dias em Cotação)
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          
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

          // 2. Buscar Notificações Persistidas do Banco
          const { data: dbNotifs } = await supabase.from('notifications')
              .select('*')
              .eq('user_id', user?.id)
              .eq('read', false)
              .order('created_at', { ascending: false })
              .limit(10);

          if (dbNotifs) {
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
      // Se for notificação de sistema (string fixa), apenas remove da visualização local
      if (typeof id === 'string' && id.startsWith('sys-')) {
          // Não faz nada, pois é um estado do sistema. O usuário deve resolver a pendência (ex: aprovar a compra) para sumir.
          // Opcional: Redirecionar
          const notif = notifications.find(n => n.id === id);
          if (notif?.link) {
             // Navegação seria ideal aqui, mas Link wrapper resolve na UI
          }
          return;
      }

      // Se for do banco, atualiza
      if (typeof id === 'string') {
          await supabase.from('notifications').update({ read: true }).eq('id', id);
          setNotifications(prev => prev.filter(n => n.id !== id));
      }
  };

  const clearAllNotifications = async () => {
      // Marca todas as do banco como lidas
      const dbIds = notifications.filter(n => typeof n.id === 'string' && !n.id.startsWith('sys-')).map(n => n.id);
      if (dbIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', dbIds);
      }
      // Recarrega (as de sistema continuarão lá se a pendência persistir)
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

  return (
    <div className="flex min-h-screen bg-slate-50 print:bg-white">
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

      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20 print:hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            {companyLogo ? (
                <img src={companyLogo} className="h-8 w-auto bg-white/10 rounded p-1 object-contain" alt="Logo" />
            ) : (
                <div className="bg-blue-600 p-2 rounded-lg"><Car className="text-white" size={24} /></div>
            )}
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
            
            {(canViewFinancial || canApprove) && (
                <>
                    <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} />
                    <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} />
                    <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} />
                </>
            )}
            
            {isManagerOrAdmin && (
                <>
                    <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-6">Gestão</p>
                    <NavItem to="/associados" icon={UserCheck} label="Associados" active={location.pathname === '/associados'} />
                    <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} />
                    <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} />
                    <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} />
                </>
            )}

            {(canViewReports || isManagerOrAdmin) && (
                <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} />
            )}

            {(isSuperAdmin || profile?.role === 'Admin') && (
                <NavItem to="/configuracoes" icon={Settings} label="Configurações" active={location.pathname === '/configuracoes'} />
            )}
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-3 cursor-pointer hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setShowProfileModal(true)}>
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover" alt="Avatar" />
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
                    <p className="text-xs text-slate-500 italic capitalize">{profile?.role || 'Usuário'}</p>
                )}
              </div>
            </div>
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
            <button 
                onClick={() => setIsAiChatOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
                <Sparkles size={16} /> IA Visionária
            </button>

            {/* NOTIFICATION BELL */}
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

              {/* DROPDOWN NOTIFICATIONS */}
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
                                <div className="flex-1 min-w-0 pr-6">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className={`font-bold text-xs truncate ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">{n.time}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{n.desc}</p>
                                </div>
                                {!n.id.toString().startsWith('sys-') && (
                                    <button 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(n.id); }}
                                        className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                        title="Marcar como lida"
                                    >
                                        <CheckCheck size={14} />
                                    </button>
                                )}
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
        </header>
        {children}
      </main>

      <AIChatWindow isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />

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