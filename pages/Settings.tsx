
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database, Bell, Shield, Globe, Mail, User, Building, Users, MoreVertical, Edit2, Plus, Loader2, X, AlertTriangle, Copy, Check, Send, Info, Key, Server, Cpu, ToggleLeft, ToggleRight, Zap, Brain, MessageSquare } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';

// Definição das funcionalidades disponíveis no sistema
const SYSTEM_FEATURES = [
  { id: 'financial_view', label: 'Ver Financeiro', desc: 'Acesso a valores e relatórios de custo.' },
  { id: 'approve_purchases', label: 'Aprovar Compras', desc: 'Permissão para aprovar Ordens de Compra (OC).' },
  { id: 'manage_users', label: 'Gerir Equipe', desc: 'Adicionar e editar outros usuários.' },
  { id: 'delete_records', label: 'Exclusão', desc: 'Pode excluir registros permanentemente.' },
  { id: 'view_reports', label: 'Relatórios BI', desc: 'Acesso à central de inteligência.' }
];

const Settings: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Company Info State
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'AutoClaims Pro',
    cnpj: '',
    address: '',
    email: '',
    phone: '',
    logo_url: '', 
    apibrasil_token: '',
    detran_key: '',
    openai_key: '',
    gemini_key: '',
    anthropic_key: '',
    groq_key: ''
  });

  // Users Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // User Form com Permissões
  const [userForm, setUserForm] = useState({ 
      id: '', 
      full_name: '', 
      role: 'Usuário', // Default corrigido para constraint
      permissions: {} as Record<string, boolean>
  });
  
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
        loadUsers();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('saas_settings').select('*').limit(1).maybeSingle();
    if (data) {
        setCompanyInfo({
            company_name: data.company_name || 'AutoClaims Pro',
            cnpj: data.cnpj || '',
            address: data.address || '',
            email: data.email || '',
            phone: data.phone || '',
            logo_url: data.logo_url || '',
            apibrasil_token: data.apibrasil_token || '',
            detran_key: data.detran_key || '',
            openai_key: data.openai_key || '',
            gemini_key: data.gemini_key || '',
            anthropic_key: data.anthropic_key || '',
            groq_key: data.groq_key || ''
        });
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setUsersList(data || []);
    setLoadingUsers(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const { error } = await supabase.from('saas_settings').upsert({
        id: 1, 
        ...companyInfo,
        updated_at: new Date().toISOString()
    });

    setSaving(false);

    if (!error) {
        setSaved(true);
        addToast('success', 'Configurações Salvas', 'As alterações globais foram aplicadas com sucesso.');
        setTimeout(() => setSaved(false), 3000);
    } else {
        console.error(error);
        addToast('error', 'Erro ao Salvar', error.message || 'Falha na comunicação com o servidor.');
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserForm({
        id: user.id,
        full_name: user.full_name || '',
        role: user.role || 'Usuário',
        permissions: user.permissions || {}
    });
    setUserModalOpen(true);
  };

  const togglePermission = (featureId: string) => {
      setUserForm(prev => ({
          ...prev,
          permissions: {
              ...prev.permissions,
              [featureId]: !prev.permissions[featureId]
          }
      }));
  };

  const handleSaveUser = async () => {
      if (!editingUser) return;
      
      const { error } = await supabase.from('profiles').update({
          full_name: userForm.full_name,
          role: userForm.role,
          permissions: userForm.permissions, // Salva o JSON de permissões
          updated_at: new Date().toISOString()
      }).eq('id', userForm.id);

      if (!error) {
          loadUsers();
          setUserModalOpen(false);
          addToast('success', 'Permissões Atualizadas', 'As configurações do usuário foram salvas.');
      } else {
          addToast('error', 'Erro', error.message);
      }
  };

  const copyInviteLink = () => {
      const link = `${window.location.origin}/register`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('info', 'Link Copiado', 'Envie este link para o novo colaborador.');
  };

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'users', label: 'Equipe e Permissões', icon: Users }, // Atualizado label
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'integrations', label: 'Integrações & IA', icon: Globe },
    { id: 'security', label: 'Segurança', icon: Shield },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Configurações</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie as preferências globais do sistema.</p>
        </div>
        <button 
            onClick={handleSaveAll} 
            disabled={saving}
            className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70'}`}
        >
          {saving ? <Loader2 className="animate-spin" size={18}/> : saved ? <CheckCircle size={18}/> : <Save size={18} />} 
          {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col md:flex-row">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-4">
              <div className="space-y-1">
                  {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                          <tab.icon size={18}/>
                          {tab.label}
                      </button>
                  ))}
              </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8">
              {activeTab === 'general' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Building size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Dados da Empresa</h3>
                              <p className="text-xs text-slate-400 font-medium">Informações visíveis em relatórios e login.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Logo URL (Imagem)</label>
                            <div className="flex gap-4 items-center">
                                <input className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-xs" 
                                value={companyInfo.logo_url} onChange={e => setCompanyInfo({...companyInfo, logo_url: e.target.value})} placeholder="https://exemplo.com/logo.png" />
                                {companyInfo.logo_url && (
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center p-1">
                                        <img src={companyInfo.logo_url} alt="Logo Preview" className="max-w-full max-h-full object-contain"/>
                                    </div>
                                )}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Razão Social</label>
                            <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                              value={companyInfo.company_name} onChange={e => setCompanyInfo({...companyInfo, company_name: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CNPJ</label>
                            <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                              value={companyInfo.cnpj} onChange={e => setCompanyInfo({...companyInfo, cnpj: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Telefone</label>
                            <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                              value={companyInfo.phone} onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})} placeholder="(00) 0000-0000" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Endereço Completo</label>
                            <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none h-24 resize-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                              value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} />
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'users' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                          <div className="flex items-center gap-3">
                              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Users size={24}/></div>
                              <div>
                                  <h3 className="text-lg font-black text-slate-800">Gestão de Equipe</h3>
                                  <p className="text-xs text-slate-400 font-medium">Controle de acesso e permissões granulares.</p>
                              </div>
                          </div>
                          <button onClick={() => setInviteModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700">
                             <Plus size={14}/> Adicionar Membro
                          </button>
                      </div>

                      {loadingUsers ? (
                         <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                      ) : (
                         <div className="space-y-3">
                            {usersList.map(user => (
                                <div key={user.id} className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} className="w-10 h-10 rounded-full border border-slate-200 object-cover"/>
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div>
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-800 flex items-center gap-2">
                                                {user.full_name || 'Sem nome'}
                                                {user.email === 'devgpesc@gmail.com' && <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Eu</span>}
                                            </p>
                                            <p className="text-xs text-slate-400">{user.email || 'Usuário do sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            user.role === 'Admin' || user.role === 'super_admin' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            user.role === 'Gerente' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                            'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}>
                                            {user.role || 'Usuário'}
                                        </span>
                                        <button onClick={() => handleEditUser(user)} className="p-2 text-slate-300 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                                            <Edit2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                         </div>
                      )}
                  </div>
              )}

              {/* ABA DE INTEGRAÇÕES (IA) */}
              {activeTab === 'integrations' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Globe size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Integrações & API</h3>
                              <p className="text-xs text-slate-400 font-medium">Configure chaves externas para busca veicular e inteligência artificial.</p>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                              <h4 className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-widest mb-6">
                                  <Cpu size={16} className="text-blue-500"/> Modelos de IA (LLMs)
                              </h4>
                              
                              <div className="space-y-5">
                                  {/* Gemini */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Cpu size={12}/> Gemini API Key (Google) <span className="text-blue-500">* Padrão</span></label>
                                      <input type="password" placeholder="AIzaSy..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                                          value={companyInfo.gemini_key} onChange={e => setCompanyInfo({...companyInfo, gemini_key: e.target.value})} />
                                  </div>

                                  {/* OpenAI */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Zap size={12}/> OpenAI API Key (GPT-4)</label>
                                      <input type="password" placeholder="sk-..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-green-500/20 transition-all bg-white"
                                          value={companyInfo.openai_key} onChange={e => setCompanyInfo({...companyInfo, openai_key: e.target.value})} />
                                  </div>

                                  {/* Anthropic / Claude */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Brain size={12}/> Anthropic API Key (Claude 3.5)</label>
                                      <input type="password" placeholder="sk-ant-api..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500/20 transition-all bg-white"
                                          value={companyInfo.anthropic_key} onChange={e => setCompanyInfo({...companyInfo, anthropic_key: e.target.value})} />
                                  </div>

                                  {/* Groq */}
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Server size={12}/> Groq API Key (Llama 3 / Mixtral)</label>
                                      <input type="password" placeholder="gsk_..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/20 transition-all bg-white"
                                          value={companyInfo.groq_key} onChange={e => setCompanyInfo({...companyInfo, groq_key: e.target.value})} />
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
              {/* ... Outras abas ... */}
          </div>
      </div>

      {/* Modal Editar Usuário e Permissões */}
      {userModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUserModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-6 animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h3 className="text-xl font-black text-slate-800">Editar Usuário</h3>
                      <button onClick={() => setUserModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="space-y-6">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome de Exibição</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Função Principal</label>
                          <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                              {/* Valores devem corresponder ao CHECK constraint do banco */}
                              <option value="Usuário">Usuário (Operacional)</option>
                              <option value="Gerente">Gerente (Gestão)</option>
                              <option value="Admin">Admin (Total)</option>
                          </select>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                          <label className="block text-[10px] font-black uppercase text-blue-600 mb-4 flex items-center gap-2"><Key size={14}/> Funcionalidades Permitidas</label>
                          <div className="space-y-3">
                              {SYSTEM_FEATURES.map(feature => (
                                  <div key={feature.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                      <div className="flex-1 pr-4">
                                          <p className="text-xs font-bold text-slate-700">{feature.label}</p>
                                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{feature.desc}</p>
                                      </div>
                                      <button 
                                        onClick={() => togglePermission(feature.id)}
                                        className={`p-1.5 rounded-lg transition-all ${userForm.permissions[feature.id] ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}
                                      >
                                          {userForm.permissions[feature.id] ? <ToggleRight size={28} className="fill-current"/> : <ToggleLeft size={28}/>}
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-3">
                          <button onClick={() => setUserModalOpen(false)} className="px-4 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                          <button onClick={handleSaveUser} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20">Salvar Permissões</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* Modal Invite ... */}
      {/* ... (código existente do modal invite) ... */}
    </div>
  );
};

export default Settings;
