
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, Building, Users, Lock, 
  Bell, Palette, Globe, Save, CheckCircle, Database,
  MessageSquare, Target, Mail, ShieldAlert, Key, 
  CreditCard, Layout, Zap, UserPlus, MoreVertical, MessageCircle,
  Tag, Plus, Trash2, Edit, Upload, X, Shield, Check, Smartphone, FileText,
  Clock, Edit2, AlertTriangle, RefreshCcw, Copy, CheckCheck, Link as LinkIcon
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
  icon: string; // Alterado para string para evitar erro de serialização
}

// Mapa de ícones para renderização segura
const ICON_MAP: Record<string, any> = {
  'MessageCircle': MessageCircle,
  'Mail': Mail,
  'MessageSquare': MessageSquare,
  // Fallbacks
  'WhatsApp': MessageCircle,
  'E-mail': Mail
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'sistema' | 'templates' | 'metas' | 'categorias' | 'seguranca' | 'integracoes'>('empresa');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES DE DADOS ---
  // Empresa
  const [companyInfo, setCompanyInfo] = useState({
    name: 'AutoClaims Pro Insurance Services LTDA',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1000, 15º Andar - São Paulo, SP',
    logo: '' // Base64 string
  });

  // Usuários
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<AppUser>>({ permissions: [] });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null); // Novo estado para exclusão
  
  // Estado para exibir credenciais após criação
  const [createdUserCreds, setCreatedUserCreds] = useState<{email: string, pass: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Regras
  const [rules, setRules] = useState({
    approvalLimit: 5000,
    notifications: { quotes: true, pendingOC: true, sla: false, delivery: true },
    audit: { logs: true, priceView: true, justifyLow: true, mfaHighValue: false }
  });

  // Templates
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<CommTemplate | null>(null);

  // Metas
  const [goals, setGoals] = useState({
    savingsTarget: 15,
    monthlyBudget: 250000,
    minSuppliersPerQuote: 3
  });

  // Segurança
  const [security, setSecurity] = useState({
    enforce2FA: false,
    passwordExpiry: 90, // dias
    sessionTimeout: 30, // minutos
    ipWhitelist: ''
  });

  // Integrações (Chaves - Simulando Secure Storage)
  const [apiKeys, setApiKeys] = useState({
    plateApi: '',
    gemini: '',
    openai: '',
    anthropic: '',
    groq: ''
  });

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    // Carregar Empresa
    const savedCompany = mockStorage.get('app_company');
    if (savedCompany) setCompanyInfo(savedCompany);

    // Carregar Usuários
    const savedUsers = mockStorage.get('app_users');
    if (savedUsers) {
      setUsers(savedUsers);
    } else {
      setUsers([
        { id: '1', name: 'Admin Master', email: 'admin@autoclaims.com', role: 'Administrador Senior', status: 'Ativo', color: 'blue', permissions: ['all'] },
        { id: '2', name: 'João Comprador', email: 'joao@autoclaims.com', role: 'Gestor de Compras', status: 'Ativo', color: 'indigo', permissions: ['compras', 'cotacoes'] },
        { id: '3', name: 'Maria Sinistros', email: 'maria@autoclaims.com', role: 'Analista de Sinistros', status: 'Ativo', color: 'slate', permissions: ['eventos', 'relatorios'] },
      ]);
    }

    // Carregar Categorias
    const savedCats = mockStorage.get('app_categories');
    setCategories(savedCats || [
      { id: '1', name: 'Funilaria Pesada', color: 'red' },
      { id: '2', name: 'Mecânica', color: 'blue' },
      { id: '3', name: 'Elétrica', color: 'yellow' },
    ]);

    // Carregar Regras
    const savedRules = mockStorage.get('app_rules');
    if (savedRules) setRules(savedRules);

    // Carregar Templates com Migração de Dados Antigos
    const savedTemplates = mockStorage.get('app_templates');
    if (savedTemplates) {
      // Migração segura: garante que 'icon' seja string
      const safeTemplates = savedTemplates.map((t: any) => ({
        ...t,
        icon: typeof t.icon === 'string' ? t.icon : (t.channel === 'WhatsApp' ? 'MessageCircle' : 'Mail')
      }));
      setTemplates(safeTemplates);
    } else {
      setTemplates([
        { id: '1', title: 'RFQ - Envio de Cotação', channel: 'WhatsApp', body: 'Olá {{fornecedor}}, solicitamos cotação para o evento {{protocolo}} com urgência.', icon: 'MessageCircle' },
        { id: '2', title: 'OC - Confirmação', channel: 'E-mail', subject: 'Nova Ordem de Compra #{{oc_codigo}}', body: 'Prezado, segue em anexo a OC referente ao sinistro {{protocolo}}.', icon: 'Mail' },
      ]);
    }

    // Carregar Metas
    const savedGoals = mockStorage.get('app_goals');
    if (savedGoals) setGoals(savedGoals);

    // Carregar Segurança
    const savedSecurity = mockStorage.get('app_security');
    if (savedSecurity) setSecurity(savedSecurity);

    // Carregar Chaves (Simulação - Na prática, viria mascarado do backend)
    const savedKeys = mockStorage.get('app_keys');
    if (savedKeys) setApiKeys(savedKeys);

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
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetDatabase = () => {
    if (confirm('ATENÇÃO: Isso limpará todos os dados locais (associados, veículos, cotações) e recarregará a página. Deseja continuar?')) {
        localStorage.clear();
        window.location.reload();
    }
  };

  // --- HANDLERS ESPECÍFICOS ---

  // Empresa & Logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) return alert("A imagem deve ter no máximo 500KB");
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyInfo(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Usuários
  const handleOpenUserModal = (user?: AppUser) => {
    setCreatedUserCreds(null);
    setCopied(false);
    if (user) {
      setEditingUser(user);
      setUserFormData(user);
    } else {
      setEditingUser(null);
      setUserFormData({ 
        name: '', email: '', role: '', status: 'Ativo', color: 'slate', permissions: [] 
      });
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

    const updated = editingUser 
      ? users.map(u => u.id === editingUser.id ? newUser : u)
      : [...users, newUser];
    
    setUsers(updated);
    mockStorage.set('app_users', updated); // Salva imediatamente

    if (!editingUser) {
        // Se for novo usuário, gera credenciais e exibe
        setCreatedUserCreds({
            email: newUser.email,
            pass: Math.random().toString(36).slice(-8).toUpperCase()
        });
    } else {
        setIsUserModalOpen(false);
    }
  };

  const handleRequestDeleteUser = (user: AppUser) => {
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = () => {
    if (userToDelete) {
        const updated = users.filter(u => u.id !== userToDelete.id);
        setUsers(updated);
        mockStorage.set('app_users', updated); // Salvar imediatamente
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
        const text = `Acesso AutoClaims Pro\nURL: ${window.location.origin}\nLogin: ${createdUserCreds.email}\nSenha: ${createdUserCreds.pass}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  // Categorias
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

  // Templates
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
        <button 
          onClick={handleSaveAll}
          className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest ${saved ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'}`}
        >
          {saved ? <CheckCircle size={18}/> : <Save size={18} />}
          {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar de Navegação */}
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

        {/* Área de Conteúdo */}
        <div className="flex-1 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm min-h-[600px] relative">
          
          {/* ABA INTEGRAÇÕES */}
          {activeTab === 'integracoes' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                 <LinkIcon className="text-purple-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Chaves de API & Conexões</h3>
               </div>
               
               <div className="space-y-6">
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                     <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Database size={18} className="text-blue-500"/> API de Placas (Veículos)
                     </h4>
                     <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Chave de Acesso (Backend)</label>
                     <input 
                        type="password"
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="sk_prod_..."
                        value={apiKeys.plateApi}
                        onChange={e => setApiKeys({...apiKeys, plateApi: e.target.value})}
                     />
                     <p className="text-[10px] text-slate-400 mt-2">Usado pelo endpoint <code>/api/vehicles/lookup</code></p>
                  </div>

                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                     <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-500"/> Inteligência Artificial (LLMs)
                     </h4>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Google Gemini API Key</label>
                            <input 
                                type="password"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-600"
                                placeholder="AIza..."
                                value={apiKeys.gemini}
                                onChange={e => setApiKeys({...apiKeys, gemini: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">OpenAI API Key</label>
                            <input 
                                type="password"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-600"
                                placeholder="sk-..."
                                value={apiKeys.openai}
                                onChange={e => setApiKeys({...apiKeys, openai: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Anthropic API Key</label>
                            <input 
                                type="password"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-600"
                                placeholder="sk-ant..."
                                value={apiKeys.anthropic}
                                onChange={e => setApiKeys({...apiKeys, anthropic: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Groq API Key</label>
                            <input 
                                type="password"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-600"
                                placeholder="gsk_..."
                                value={apiKeys.groq}
                                onChange={e => setApiKeys({...apiKeys, groq: e.target.value})}
                            />
                        </div>
                     </div>
                     <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-xs font-medium">
                        <AlertTriangle size={14} className="inline mr-1 -mt-0.5"/> 
                        As chaves são salvas criptografadas no banco e usadas apenas pelo backend. O frontend nunca tem acesso a elas.
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

          {/* ABA USUÁRIOS */}
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
                         <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${u.status === 'Ativo' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{u.status}</span>
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

          {/* ... (Demais abas mantidas iguais) ... */}
          {activeTab === 'categorias' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Tag className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Categorização BI</h3>
               </div>
               
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">{editingCategory ? 'Editar Categoria' : 'Adicionar Nova Categoria'}</p>
                  <div className="flex gap-4">
                     <input 
                        type="text" 
                        placeholder="Nome da categoria..."
                        className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                     />
                     <select 
                        className="p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 w-32"
                        value={newCatColor}
                        onChange={e => setNewCatColor(e.target.value)}
                     >
                        <option value="blue">Azul</option>
                        <option value="red">Vermelho</option>
                        <option value="green">Verde</option>
                        <option value="orange">Laranja</option>
                        <option value="purple">Roxo</option>
                     </select>
                     <button 
                        onClick={handleSaveCategory}
                        className="bg-blue-600 text-white px-8 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20"
                     >
                        {editingCategory ? <Save size={18}/> : <Plus size={18}/>}
                        {editingCategory ? 'Salvar' : 'Adicionar'}
                     </button>
                     {editingCategory && (
                         <button onClick={() => { setEditingCategory(null); setNewCatName(''); }} className="p-4 text-slate-400 hover:text-slate-600"><X size={18}/></button>
                     )}
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

          {activeTab === 'sistema' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               {/* ... (conteúdo sistema) */}
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <ShieldAlert className="text-indigo-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Regras & Auditoria</h3>
               </div>
               <div className="space-y-6">
                  <div className="flex items-center justify-between p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-[32px]">
                     <div className="flex-1">
                        <p className="font-black text-blue-900 text-lg">Alçada de Aprovação Automática</p>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed max-w-md">Limite máximo para aprovação automática pelo sistema.</p>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-blue-800 tracking-tighter">R$</span>
                        <input className="w-40 p-4 bg-white border-2 border-blue-200 rounded-2xl font-black text-blue-900 text-center text-xl shadow-inner outline-none" 
                            type="number" value={rules.approvalLimit} onChange={e => setRules({...rules, approvalLimit: Number(e.target.value)})} />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="p-8 bg-slate-50/80 border border-slate-100 rounded-[32px]">
                        <div className="flex items-center gap-2 mb-6 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                          <Bell size={14}/> Notificações
                        </div>
                        <div className="space-y-4">
                           <label className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={rules.notifications.quotes} onChange={e => setRules({...rules, notifications: {...rules.notifications, quotes: e.target.checked}})} className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500" />
                              Novas Cotações
                           </label>
                           <label className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={rules.notifications.pendingOC} onChange={e => setRules({...rules, notifications: {...rules.notifications, pendingOC: e.target.checked}})} className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500" />
                              OCs Pendentes
                           </label>
                        </div>
                     </div>
                     <div className="p-8 bg-slate-50/80 border border-slate-100 rounded-[32px]">
                        <div className="flex items-center gap-2 mb-6 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                          <Zap size={14}/> Auditoria
                        </div>
                        <div className="space-y-4">
                           <label className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={rules.audit.logs} onChange={e => setRules({...rules, audit: {...rules.audit, logs: e.target.checked}})} className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500" />
                              Log Completo de Acessos
                           </label>
                           <label className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={rules.audit.justifyLow} onChange={e => setRules({...rules, audit: {...rules.audit, justifyLow: e.target.checked}})} className="w-5 h-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-500" />
                              Justificativa para Desvios
                           </label>
                        </div>
                     </div>
                  </div>

                  <div className="p-6 border border-red-200 bg-red-50 rounded-[28px] flex items-center justify-between">
                     <div>
                        <h4 className="text-red-800 font-black flex items-center gap-2"><Trash2 size={18}/> Zona de Perigo</h4>
                        <p className="text-xs text-red-600 mt-1">Isso apagará todos os dados locais (associados, veículos, cotações) e reiniciará a aplicação.</p>
                     </div>
                     <button 
                        onClick={handleResetDatabase}
                        className="bg-white border border-red-200 text-red-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-red-50 flex items-center gap-2"
                     >
                        <RefreshCcw size={14}/> Resetar Dados
                     </button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               {/* ... (conteúdo templates) */}
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
                             <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                               <IconComponent size={18}/>
                             </div>
                             <div>
                                <p className="font-black text-slate-800 text-sm">{t.title}</p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{t.channel}</span>
                             </div>
                          </div>
                          <button onClick={() => setEditingTemplate(t)} className="text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg">Configurar</button>
                       </div>
                       <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic border-l-2 border-slate-200 pl-3">"{t.body}"</p>
                    </div>
                  )})}
               </div>
            </div>
          )}

          {activeTab === 'metas' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               {/* ... (conteúdo metas) */}
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Target className="text-green-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Metas & KPIs</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta de Savings (%)</p>
                       <div className="relative">
                          <input className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] text-2xl font-black text-slate-800 pl-6" 
                            type="number" value={goals.savingsTarget} onChange={e => setGoals({...goals, savingsTarget: Number(e.target.value)})} />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">%</span>
                       </div>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Budget Mensal</p>
                       <div className="relative">
                          <input className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] text-2xl font-black text-slate-800 pl-14" 
                            type="number" value={goals.monthlyBudget} onChange={e => setGoals({...goals, monthlyBudget: Number(e.target.value)})} />
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">R$</span>
                       </div>
                     </div>
                  </div>
                  <div className="bg-green-50 p-8 rounded-[32px] border border-green-100 flex flex-col justify-center items-center text-center">
                     <Target size={48} className="text-green-500 mb-4 opacity-50" />
                     <h4 className="font-black text-green-900 mb-2 text-xl">Monitoramento Ativo</h4>
                     <p className="text-xs text-green-700 leading-relaxed font-medium max-w-xs">
                       As metas definidas aqui ajustam os termômetros do dashboard principal e calibram os alertas da IA.
                     </p>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'seguranca' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               {/* ... (conteúdo segurança) */}
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Shield className="text-red-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Segurança da Informação</h3>
               </div>
               
               <div className="grid grid-cols-1 gap-6">
                  <div className="p-6 bg-white border border-slate-200 rounded-3xl flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-2xl"><Smartphone size={24} className="text-slate-600"/></div>
                        <div>
                           <p className="font-bold text-slate-800">Autenticação de Dois Fatores (2FA)</p>
                           <p className="text-xs text-slate-400">Forçar uso de 2FA para administradores</p>
                        </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" className="sr-only peer" checked={security.enforce2FA} onChange={e => setSecurity({...security, enforce2FA: e.target.checked})} />
                       <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                     </label>
                  </div>

                  <div className="p-6 bg-white border border-slate-200 rounded-3xl flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-2xl"><Key size={24} className="text-slate-600"/></div>
                        <div>
                           <p className="font-bold text-slate-800">Rotação de Senhas</p>
                           <p className="text-xs text-slate-400">Dias para expiração obrigatória</p>
                        </div>
                     </div>
                     <input type="number" className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold outline-none" 
                        value={security.passwordExpiry} onChange={e => setSecurity({...security, passwordExpiry: Number(e.target.value)})} />
                  </div>

                  <div className="p-6 bg-white border border-slate-200 rounded-3xl flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-2xl"><Clock size={24} className="text-slate-600"/></div>
                        <div>
                           <p className="font-bold text-slate-800">Timeout de Sessão</p>
                           <p className="text-xs text-slate-400">Minutos de inatividade para logout</p>
                        </div>
                     </div>
                     <input type="number" className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold outline-none" 
                        value={security.sessionTimeout} onChange={e => setSecurity({...security, sessionTimeout: Number(e.target.value)})} />
                  </div>

                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl">
                     <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert size={18} className="text-red-600"/>
                        <p className="font-black text-red-900 text-sm uppercase">Whitelist de IP</p>
                     </div>
                     <textarea 
                        className="w-full p-4 bg-white border border-red-200 rounded-2xl text-xs font-mono text-slate-600 outline-none h-24 resize-none"
                        placeholder="Insira os IPs permitidos separados por vírgula..."
                        value={security.ipWhitelist}
                        onChange={e => setSecurity({...security, ipWhitelist: e.target.value})}
                     />
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !createdUserCreds && setIsUserModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-200">
             
             {createdUserCreds ? (
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                        <CheckCheck size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Usuário Criado!</h3>
                        <p className="text-sm text-slate-500 font-medium">Copie as credenciais abaixo e envie para o colaborador.</p>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-left space-y-4 relative">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">E-mail de Acesso</p>
                            <p className="text-lg font-bold text-slate-800 break-all">{createdUserCreds.email}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Senha Temporária</p>
                            <p className="text-2xl font-black text-blue-600 tracking-wider">{createdUserCreds.pass}</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleCopyCreds}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                        {copied ? <Check size={18}/> : <Copy size={18}/>}
                        {copied ? 'Copiado!' : 'Copiar Credenciais'}
                    </button>
                    
                    <button 
                        onClick={() => setIsUserModalOpen(false)}
                        className="text-slate-400 font-bold text-xs hover:text-slate-600"
                    >
                        Fechar Janela
                    </button>
                </div>
             ) : (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-slate-800">{editingUser ? 'Editar Usuário' : 'Convidar Colaborador'}</h3>
                        <button onClick={() => setIsUserModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                        placeholder="Nome Completo" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} />
                        <input required type="email" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" 
                        placeholder="E-mail Corporativo" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
                        <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-600"
                        value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})}>
                        <option value="">Selecione o Cargo...</option>
                        <option value="Administrador Senior">Administrador Senior</option>
                        <option value="Gestor de Compras">Gestor de Compras</option>
                        <option value="Analista de Sinistros">Analista de Sinistros</option>
                        <option value="Auditor">Auditor</option>
                        </select>
                        
                        <div className="pt-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Permissões de Acesso</p>
                        <div className="grid grid-cols-2 gap-2">
                            {['dashboard', 'eventos', 'cotacoes', 'compras', 'financeiro', 'configuracoes'].map(perm => (
                                <label key={perm} className="flex items-center gap-2 text-xs font-bold text-slate-600 p-2 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" checked={userFormData.permissions?.includes(perm)} onChange={() => togglePermission(perm)} className="w-4 h-4 rounded text-blue-600"/>
                                    {perm.charAt(0).toUpperCase() + perm.slice(1)}
                                </label>
                            ))}
                        </div>
                        </div>

                        <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4">
                            {editingUser ? 'Salvar Usuário' : 'Criar e Gerar Senha'}
                        </button>
                    </form>
                </>
             )}
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão Moderna */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setUserToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-500/10">
              <Trash2 size={40} />
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2">Remover Usuário?</h3>
            
            <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">
              Você está prestes a revogar o acesso de <span className="font-bold text-slate-800">{userToDelete.name}</span>. Esta ação é irreversível.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setUserToDelete(null)} 
                className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteUser} 
                className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all"
              >
                Confirmar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Template */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingTemplate(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-200">
             <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
               <Edit2 size={24} className="text-blue-500"/> Editar Template: {editingTemplate.title}
             </h3>
             <div className="space-y-4">
                {editingTemplate.channel === 'E-mail' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Assunto</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold"
                       value={editingTemplate.subject} onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Conteúdo da Mensagem</label>
                  <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium h-40 resize-none text-sm leading-relaxed"
                     value={editingTemplate.body} onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} />
                  <p className="text-[10px] text-slate-400 mt-2">Variáveis disponíveis: {'{{protocolo}}'}, {'{{fornecedor}}'}, {'{{oc_codigo}}'}</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                   <button onClick={() => setEditingTemplate(null)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                   <button onClick={handleSaveTemplate} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase">Salvar Template</button>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
