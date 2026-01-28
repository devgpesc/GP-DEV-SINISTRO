
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, ShoppingCart, Users, Truck, 
  BarChart3, Settings, Package, Car, Bell, Search, UserCircle, X, ShoppingBag, Clock, Trash2, CheckCheck,
  Globe, ShieldCheck, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserCheck, Mail, Phone, MapPin, Key,
  Camera, Save, Loader2, Edit3
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
  const { user, profile, isSuperAdmin, signOut, updateProfile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Profile Edit States
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializa dados do formulário quando o modal abre
  useEffect(() => {
    if (showProfileModal && profile) {
        setEditName(profile.full_name || '');
        setEditAvatar(profile.avatar_url || '');
    }
  }, [showProfileModal, profile]);
  
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura.', time: '10 min', icon: ShoppingBag, color: 'blue', read: false },
    { id: 2, title: 'SLA Crítico', desc: 'Evento EVT-2024-022 excedeu 48h sem cotação.', time: '2h', icon: AlertTriangle, color: 'red', read: false },
    { id: 3, title: 'Entrega Realizada', desc: 'Peças da OC-2024-003 recebidas na oficina.', time: '1d', icon: CheckCircle2, color: 'green', read: true },
  ]);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return alert("O nome não pode estar vazio.");
    
    setIsSavingProfile(true);
    try {
        await updateProfile({
            full_name: editName,
            avatar_url: editAvatar
        });
        // Feedback visual rápido
        const btn = document.getElementById('save-profile-btn');
        if (btn) btn.innerText = "Salvo!";
        setTimeout(() => setShowProfileModal(false), 800);
    } catch (error) {
        alert("Erro ao salvar perfil.");
    } finally {
        setIsSavingProfile(false);
    }
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
            <NavItem to="/associados" icon={UserCheck} label="Associados" active={location.pathname === '/associados'} />
            <NavItem to="/fornecedores" icon={Users} label="Fornecedores" active={location.pathname === '/fornecedores'} />
            <NavItem to="/veiculos" icon={Car} label="Veículos" active={location.pathname === '/veiculos'} />
            <NavItem to="/catalogo" icon={Package} label="Catálogo" active={location.pathname === '/catalogo'} />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" active={location.pathname === '/relatorios'} />
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" active={location.pathname === '/configuracoes'} />
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-800">
          <div className={`mb-4 px-3 py-2 rounded-lg border flex items-center gap-2 ${isSupabaseConfigured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
             {isSupabaseConfigured ? <Wifi size={14} /> : <WifiOff size={14} />}
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest">{isSupabaseConfigured ? 'Produção Online' : 'Modo Offline'}</p>
                <p className="text-[9px] opacity-70">{isSupabaseConfigured ? 'Conectado ao DB' : 'Dados Locais'}</p>
             </div>
          </div>

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
        {children || <Outlet />}
      </main>

      {/* Modal de Configuração de Perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
           <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                 <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-all">
                    <X size={20}/>
                 </button>
              </div>
              <div className="px-8 pb-8">
                 <div className="relative -mt-12 mb-6 flex justify-between items-end">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       <div className="w-24 h-24 rounded-[32px] bg-white p-1.5 shadow-xl">
                          {editAvatar ? (
                             <img src={editAvatar} className="w-full h-full rounded-[28px] object-cover" />
                          ) : (
                             <div className="w-full h-full rounded-[28px] bg-slate-100 flex items-center justify-center text-slate-400">
                                <UserCircle size={40}/>
                             </div>
                          )}
                       </div>
                       <div className="absolute inset-0 bg-black/40 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white m-1.5">
                          <Camera size={24}/>
                       </div>
                       <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleAvatarChange}
                        />
                    </div>
                    
                    <div className="flex gap-2 mb-2">
                       <button onClick={signOut} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase" title="Sair">
                          Sair
                       </button>
                    </div>
                 </div>
                 
                 <div className="space-y-6">
                    <div>
                       <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome de Exibição</label>
                       <div className="relative">
                          <input 
                             className="w-full text-2xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-blue-500 outline-none pb-2 bg-transparent"
                             value={editName}
                             onChange={e => setEditName(e.target.value)}
                          />
                          <Edit3 className="absolute right-0 bottom-2 text-slate-300 pointer-events-none" size={18}/>
                       </div>
                       <p className="text-sm font-medium text-slate-500 mt-1">{user?.email}</p>
                    </div>

                    <div className="space-y-3">
                       <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><ShieldCheck size={20}/></div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">Função (Sistema)</p>
                             <p className="font-bold text-slate-700 capitalize">{profile?.role || 'Colaborador'}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm"><Key size={20}/></div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">Último Acesso</p>
                             <p className="font-bold text-slate-700">{new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
                          </div>
                       </div>
                    </div>

                    <button 
                       id="save-profile-btn"
                       onClick={handleSaveProfile}
                       disabled={isSavingProfile}
                       className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                       {isSavingProfile ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Alterações</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
