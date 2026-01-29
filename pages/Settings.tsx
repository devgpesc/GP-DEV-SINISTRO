
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database, Bell, Shield, Globe, Mail, User, Building, Users, MoreVertical, Edit2, Plus, Loader2, X, AlertTriangle, Copy, Check, Send, Info, Key, Server, Cpu, ToggleLeft, ToggleRight, Zap, Brain, MessageSquare, UserPlus, Link as LinkIcon, Trash2, ClipboardList, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import ActionModal from '../components/ActionModal';
import { Invitation, AuditLog } from '../types';

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
  const { profile } = useAuth();
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
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // User Form com Permissões
  const [userForm, setUserForm] = useState({ 
      id: '', 
      full_name: '', 
      role: 'Usuário', 
      permissions: {} as Record<string, boolean>
  });
  
  // Invite Form State
  const [inviteData, setInviteData] = useState({ name: '', email: '' });
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
        loadUsers();
    }
    if (activeTab === 'audit') {
        loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (inviteModalOpen && !generatedLink) {
        // Reset link on open if empty
        setGeneratedLink(`${window.location.origin}/register`);
        loadInvitations();
    }
  }, [inviteModalOpen]);

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

  const loadAuditLogs = async () => {
      setLoadingLogs(true);
      const logs = await auditService.getLogs();
      setAuditLogs(logs);
      setLoadingLogs(false);
  };

  const loadInvitations = async () => {
      const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
      
      // Verifica status baseado se o email já existe na tabela profiles
      if (data) {
          const { data: profiles } = await supabase.from('profiles').select('email');
          const registeredEmails = profiles?.map(p => p.email) || [];
          
          const updatedInvites = data.map((inv: any) => ({
              ...inv,
              status: registeredEmails.includes(inv.email) ? 'accepted' : 'pending'
          }));
          setInvitations(updatedInvites);
      }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const { error } = await supabase.from('saas_settings').upsert({
        id: 1, 
        ...companyInfo,
        updated_at: new Date().toISOString()
    });

    if (!error) {
        await auditService.log('Update Settings', 'Settings', 'Global', companyInfo);
        setSaved(true);
        addToast('success', 'Configurações Salvas', 'As alterações globais foram aplicadas com sucesso.');
        setTimeout(() => setSaved(false), 3000);
    } else {
        console.error(error);
        addToast('error', 'Erro ao Salvar', error.message || 'Falha na comunicação com o servidor.');
    }
    setSaving(false);
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

  const handleDeleteUser = async () => {
      if (!userToDelete) return;
      
      try {
          // Remove perfil (Trigger cascade no Auth não é possível via Client, 
          // então apenas removemos o perfil para bloquear acesso na app via RLS)
          const { error } = await supabase.from('profiles').delete().eq('id', userToDelete.id);
          
          if (error) throw error;

          await auditService.log('Delete User', 'User', userToDelete.id, { email: userToDelete.email });
          
          setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
          setUserToDelete(null);
          addToast('success', 'Usuário Removido', 'O acesso foi revogado.');
      } catch (error: any) {
          addToast('error', 'Erro', 'Não foi possível remover o usuário. Verifique permissões.');
      }
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
      
      const updates = {
          full_name: userForm.full_name,
          role: userForm.role,
          permissions: userForm.permissions,
          updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', userForm.id);

      if (!error) {
          await auditService.log('Update User', 'User', userForm.id, updates);
          loadUsers();
          setUserModalOpen(false);
          addToast('success', 'Permissões Atualizadas', 'As configurações do usuário foram salvas.');
      } else {
          addToast('error', 'Erro', error.message);
      }
  };

  const generateInviteLink = async () => {
      const baseUrl = `${window.location.origin}/register`;
      const params = new URLSearchParams();
      if (inviteData.email) params.append('email', inviteData.email);
      if (inviteData.name) params.append('name', inviteData.name);
      
      const link = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      setGeneratedLink(link);

      // Registrar convite no banco
      if (inviteData.email) {
          const { error } = await supabase.from('invitations').insert([{
              email: inviteData.email,
              name: inviteData.name,
              token: link, // Simplificação
              created_by: profile.id
          }]);
          
          if (!error) {
              await auditService.log('Create Invite', 'Invitation', inviteData.email, { link });
              loadInvitations();
          }
      }
  };

  const handleDeleteInvite = async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (!error) {
          setInvitations(prev => prev.filter(i => i.id !== id));
          addToast('success', 'Revogado', 'Convite cancelado com sucesso.');
      } else {
          addToast('error', 'Erro', 'Não foi possível remover o convite.');
      }
  };

  const copyInviteLink = () => {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('success', 'Link Copiado', 'Envie este link para o novo colaborador.');
  };

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'users', label: 'Equipe e Permissões', icon: Users },
    ...(profile?.role === 'Admin' || profile?.role === 'super_admin' ? [{ id: 'audit', label: 'Auditoria', icon: ClipboardList }] : []),
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
                          <button onClick={() => { setInviteModalOpen(true); setGeneratedLink(`${window.location.origin}/register`); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/20">
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
                                                {user.id === profile?.id && <span className="bg-amber-100 text-amber-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Eu</span>}
                                            </p>
                                            <p className="text-xs text-slate-400">{user.email || 'Usuário do sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                        {user.id !== profile?.id && (
                                            <button onClick={() => setUserToDelete(user)} className="p-2 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                         </div>
                      )}
                  </div>
              )}

              {activeTab === 'audit' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><ClipboardList size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Logs de Auditoria</h3>
                              <p className="text-xs text-slate-400 font-medium">Histórico completo de ações no sistema.</p>
                          </div>
                      </div>
                      
                      {loadingLogs ? (
                          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                      ) : (
                          <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                              <table className="w-full text-left">
                                  <thead className="border-b border-slate-200 bg-slate-100">
                                      <tr>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuário</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ação</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Alvo</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                      {auditLogs.map(log => (
                                          <tr key={log.id} className="text-xs">
                                              <td className="p-4 text-slate-500 font-mono">
                                                  {new Date(log.created_at).toLocaleString()}
                                              </td>
                                              <td className="p-4 font-bold text-slate-700">
                                                  {log.profiles?.full_name || log.user_email || 'Sistema'}
                                              </td>
                                              <td className="p-4">
                                                  <span className="bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-600">{log.action}</span>
                                              </td>
                                              <td className="p-4 text-slate-500">
                                                  {log.entity} <span className="opacity-50">#{log.entity_id?.substring(0,8)}</span>
                                              </td>
                                          </tr>
                                      ))}
                                      {auditLogs.length === 0 && (
                                          <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              )}

              {/* ABA DE INTEGRAÇÕES (IA) */}
              {activeTab === 'integrations' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Brain size={24}/></div>
                        <div>
                           <h3 className="text-lg font-black text-slate-800">IA & Integrações</h3>
                           <p className="text-xs text-slate-400 font-medium">Configure as chaves de API para os modelos de IA e serviços externos.</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 gap-6">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                           <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                              <Zap size={14} className="text-amber-500"/> Chaves de Inteligência (LLM)
                           </h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-[10px] font-bold text-slate-500 mb-2">Google Gemini API Key</label>
                                 <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                    <input type="password" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" 
                                    value={companyInfo.gemini_key} onChange={e => setCompanyInfo({...companyInfo, gemini_key: e.target.value})} placeholder="sk-..." />
                                 </div>
                              </div>
                              <div>
                                 <label className="block text-[10px] font-bold text-slate-500 mb-2">OpenAI API Key</label>
                                 <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                    <input type="password" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" 
                                    value={companyInfo.openai_key} onChange={e => setCompanyInfo({...companyInfo, openai_key: e.target.value})} placeholder="sk-..." />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                           <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                              <Globe size={14} className="text-blue-500"/> Serviços Externos
                           </h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-[10px] font-bold text-slate-500 mb-2">APIBrasil Token (Veículos)</label>
                                 <input type="password" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" 
                                 value={companyInfo.apibrasil_token} onChange={e => setCompanyInfo({...companyInfo, apibrasil_token: e.target.value})} />
                              </div>
                              <div>
                                 <label className="block text-[10px] font-bold text-slate-500 mb-2">Detran API Key (Opcional)</label>
                                 <input type="password" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" 
                                 value={companyInfo.detran_key} onChange={e => setCompanyInfo({...companyInfo, detran_key: e.target.value})} />
                              </div>
                           </div>
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
                                          {userForm.permissions[feature.id] ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <button onClick={() => setUserModalOpen(false)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancelar</button>
                          <button onClick={handleSaveUser} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Convidar Usuário */}
      {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInviteModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-6 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><UserPlus size={20}/></div>
                          <h3 className="text-xl font-black text-slate-800">Convidar Membro</h3>
                      </div>
                      <button onClick={() => setInviteModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-1">
                      <div className="space-y-6">
                          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700 text-xs font-medium leading-relaxed">
                              <Info size={16} className="mb-2 inline-block mr-1 align-bottom"/>
                              Preencha os dados abaixo para gerar um link de convite personalizado.
                          </div>

                          <div className="space-y-4">
                              <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome do Colaborador</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                                      value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} placeholder="Ex: Maria Souza" />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail Corporativo</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                                      value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} placeholder="maria@empresa.com" />
                              </div>
                          </div>

                          <button onClick={generateInviteLink} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-900 transition-all flex items-center justify-center gap-2">
                              <LinkIcon size={16}/> Gerar Link de Acesso
                          </button>

                          {generatedLink && (
                              <div className="animate-in fade-in slide-in-from-top-2">
                                  <label className="block text-[10px] font-black uppercase text-green-600 mb-2">Link Gerado com Sucesso</label>
                                  <div className="flex items-center gap-2">
                                      <input readOnly className="flex-1 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs font-mono outline-none" value={generatedLink} />
                                      <button onClick={copyInviteLink} className="p-3 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors">
                                          {copied ? <Check size={18}/> : <Copy size={18}/>}
                                      </button>
                                  </div>
                                  <div className="flex justify-center mt-4">
                                      <a href={`mailto:${inviteData.email}?subject=Convite para AutoClaims Pro&body=Olá ${inviteData.name}, acesse o link para criar sua conta: ${generatedLink}`} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                          <Send size={12}/> Enviar por E-mail agora
                                      </a>
                                  </div>
                              </div>
                          )}

                          {/* Histórico de Convites */}
                          <div className="pt-6 border-t border-slate-100">
                              <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Convites Enviados</h4>
                                  <button onClick={loadInvitations} className="text-slate-400 hover:text-blue-600"><RefreshCw size={14}/></button>
                              </div>
                              <div className="space-y-2">
                                  {invitations.map(inv => (
                                      <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                          <div>
                                              <p className="text-xs font-bold text-slate-700">{inv.name || 'Sem nome'}</p>
                                              <p className="text-[10px] text-slate-400">{inv.email}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${inv.status === 'accepted' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                  {inv.status === 'accepted' ? 'Aceito' : 'Pendente'}
                                              </span>
                                              <button onClick={() => handleDeleteInvite(inv.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                  <Trash2 size={14}/>
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                                  {invitations.length === 0 && <p className="text-xs text-slate-400 text-center italic">Nenhum convite recente.</p>}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      <ActionModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Excluir Usuário?"
        description={`O usuário ${userToDelete?.full_name} perderá acesso imediato ao sistema. Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, Remover Acesso"
      />
    </div>
  );
};

export default Settings;
