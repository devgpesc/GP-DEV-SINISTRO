import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useLocation } = ReactRouterDOM;
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserCheck, Mail, Phone, MapPin, Key,
  Camera, Save, Loader2, Edit3, AlertCircle, LogOut, ChevronDown, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

interface LayoutProps {
  children?: React.ReactNode;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
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
  const { user, profile, isSuperAdmin, signOut, updateProfile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
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

  useEffect(() => {
    // Carrega logo da empresa
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
        // Carrega os dados apenas quando o modal abre
        setEditName(profile?.full_name || user?.user_metadata?.full_name || '');
        setEditAvatar(profile?.avatar_url || user?.user_metadata?.avatar_url || '');
        setEditRole(profile?.role || 'user');
    }
  }, [showProfileModal]); 
  
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura.', time: '10 min', icon: ShoppingBag, color: 'blue', read: false },
    { id: 2, title: 'SLA Crítico', desc: 'Evento EVT-2024-022 excedeu 48h sem cotação.', time: '2h', icon: AlertTriangle, color: 'red', read: false },
    { id: 3, title: 'Entrega Realizada', desc: 'Peças da OC-2024-003 recebidas na oficina.', time: '1d', icon: CheckCircle2, color: 'green', read: true },
  ]);

  const addToast = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
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
        console.error(error);
        addToast('error', 'Erro ao Salvar', error.message || 'Não foi possível atualizar o perfil.');
    } finally {
        setIsSavingProfile(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 print:bg-white">
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
            <NavItem to="/cotacoes" icon={Search} label="Cotações" active={location.pathname === '/cotacoes'} />
            <NavItem to="/compras" icon={ShoppingCart} label="Compras" active={location.pathname === '/compras'} />
            <NavItem to="/entregas" icon={Truck} label="Entregas" active={location.pathname === '/entregas'} />
            
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-6">Gestão</p>
            <NavItem to="/associados" icon={UserCheck} label="Associados" active={location.pathname === '/associados'} />
            <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} />
            <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} />
            <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} />
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" active={location.pathname === '/configuracoes'} />
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
            <div className="relative">
              <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-2xl transition-all relative group ${showNotifications ? 'bg-slate-800 text-white shadow-lg shadow-blue-900/20' : 'bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm'}`}
                >
                  <Bell size={22} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white animate-pulse"></span>
                  )}
              </button>

              {/* Dropdown de Notificações */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                  <div className="absolute right-0 top-full mt-4 w-96 bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 origin-top-right">
                     <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                           <div className="bg-white p-2 rounded-xl shadow-sm"><Bell size={16} className="text-blue-600"/></div>
                           <h3 className="font-bold text-slate-800 text-sm">Central de Avisos</h3>
                        </div>
                        {notifications.length > 0 && (
                          <button onClick={clearAllNotifications} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 px-2 py-1 rounded transition-colors">
                            Limpar Tudo
                          </button>
                        )}
                     </div>
                     <div className="max-h-[350px] overflow-y-auto p-2">
                        {notifications.length === 0 ? (
                          <div className="p-10 text-center">
                             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <CheckCheck size={32} />
                             </div>
                             <p className="text-sm font-bold text-slate-600">Tudo em dia!</p>
                             <p className="text-xs text-slate-400 mt-1">Você não possui novas notificações.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="p-4 mb-1 rounded-2xl hover:bg-slate-50 transition-all flex gap-4 group relative cursor-pointer border border-transparent hover:border-slate-100">
                               <div className={`shrink-0 w-12 h-12 rounded-2xl bg-${n.color}-50 text-${n.color}-600 flex items-center justify-center shadow-sm`}>
                                  <n.icon size={20} />
                               </div>
                               <div className="flex-1 min-w-0 pr-6">
                                  <div className="flex justify-between items-start mb-1">
                                     <p className="font-bold text-slate-800 text-xs truncate">{n.title}</p>
                                     <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">{n.time}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{n.desc}</p>
                               </div>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                                  className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                  title="Arquivar"
                               >
                                  <X size={14} />
                               </button>
                            </div>
                          ))
                        )}
                     </div>
                     <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                        <Link to="/notificacoes" onClick={() => setShowNotifications(false)} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-2">
                           Ver Histórico Completo
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

      {/* Modal de Configuração de Perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
           <div className="relative bg-white w-full max-w-sm rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20">
              
              {/* Header com Gradiente - Z-Index 0 para ficar atrás do conteúdo se houver conflito */}
              <div className="h-28 bg-gradient-to-br from-indigo-600 to-blue-700 relative z-0 flex justify-end p-4">
                 <button 
                    onClick={() => setShowProfileModal(false)} 
                    className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-all backdrop-blur-sm z-30"
                 >
                    <X size={18}/>
                 </button>
              </div>

              {/* Conteúdo do Modal - Z-Index 20 para garantir que fique acima do header */}
              <div className="px-8 pb-8 -mt-14 relative z-20">
                 {/* Avatar Area */}
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
                       <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleAvatarChange}
                        />
                    </div>
                 </div>
                 
                 <div className="space-y-6 text-center">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome de Exibição</label>
                       <div className="relative group">
                          <input 
                             className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-b-2 border-slate-100 hover:border-blue-300 focus:border-blue-500 outline-none pb-2 transition-all placeholder:text-slate-300 relative z-30"
                             value={editName}
                             onChange={e => setEditName(e.target.value)}
                             placeholder="Seu Nome"
                          />
                          <Edit3 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" size={16}/>
                       </div>
                       <p className="text-xs font-medium text-slate-500">{user?.email}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                          <ShieldCheck size={20} className="text-blue-600"/>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Função</p>
                          <p className="text-xs font-bold text-slate-700 capitalize">{editRole}</p>
                       </div>
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1">
                          <Key size={20} className="text-amber-500"/>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Acesso</p>
                          <p className="text-xs font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                       </div>
                    </div>

                    <div className="pt-2 space-y-3">
                        <button 
                           id="save-profile-btn"
                           onClick={handleSaveProfile}
                           disabled={isSavingProfile}
                           className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
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