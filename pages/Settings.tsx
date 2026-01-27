
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, Building, Users, Lock, 
  Bell, Palette, Globe, Save, CheckCircle, Database,
  MessageSquare, Target, Mail, ShieldAlert, Key, 
  CreditCard, Layout, Zap, UserPlus, MoreVertical, MessageCircle,
  Tag, Plus, Trash2, Edit, Upload, X, Shield, Check, Smartphone, FileText,
  Clock, Edit2, AlertTriangle, RefreshCcw, Copy, CheckCheck, Link as LinkIcon,
  Server, ArrowUp, ArrowDown
} from 'lucide-react';
import { mockStorage } from '../services/supabaseClient';
import { Category } from '../types';

// Interfaces Locais
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  color: string;
  permissions: string[];
}

interface CommTemplate {
  id: string;
  title: string;
  channel: 'WhatsApp' | 'E-mail' | 'Sistema';
  subject?: string;
  body: string;
  icon: string;
}

// Mapa de ícones
const ICON_MAP: Record<string, any> = {
  'MessageCircle': MessageCircle,
  'Mail': Mail,
  'MessageSquare': MessageSquare,
  'WhatsApp': MessageCircle,
  'E-mail': Mail
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'sistema' | 'templates' | 'metas' | 'categorias' | 'seguranca' | 'integracoes'>('empresa');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES DE DADOS ---
  const [companyInfo, setCompanyInfo] = useState({
    name: 'AutoClaims Pro Insurance Services LTDA',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1000, 15º Andar - São Paulo, SP',
    logo: ''
  });

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<AppUser>>({ permissions: [] });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  
  const [createdUserCreds, setCreatedUserCreds] = useState<{email: string, pass: string} | null>(null);
  const [copied, setCopied] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [rules, setRules] = useState({
    approvalLimit: 5000,
    notifications: { quotes: true, pendingOC: true, sla: false, delivery: true },
    audit: { logs: true, priceView: true, justifyLow: true, mfaHighValue: false }
  });

  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CommTemplate | null>(null);

  const [goals, setGoals] = useState({
    savingsTarget: 15,
    monthlyBudget: 250000,
    minSuppliersPerQuote: 3
  });

  const [security, setSecurity] = useState({
    enforce2FA: false,
    passwordExpiry: 90,
    sessionTimeout: 30,
    ipWhitelist: ''
  });

  // Integrações
  const [apiKeys, setApiKeys] = useState({
    plateApi: '', // Mantido para compatibilidade, mas agora usa providers
    gemini: '',
    openai: '',
    anthropic: '',
    groq: ''
  });

  // Novos Providers de Placa
  const [plateProviders, setPlateProviders] = useState([
    { id: 'apibrasil', name: 'APIBrasil (Padrão)', type: 'REST', priority: 1, active: true, key: '' },
    { id: 'detran', name: 'Detran-SP (Integrador)', type: 'SOAP/Gov', priority: 2, active: true, key: '' }
  ]);

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    const savedCompany = mockStorage.get('app_company');
    if (savedCompany) setCompanyInfo(savedCompany);

    const savedUsers = mockStorage.get('app_users');
    if (savedUsers) {
      setUsers(savedUsers);
    } else {
      setUsers([
        { id: '1', name: 'Admin Master', email: 'admin@autoclaims.com', role: 'Administrador Senior', status: 'Ativo', color: 'blue', permissions: ['all'] },
        { id: '2', name: 'João Comprador', email: 'joao@autoclaims.com', role: 'Gestor de Compras', status: 'Ativo', color: 'indigo', permissions: ['compras', 'cotacoes'] },
      ]);
    }

    const savedCats = mockStorage.get('app_categories');
    setCategories(savedCats || [
      { id: '1', name: 'Funilaria Pesada', color: 'red' },
      { id: '2', name: 'Mecânica', color: 'blue' },
    ]);

    const savedRules = mockStorage.get('app_rules');
    if (savedRules) setRules(savedRules);

    const savedTemplates = mockStorage.get('app_templates');
    if (savedTemplates) {
      const safeTemplates = savedTemplates.map((t: any) => ({
        ...t,
        icon: typeof t.icon === 'string' ? t.icon : (t.channel === 'WhatsApp' ? 'MessageCircle' : 'Mail')
      }));
      setTemplates(safeTemplates);
    } else {
      setTemplates([
        { id: '1', title: 'RFQ - Envio de Cotação', channel: 'WhatsApp', body: 'Olá {{fornecedor}}, cotação req.', icon: 'MessageCircle' },
      ]);
    }

    const savedGoals = mockStorage.get('app_goals');
    if (savedGoals) setGoals(savedGoals);

    const savedSecurity = mockStorage.get('app_security');
    if (savedSecurity) setSecurity(savedSecurity);

    const savedKeys = mockStorage.get('app_keys');
    if (savedKeys) setApiKeys(savedKeys);

    const savedProviders = mockStorage.get('app_plate_providers');
    if (savedProviders) setPlateProviders(savedProviders);

  }, []);

  // --- PERSISTÊNCIA ---
  const handleSaveAll = () => {
    mockStorage.set('app_company', companyInfo);
    mockStorage.set('app_users', users);
    mockStorage.set('app_categories', categories);
    mockStorage.set('app_rules', rules);
    mockStorage.set('app_templates', templates);
    mockStorage.set('app_goals', goals);
    mockStorage.set('app_security', security);
    mockStorage.set('app_keys', apiKeys);
    mockStorage.set('app_plate_providers', plateProviders);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetDatabase = () => {
    if (confirm('ATENÇÃO: Isso limpará todos os dados locais e recarregará a página.')) {
        localStorage.clear();
        window.location.reload();
    }
  };

  // --- HANDLERS ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCompanyInfo(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleOpenUserModal = (user?: AppUser) => {
    setCreatedUserCreds(null);
    setCopied(false);
    if (user) {
      setEditingUser(user);
      setUserFormData(user);
    } else {
      setEditingUser(null);
      setUserFormData({ name: '', email: '', role: '', status: 'Ativo', color: 'slate', permissions: [] });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.email) return;
    const newUser: AppUser = {
      id: editingUser ? editingUser.id : Math.random().toString(36).substr(2, 9),
      name: userFormData.name!,
      email: userFormData.email!,
      role: userFormData.role || 'Colaborador',
      status: (userFormData.status as any) || 'Ativo',
      color: userFormData.color || 'blue',
      permissions: userFormData.permissions || []
    };
    const updated = editingUser ? users.map(u => u.id === editingUser.id ? newUser : u) : [...users, newUser];
    setUsers(updated);
    mockStorage.set('app_users', updated);
    if (!editingUser) {
        setCreatedUserCreds({ email: newUser.email, pass: Math.random().toString(36).slice(-8).toUpperCase() });
    } else {
        setIsUserModalOpen(false);
    }
  };

  const handleRequestDeleteUser = (user: AppUser) => setUserToDelete(user);
  const handleConfirmDeleteUser = () => {
    if (userToDelete) {
        const updated = users.filter(u => u.id !== userToDelete.id);
        setUsers(updated);
        mockStorage.set('app_users', updated);
        setUserToDelete(null);
    }
  };

  const togglePermission = (perm: string) => {
    const current = userFormData.permissions || [];
    if (current.includes(perm)) {
      setUserFormData({ ...userFormData, permissions: current.filter(p => p !== perm) });
    } else {
      setUserFormData({ ...userFormData, permissions: [...current, perm] });
    }
  };

  const handleCopyCreds = () => {
    if (createdUserCreds) {
        const text = `URL: ${window.location.origin}\nLogin: ${createdUserCreds.email}\nSenha: ${createdUserCreds.pass}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
        setCategories(categories.map(c => c.id === editingCategory.id ? {...c, name: newCatName, color: newCatColor} : c));
        setEditingCategory(null);
    } else {
        if (!newCatName) return;
        setCategories([...categories, { id: Math.random().toString(), name: newCatName, color: newCatColor }]);
    }
    setNewCatName('');
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    setEditingTemplate(null);
  };

  // --- RENDER ---
  const NavButton = ({ tab, icon: Icon, label }: { tab: any, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab ? 'bg-white border border-slate-200 shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-200/50'}`}
    >
      <Icon size={18}/> {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-20">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><SettingsIcon size={32}/></div>
           <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Governança</h2>
              <p className="text-sm text-slate-500 font-medium">Controle granular do ecossistema AutoClaims Pro.</p>
           </div>
        </div>
        <button onClick={handleSaveAll} className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest ${saved ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'}`}>
          {saved ? <CheckCircle size={18}/> : <Save size={18} />} {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-1.5 h-fit sticky top-32">
          <NavButton tab="empresa" icon={Building} label="Dados da Empresa" />
          <NavButton tab="usuarios" icon={Users} label="Usuários & Roles" />
          <NavButton tab="integracoes" icon={LinkIcon} label="Integrações (APIs)" />
          <NavButton tab="categorias" icon={Tag} label="Categorias BI" />
          <NavButton tab="sistema" icon={Database} label="Regras & Auditoria" />
          <NavButton tab="templates" icon={MessageSquare} label="Comunicação" />
          <NavButton tab="metas" icon={Target} label="Metas Financeiras" />
          <hr className="my-4 border-slate-200" />
          <NavButton tab="seguranca" icon={Lock} label="Segurança" />
        </div>

        <div className="flex-1 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm min-h-[600px] relative">
          
          {/* ABA INTEGRAÇÕES */}
          {activeTab === 'integracoes' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <LinkIcon className="text-purple-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Chaves de API & Conexões</h3>
               </div>
               
               <div className="space-y-6">
                  {/* Gestão de Provedores de Placa */}
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                     <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Database size={18} className="text-blue-500"/> Fontes de Dados Veiculares
                     </h4>
                     
                     <div className="space-y-4">
                        {plateProviders.map((provider, index) => (
                            <div key={provider.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${provider.priority === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {provider.priority}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{provider.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{provider.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={provider.active} onChange={() => {
                                                const updated = [...plateProviders];
                                                updated[index].active = !updated[index].active;
                                                setPlateProviders(updated);
                                            }} />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="flex-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">API Key / Token</label>
                                        <input 
                                            type="password"
                                            className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-blue-300"
                                            value={provider.key}
                                            placeholder="sk_..."
                                            onChange={(e) => {
                                                const updated = [...plateProviders];
                                                updated[index].key = e.target.value;
                                                setPlateProviders(updated);
                                            }}
                                        />
                                    </div>
                                    <button className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200">Testar</button>
                                </div>
                                {provider.id === 'detran' && (
                                    <div className="text-[9px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-1">
                                        <AlertTriangle size={12}/> Requer Certificado Digital (e-CNPJ) configurado no servidor.
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                     <p className="text-[10px] text-slate-400 mt-4 text-center">O sistema tentará os provedores na ordem de prioridade definida acima.</p>
                  </div>

                  {/* LLM Keys */}
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                     <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-500"/> Inteligência Artificial (LLMs)
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {['gemini', 'openai', 'anthropic', 'groq'].map((key) => (
                            <div key={key}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">{key.charAt(0).toUpperCase() + key.slice(1)} API Key</label>
                                <input 
                                    type="password"
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-600"
                                    value={(apiKeys as any)[key]}
                                    onChange={e => setApiKeys({...apiKeys, [key]: e.target.value})}
                                />
                            </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* ABA EMPRESA */}
          {activeTab === 'empresa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2">
                 <Building className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Perfil da Organização</h3>
               </div>
               
               <div className="flex gap-8 items-start">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Logotipo Interno</p>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all overflow-hidden relative group"
                    >
                       {companyInfo.logo ? (
                         <img src={companyInfo.logo} className="w-full h-full object-contain p-2" alt="Logo" />
                       ) : (
                         <Upload className="text-slate-300" size={24}/>
                       )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">Alterar</div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    <p className="text-[9px] text-slate-400 mt-2">Max 500KB</p>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Razão Social / Nome Fantasia</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" 
                        value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ Principal</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" 
                        value={companyInfo.cnpj} onChange={e => setCompanyInfo({...companyInfo, cnpj: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Endereço da Matriz</label>
                      <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-24 outline-none font-bold text-slate-700 resize-none" 
                        value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} />
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* OUTRAS ABAS MANTIDAS IGUAIS (Simplificadas para o XML) */}
          {activeTab === 'usuarios' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Users size={20}/> Gestão de Colaboradores</h3>
                  <button onClick={() => handleOpenUserModal()} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-100 transition-all tracking-widest">
                    <UserPlus size={16}/> Convidar
                  </button>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-5 bg-slate-50/50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-md transition-all group">
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 bg-${u.color}-100 text-${u.color}-600 rounded-2xl flex items-center justify-center font-black text-lg uppercase`}>{u.name.charAt(0)}</div>
                          <div>
                            <p className="font-black text-slate-800">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{u.email}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-6">
                         <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-1 rounded border border-slate-200">{u.role}</span>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenUserModal(u)} className="p-2 text-slate-300 hover:text-blue-600 rounded-lg"><Edit size={18}/></button>
                            <button onClick={() => handleRequestDeleteUser(u)} className="p-2 text-slate-300 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'categorias' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Tag className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Categorização BI</h3>
               </div>
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="flex gap-4">
                     <input type="text" placeholder="Nome da categoria..." className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                     <button onClick={handleSaveCategory} className="bg-blue-600 text-white px-8 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20">{editingCategory ? <Save size={18}/> : <Plus size={18}/>} {editingCategory ? 'Salvar' : 'Adicionar'}</button>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-blue-200 transition-all">
                       <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full bg-${cat.color}-500 shadow-sm`}></div>
                          <p className="font-black text-slate-700 text-sm tracking-tight">{cat.name}</p>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingCategory(cat); setNewCatName(cat.name); setNewCatColor(cat.color); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                          <button onClick={() => setCategories(categories.filter(c => c.id !== cat.id))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <MessageSquare className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Templates de Comunicação</h3>
               </div>
               <div className="space-y-4">
                  {templates.map((t) => {
                    const IconComponent = ICON_MAP[t.icon] || MessageSquare;
                    return (
                    <div key={t.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-blue-200 transition-all">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400"><IconComponent size={18}/></div>
                             <div><p className="font-black text-slate-800 text-sm">{t.title}</p><span className="text-[10px] font-bold text-slate-400 uppercase">{t.channel}</span></div>
                          </div>
                          <button onClick={() => setEditingTemplate(t)} className="text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg">Configurar</button>
                       </div>
                       <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic border-l-2 border-slate-200 pl-3">"{t.body}"</p>
                    </div>
                  )})}
               </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAIS (Usuário e Edição Template - Simplificados para brevidade) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !createdUserCreds && setIsUserModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-200">
             {createdUserCreds ? (
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCheck size={40} /></div>
                    <div><h3 className="text-2xl font-black text-slate-800 mb-2">Usuário Criado!</h3><p className="text-sm text-slate-500 font-medium">Copie as credenciais abaixo.</p></div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-left space-y-4">
                        <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">E-mail</p><p className="text-lg font-bold text-slate-800">{createdUserCreds.email}</p></div>
                        <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Senha</p><p className="text-2xl font-black text-blue-600">{createdUserCreds.pass}</p></div>
                    </div>
                    <button onClick={handleCopyCreds} className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800">{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? 'Copiado!' : 'Copiar Credenciais'}</button>
                    <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 font-bold text-xs hover:text-slate-600">Fechar</button>
                </div>
             ) : (
                <form onSubmit={handleSaveUser} className="space-y-4">
                    <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="Nome" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} />
                    <input required type="email" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" placeholder="E-mail" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
                    <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4">Salvar</button>
                </form>
             )}
          </div>
        </div>
      )}

      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingTemplate(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-200">
             <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Edit2 size={24} className="text-blue-500"/> Editar Template</h3>
             <div className="space-y-4">
                <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium h-40 resize-none text-sm" value={editingTemplate.body} onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} />
                <div className="flex justify-end gap-3 pt-4"><button onClick={() => setEditingTemplate(null)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase">Cancelar</button><button onClick={handleSaveTemplate} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase">Salvar</button></div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
