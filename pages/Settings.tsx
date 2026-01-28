
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, Building, Users, Lock, 
  Bell, Palette, Globe, Save, CheckCircle, Database,
  MessageSquare, Target, Mail, ShieldAlert, Key, 
  CreditCard, Layout, Zap, UserPlus, MoreVertical, MessageCircle,
  Tag, Plus, Trash2, Edit, Upload, X, Shield, Check, Smartphone, FileText,
  Clock, Edit2, AlertTriangle, RefreshCcw, Copy, CheckCheck, Link as LinkIcon,
  Server, ArrowUp, ArrowDown, TrendingUp, Calculator, Hourglass, PieChart,
  Eye, FileSearch, Gavel, Loader2, XCircle
} from 'lucide-react';
import { mockStorage } from '../services/supabaseClient';
import { Category } from '../types';
import ActionModal from '../components/ActionModal';

// Interfaces Locais
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  color: string;
  permissions: string[];
  password?: string; // Adicionado para persistir senha no mock
}

interface CommTemplate {
  id: string;
  title: string;
  channel: 'WhatsApp' | 'E-mail' | 'Sistema';
  subject?: string;
  body: string;
  icon: string;
}

// Configuração de API do Backend Local (Vite Proxy)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

const ICON_MAP: Record<string, any> = {
  'MessageCircle': MessageCircle,
  'Mail': Mail,
  'WhatsApp': MessageCircle,
  'E-mail': Mail,
  'Sistema': MessageSquare
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
    minSuppliersPerQuote: 3,
    maxSlaHours: 48
  });

  const [security, setSecurity] = useState({
    enforce2FA: false,
    passwordExpiry: 90,
    sessionTimeout: 30,
    ipWhitelist: ''
  });

  // Integrações
  const [apiKeys, setApiKeys] = useState({
    plateApi: '', 
    gemini: '',
    openai: '',
    anthropic: '',
    groq: ''
  });

  // Providers de Placa
  const [plateProviders, setPlateProviders] = useState([
    { id: 'apibrasil', name: 'APIBrasil (Padrão)', type: 'REST', priority: 1, active: true, key: '', testStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error' },
    { id: 'detran-go', name: 'Detran-GO (Estadual)', type: 'SOAP/Gov', priority: 2, active: false, key: '', testStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error' }
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
    if (savedGoals) {
        setGoals(prev => ({...prev, ...savedGoals}));
    }

    const savedSecurity = mockStorage.get('app_security');
    if (savedSecurity) setSecurity(savedSecurity);

    const savedKeys = mockStorage.get('app_keys');
    if (savedKeys) setApiKeys(savedKeys);

    const savedProviders = mockStorage.get('app_plate_providers');
    if (savedProviders) {
        const validProviders = savedProviders
            .filter((p: any) => p.id !== 'detran')
            .map((p: any) => ({...p, testStatus: 'idle'}));
        setPlateProviders(validProviders);
    }

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
    
    const providersToSave = plateProviders.map(({ testStatus, ...rest }) => rest);
    mockStorage.set('app_plate_providers', providersToSave);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestProvider = async (index: number) => {
    const provider = plateProviders[index];
    if (!provider.key) return alert('Insira uma chave para testar.');

    const newProviders = [...plateProviders];
    newProviders[index].testStatus = 'loading';
    setPlateProviders(newProviders);

    try {
        const testPlate = 'ABC1234'; 
        const response = await fetch(`${API_BASE}/vehicles/lookup?plate=${testPlate}&provider=${provider.id}`, {
            headers: { 'x-provider-token': provider.key }
        });

        if (response.ok) {
            newProviders[index].testStatus = 'success';
        } else {
            newProviders[index].testStatus = 'error';
        }
    } catch (error) {
        newProviders[index].testStatus = 'error';
    } finally {
        setPlateProviders([...newProviders]);
        setTimeout(() => {
            const resetProviders = [...plateProviders];
            if (resetProviders[index]) {
                resetProviders[index].testStatus = 'idle';
                setPlateProviders(resetProviders);
            }
        }, 3000);
    }
  };

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
    
    // Gera senha aleatória se for novo usuário
    const generatedPass = editingUser ? undefined : Math.random().toString(36).slice(-8).toUpperCase();

    const newUser: AppUser = {
      id: editingUser ? editingUser.id : Math.random().toString(36).substr(2, 9),
      name: userFormData.name!,
      email: userFormData.email!,
      role: userFormData.role || 'Colaborador',
      status: (userFormData.status as any) || 'Ativo',
      color: userFormData.color || 'blue',
      permissions: userFormData.permissions || [],
      password: editingUser ? editingUser.password : generatedPass // Mantém ou define nova senha
    };

    const updated = editingUser ? users.map(u => u.id === editingUser.id ? newUser : u) : [...users, newUser];
    setUsers(updated);
    
    // PERSISTE IMEDIATAMENTE NO LOCALSTORAGE para garantir que o login funcione
    mockStorage.set('app_users', updated);
    
    if (!editingUser) {
        setCreatedUserCreds({ email: newUser.email, pass: generatedPass! });
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

  const handleResetDatabase = () => {
    if (window.confirm("ATENÇÃO: Isso limpará todo o banco de dados local (MockStorage) e recarregará a página. Deseja continuar?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  // Componentes Auxiliares
  const NavButton = ({ tab, icon: Icon, label }: { tab: any, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab ? 'bg-white border border-slate-200 shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-200/50'}`}
    >
      <Icon size={18}/> {label}
    </button>
  );

  const ToggleSwitch = ({ checked, onChange, label, subLabel, icon: Icon }: any) => (
    <div className="flex items-start justify-between group p-3 rounded-2xl hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => onChange(!checked)}>
        <div className="flex gap-3">
            <div className={`p-2 rounded-lg transition-colors ${checked ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className={`text-sm font-bold transition-colors ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{label}</p>
                <p className="text-[10px] text-slate-400 font-medium leading-tight max-w-[200px]">{subLabel}</p>
            </div>
        </div>
        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
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
                                <div className="flex gap-4 items-end">
                                    <div className="flex-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">API Key / Token</label>
                                        <input 
                                            type="password"
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-blue-300 focus:bg-white transition-all"
                                            value={provider.key}
                                            placeholder={provider.id === 'apibrasil' ? 'Ex: abc123def456...' : 'sk_...'}
                                            onChange={(e) => {
                                                const updated = [...plateProviders];
                                                updated[index].key = e.target.value;
                                                setPlateProviders(updated);
                                            }}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleTestProvider(index)}
                                        disabled={!provider.key || provider.testStatus === 'loading'}
                                        className={`px-6 h-[42px] rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${
                                            provider.testStatus === 'success' ? 'bg-green-100 text-green-700' :
                                            provider.testStatus === 'error' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                        }`}
                                    >
                                        {provider.testStatus === 'loading' && <Loader2 size={14} className="animate-spin"/>}
                                        {provider.testStatus === 'success' && <CheckCircle size={14}/>}
                                        {provider.testStatus === 'error' && <XCircle size={14}/>}
                                        {provider.testStatus === 'loading' ? 'Testando...' : 
                                         provider.testStatus === 'success' ? 'Conectado!' : 
                                         provider.testStatus === 'error' ? 'Falha' : 'Testar'}
                                    </button>
                                </div>
                                {(provider.id === 'detran-go') && (
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

          {/* ABA CATEGORIAS */}
          {activeTab === 'categorias' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <Tag className="text-pink-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Categorias de Serviço</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-widest">Nova Categoria</h4>
                    <div className="flex gap-3 mb-4">
                       <input className="flex-1 p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-blue-500" 
                          placeholder="Nome da categoria..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                       <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                          {['blue', 'red', 'green', 'amber', 'purple'].map(color => (
                             <button key={color} onClick={() => setNewCatColor(color)} className={`w-8 h-8 rounded-lg m-0.5 transition-transform hover:scale-110 ${newCatColor === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''} bg-${color}-500`}></button>
                          ))}
                       </div>
                    </div>
                    {/* Botão de Adicionar Categoria agora AZUL */}
                    <button onClick={handleSaveCategory} disabled={!newCatName} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">Adicionar Categoria</button>
                 </div>
                 {/* ... Resto do código da aba categorias ... */}
                 <div className="space-y-3">
                    {categories.map(cat => (
                       <div key={cat.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                             <div className={`w-3 h-3 rounded-full bg-${cat.color}-500`}></div>
                             <span className="font-bold text-slate-700">{cat.name}</span>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => { setEditingCategory(cat); setNewCatName(cat.name); setNewCatColor(cat.color); }} className="p-1.5 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>
                             <button onClick={() => setCategories(categories.filter(c => c.id !== cat.id))} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {/* ... Outras abas (mantidas iguais, apenas renderização condicional) ... */}
          {activeTab === 'empresa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <Building className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Identidade Corporativa</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Razão Social</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                      value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CNPJ (Matriz)</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                      value={companyInfo.cnpj} onChange={e => setCompanyInfo({...companyInfo, cnpj: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Endereço Completo</label>
                    <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all h-24 resize-none" 
                      value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-100 border-dashed border-2">
                   {companyInfo.logo ? (
                     <div className="relative group">
                       <img src={companyInfo.logo} className="w-32 h-32 object-contain mb-4 rounded-xl" alt="Logo" />
                       <button onClick={() => setCompanyInfo({...companyInfo, logo: ''})} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                     </div>
                   ) : (
                     <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                       <Building size={48} />
                     </div>
                   )}
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                   <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 font-black text-xs uppercase tracking-widest hover:text-blue-700 flex items-center gap-2">
                     <Upload size={14}/> Carregar Logo
                   </button>
                   <p className="text-[9px] text-slate-400 mt-2 text-center">PNG ou JPG (Max 2MB)<br/>Recomendado: 500x500px</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-4">
                 <div className="flex items-center gap-2">
                    <Users className="text-indigo-500" size={20}/>
                    <h3 className="text-lg font-black text-slate-800">Controle de Acesso</h3>
                 </div>
                 <button onClick={() => handleOpenUserModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
                    <UserPlus size={16}/> Novo Usuário
                 </button>
              </div>
              <div className="space-y-4">
                 {users.map(u => (
                   <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black bg-${u.color}-500 shadow-lg shadow-${u.color}-500/30`}>
                            {u.name.charAt(0)}
                         </div>
                         <div>
                            <p className="font-bold text-slate-800">{u.name} {u.status === 'Inativo' && <span className="text-[9px] text-red-500 bg-red-50 px-2 py-0.5 rounded ml-2 uppercase">Inativo</span>}</p>
                            <p className="text-xs text-slate-500">{u.email} • <span className="text-indigo-600 font-bold">{u.role}</span></p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleOpenUserModal(u)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><Edit size={16}/></button>
                         <button onClick={() => handleRequestDeleteUser(u)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"><Trash2 size={16}/></button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-4">
                 <div className="flex items-center gap-2">
                    <MessageSquare className="text-green-500" size={20}/>
                    <h3 className="text-lg font-black text-slate-800">Comunicação Automatizada</h3>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {templates.map(t => {
                    const Icon = ICON_MAP[t.icon] || MessageCircle;
                    return (
                       <div key={t.id} className="p-6 bg-white border border-slate-200 rounded-3xl hover:border-green-300 transition-all group relative cursor-pointer" onClick={() => setEditingTemplate(t)}>
                          <div className="flex justify-between items-start mb-4">
                             <div className={`p-3 rounded-xl ${t.channel === 'WhatsApp' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                <Icon size={24} />
                             </div>
                             <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">{t.channel}</span>
                          </div>
                          <h4 className="font-bold text-slate-800">{t.title}</h4>
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{t.body}</p>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Edit size={16} className="text-slate-300"/>
                          </div>
                       </div>
                    );
                 })}
              </div>
            </div>
          )}

          {activeTab === 'metas' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <Target className="text-red-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Objetivos Financeiros</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                     <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2"><ArrowDown size={16}/> Meta de Saving</h4>
                        <span className="text-2xl font-black text-green-600">{goals.savingsTarget}%</span>
                     </div>
                     <input type="range" min="0" max="50" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600" 
                        value={goals.savingsTarget} onChange={e => setGoals({...goals, savingsTarget: Number(e.target.value)})} />
                     <p className="text-xs text-slate-400 mt-2 text-center">Alvo de redução sobre preço médio de mercado.</p>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2"><CreditCard size={16}/> Budget Mensal</h4>
                     </div>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                        <input type="number" className="w-full pl-10 p-3 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-200 focus:border-red-400 transition-all"
                           value={goals.monthlyBudget} onChange={e => setGoals({...goals, monthlyBudget: Number(e.target.value)})} />
                     </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2"><Hourglass size={16}/> SLA Máximo (h)</h4>
                     </div>
                     <div className="flex items-center gap-4">
                        <input type="number" className="w-24 p-3 bg-white rounded-xl font-black text-slate-700 outline-none border border-slate-200 text-center"
                           value={goals.maxSlaHours} onChange={e => setGoals({...goals, maxSlaHours: Number(e.target.value)})} />
                        <span className="text-xs font-bold text-slate-400">Horas para conclusão do processo</span>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'sistema' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <Gavel className="text-amber-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Políticas de Compliance</h3>
               </div>
               
               <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 mb-6">
                  <h4 className="text-amber-800 font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2"><ShieldAlert size={16}/> Alçada de Aprovação</h4>
                  <div className="flex items-center gap-4">
                     <div className="flex-1 bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Aprovação Automática até</p>
                        <div className="flex items-baseline gap-1">
                           <span className="text-sm font-bold text-slate-400">R$</span>
                           <input type="number" className="font-black text-2xl text-slate-700 bg-transparent outline-none w-full"
                              value={rules.approvalLimit} onChange={e => setRules({...rules, approvalLimit: Number(e.target.value)})} />
                        </div>
                     </div>
                     <p className="text-xs text-amber-700 font-medium max-w-[200px]">Compras acima deste valor exigirão aprovação de um gestor nível 2.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Auditoria & Segurança</h4>
                     <ToggleSwitch checked={rules.audit.logs} onChange={(v: boolean) => setRules({...rules, audit: {...rules.audit, logs: v}})} label="Logs Detalhados" subLabel="Registrar cada clique e alteração" icon={FileSearch} />
                     <ToggleSwitch checked={rules.audit.priceView} onChange={(v: boolean) => setRules({...rules, audit: {...rules.audit, priceView: v}})} label="Ocultar Preços" subLabel="Esconder valores para analistas jr." icon={Eye} />
                     <ToggleSwitch checked={rules.audit.justifyLow} onChange={(v: boolean) => setRules({...rules, audit: {...rules.audit, justifyLow: v}})} label="Justificativa de Preço" subLabel="Exigir motivo ao não escolher o menor preço" icon={MessageCircle} />
                  </div>
                  <div className="space-y-2">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Notificações</h4>
                     <ToggleSwitch checked={rules.notifications.quotes} onChange={(v: boolean) => setRules({...rules, notifications: {...rules.notifications, quotes: v}})} label="Novas Cotações" subLabel="Alertar ao receber preços" icon={Bell} />
                     <ToggleSwitch checked={rules.notifications.pendingOC} onChange={(v: boolean) => setRules({...rules, notifications: {...rules.notifications, pendingOC: v}})} label="OCs Pendentes" subLabel="Lembrete diário de aprovação" icon={Clock} />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'seguranca' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <Shield className="text-slate-800" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Segurança da Informação</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-slate-100 rounded-2xl"><Key size={24} className="text-slate-600"/></div>
                        <div>
                           <h4 className="font-bold text-slate-800">Autenticação</h4>
                           <p className="text-xs text-slate-400">Políticas de senha e acesso.</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <ToggleSwitch checked={security.enforce2FA} onChange={(v: boolean) => setSecurity({...security, enforce2FA: v})} label="Forçar 2FA" subLabel="Exigir segundo fator para todos" icon={Smartphone} />
                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Expiração de Senha (dias)</label>
                           <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none border border-slate-100"
                              value={security.passwordExpiry} onChange={e => setSecurity({...security, passwordExpiry: Number(e.target.value)})} />
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-red-50 rounded-2xl"><Server size={24} className="text-red-600"/></div>
                        <div>
                           <h4 className="font-bold text-slate-800">Controle de Rede</h4>
                           <p className="text-xs text-slate-400">Restrições de IP e sessão.</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Timeout de Sessão (min)</label>
                           <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none border border-slate-100"
                              value={security.sessionTimeout} onChange={e => setSecurity({...security, sessionTimeout: Number(e.target.value)})} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Whitelist de IPs (Separar por vírgula)</label>
                           <textarea className="w-full p-3 bg-slate-50 rounded-xl font-medium text-xs text-slate-600 outline-none border border-slate-100 h-24 resize-none font-mono"
                              value={security.ipWhitelist} onChange={e => setSecurity({...security, ipWhitelist: e.target.value})} placeholder="192.168.1.1, 10.0.0.1..." />
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="pt-8 border-t border-slate-100">
                  <button onClick={handleResetDatabase} className="w-full py-4 border-2 border-red-100 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                     <AlertTriangle size={16}/> Resetar Base de Dados Local (Emergência)
                  </button>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-800">{editingUser ? 'Editar Usuário' : 'Novo Colaborador'}</h3>
                <button onClick={() => setIsUserModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
             </div>
             
             {!createdUserCreds ? (
               <form onSubmit={handleSaveUser} className="space-y-4">
                  <input required placeholder="Nome Completo" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} />
                  <input required type="email" placeholder="E-mail Corporativo" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                     <select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-slate-600" value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})}>
                        <option value="">Selecione Cargo...</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Gestor">Gestor</option>
                        <option value="Analista">Analista</option>
                     </select>
                     <select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-slate-600" value={userFormData.color} onChange={e => setUserFormData({...userFormData, color: e.target.value})}>
                        <option value="blue">Azul</option>
                        <option value="green">Verde</option>
                        <option value="indigo">Roxo</option>
                        <option value="amber">Laranja</option>
                     </select>
                  </div>
                  
                  <div className="pt-2">
                     <p className="text-xs font-black uppercase text-slate-400 mb-2">Permissões de Acesso</p>
                     <div className="flex flex-wrap gap-2">
                        {['compras', 'cotacoes', 'sinistros', 'financeiro', 'config'].map(perm => (
                           <button type="button" key={perm} onClick={() => togglePermission(perm)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${userFormData.permissions?.includes(perm) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                              {perm}
                           </button>
                        ))}
                     </div>
                  </div>

                  <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 mt-4">
                     Salvar Acesso
                  </button>
               </form>
             ) : (
               <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"><Check size={32}/></div>
                  <div>
                     <h4 className="font-bold text-slate-800">Usuário Criado!</h4>
                     <p className="text-xs text-slate-500">Copie as credenciais abaixo e envie ao colaborador.</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl text-left space-y-2 relative group">
                     <p className="text-slate-400 text-xs uppercase font-bold">Login: <span className="text-white normal-case">{createdUserCreds.email}</span></p>
                     <p className="text-slate-400 text-xs uppercase font-bold">Senha: <span className="text-white normal-case">{createdUserCreds.pass}</span></p>
                     <button onClick={handleCopyCreds} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                        {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18}/>}
                     </button>
                  </div>
                  <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Fechar</button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão */}
      {userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUserToDelete(null)}></div>
           <div className="relative bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32}/></div>
              <h3 className="font-black text-slate-800 text-lg mb-2">Remover Usuário?</h3>
              <p className="text-sm text-slate-500 mb-6">Confirma a exclusão de <b>{userToDelete.name}</b>? O acesso será revogado imediatamente.</p>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setUserToDelete(null)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                 <button onClick={handleConfirmDeleteUser} className="py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-red-600/20">Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Editar Template */}
      {editingTemplate && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingTemplate(null)}></div>
            <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
               <h3 className="text-xl font-black text-slate-800 mb-6">Editar Template</h3>
               <div className="space-y-4">
                  <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={editingTemplate.title} onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})} placeholder="Título" />
                  <textarea className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-600 outline-none h-32 resize-none" value={editingTemplate.body} onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} placeholder="Corpo da mensagem..." />
                  <div className="flex justify-end gap-3 pt-4">
                     <button onClick={() => setEditingTemplate(null)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                     <button onClick={handleSaveTemplate} className="px-8 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">Salvar</button>
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default Settings;
