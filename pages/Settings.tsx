
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database, Bell, Shield, Globe, Mail, User, Building, Users, MoreVertical, Edit2, Plus, Loader2, X, AlertTriangle, Copy, Check, Send, Info, Key, Server, Cpu } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';

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
    logo_url: '', // Campo para logo
    
    // Integrations Keys
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
  const [userForm, setUserForm] = useState({ id: '', full_name: '', role: 'user' });
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
    const { data } = await supabase.from('profiles').select('*');
    setUsersList(data || []);
    setLoadingUsers(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    // Tenta primeiro um select para ver se existe ID 1, senão cria
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
        role: user.role || 'user'
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
      if (!editingUser) return;
      
      const { error } = await supabase.from('profiles').update({
          full_name: userForm.full_name,
          role: userForm.role,
          updated_at: new Date().toISOString()
      }).eq('id', userForm.id);

      if (!error) {
          loadUsers();
          setUserModalOpen(false);
          addToast('success', 'Usuário Atualizado', 'Permissões alteradas com sucesso.');
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
    { id: 'users', label: 'Equipe', icon: Users },
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
                                  <p className="text-xs text-slate-400 font-medium">Controle de acesso e permissões.</p>
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
                                            <p className="font-bold text-slate-800">{user.full_name || 'Sem nome'}</p>
                                            <p className="text-xs text-slate-400">{user.email || 'Usuário do sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            user.role === 'admin' || user.role === 'super_admin' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            user.role === 'gerente' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                            'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}>
                                            {user.role || 'User'}
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
                          {/* Chaves de IA */}
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                              <h4 className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-widest mb-4">
                                  <Cpu size={16} className="text-blue-500"/> Modelos de IA (LLMs)
                              </h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gemini API Key (Google) - Recomendado</label>
                                      <div className="flex gap-2">
                                          <input type="password" placeholder="AIzaSy..." className="flex-1 p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                                              value={companyInfo.gemini_key} onChange={e => setCompanyInfo({...companyInfo, gemini_key: e.target.value})} />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">OpenAI API Key (GPT-4)</label>
                                      <input type="password" placeholder="sk-..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                                          value={companyInfo.openai_key} onChange={e => setCompanyInfo({...companyInfo, openai_key: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Anthropic API Key (Claude)</label>
                                      <input type="password" placeholder="sk-ant..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                                          value={companyInfo.anthropic_key} onChange={e => setCompanyInfo({...companyInfo, anthropic_key: e.target.value})} />
                                  </div>
                              </div>
                          </div>

                          {/* Chaves de Veículos */}
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                              <h4 className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-widest mb-4">
                                  <Server size={16} className="text-green-500"/> Busca Veicular & Dados
                              </h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Token APIBrasil (Placas)</label>
                                      <input type="password" placeholder="Bearer Token..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                                          value={companyInfo.apibrasil_token} onChange={e => setCompanyInfo({...companyInfo, apibrasil_token: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chave de Integração Detran</label>
                                      <input type="password" placeholder="Chave Privada..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                                          value={companyInfo.detran_key} onChange={e => setCompanyInfo({...companyInfo, detran_key: e.target.value})} />
                                  </div>
                              </div>
                          </div>
                          
                          <div className="p-4 bg-amber-50 text-amber-700 text-xs font-bold rounded-2xl flex items-center gap-2 border border-amber-100">
                              <Info size={16}/> As chaves são salvas de forma segura no banco de dados da sua instância.
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'notifications' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Bell size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Alertas e Notificações</h3>
                              <p className="text-xs text-slate-400 font-medium">Controle como você recebe atualizações.</p>
                          </div>
                      </div>
                      <div className="space-y-4">
                          {['Novos Sinistros', 'Aprovação de OCs', 'Alteração de Status', 'Mensagens de Fornecedores'].map((item, i) => (
                              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <span className="font-bold text-slate-700">{item}</span>
                                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer bg-blue-600">
                                      <span className="absolute left-0 inline-block w-6 h-6 bg-white border-2 border-blue-600 rounded-full shadow transform translate-x-6 transition-transform"></span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
               {activeTab === 'security' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><Shield size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Segurança da Conta</h3>
                              <p className="text-xs text-slate-400 font-medium">Gerencie senhas e acessos.</p>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="flex justify-between items-center mb-4">
                              <div>
                                  <p className="font-bold text-slate-700">Autenticação de Dois Fatores (2FA)</p>
                                  <p className="text-xs text-slate-400">Adicione uma camada extra de segurança.</p>
                              </div>
                              <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-50">Configurar</button>
                          </div>
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-slate-700">Alterar Senha</p>
                                  <p className="text-xs text-slate-400">Última alteração há 30 dias.</p>
                              </div>
                              <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-50">Redefinir</button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Modal Editar Usuário */}
      {userModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUserModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-800">Editar Usuário</h3>
                      <button onClick={() => setUserModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome de Exibição</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Função / Permissão</label>
                          <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                              <option value="user">User (Padrão)</option>
                              <option value="gerente">Gerente</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                          </select>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button onClick={() => setUserModalOpen(false)} className="px-4 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                          <button onClick={handleSaveUser} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Convidar/Adicionar Membro */}
      {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInviteModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
                      <div className="relative z-10">
                          <h3 className="text-2xl font-black mb-2">Convidar Membro</h3>
                          <p className="text-slate-300 text-xs font-medium max-w-xs leading-relaxed">
                            Por questões de segurança (criptografia), novos usuários devem criar suas próprias senhas através do portal de registro.
                          </p>
                      </div>
                      <Users className="absolute -right-6 -bottom-6 text-white/5 rotate-12" size={120}/>
                      <button onClick={() => setInviteModalOpen(false)} className="absolute top-6 right-6 text-white/50 hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Link de Registro Exclusivo</label>
                          <div className="flex gap-2">
                             <div className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs text-slate-600 break-all select-all flex items-center">
                                {`${window.location.origin}/register`}
                             </div>
                             <button 
                               onClick={copyInviteLink}
                               className={`px-5 rounded-2xl font-black transition-all shadow-lg flex items-center justify-center ${copied ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}
                             >
                                {copied ? <Check size={20}/> : <Copy size={20}/>}
                             </button>
                          </div>
                          <p className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5">
                             <Info size={12}/> O usuário entrará automaticamente como "User" e poderá ser promovido aqui.
                          </p>
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                          <a href={`mailto:?subject=Convite para AutoClaims Pro&body=Olá, acesse o link abaixo para criar seu cadastro: ${window.location.origin}/register`} className="text-blue-600 text-xs font-bold uppercase tracking-widest hover:underline flex items-center gap-2">
                             <Send size={14}/> Enviar por E-mail
                          </a>
                          <button onClick={() => setInviteModalOpen(false)} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">
                             Fechar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
