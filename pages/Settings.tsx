import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database, Bell, Shield, Globe, Mail, User, Building, Users, MoreVertical, Edit2, Plus, Loader2, X, AlertTriangle, Copy, Check, Send, Info, Key, Server, Cpu, ToggleLeft, ToggleRight, Zap, Brain, MessageSquare, UserPlus, Link as LinkIcon, Trash2, ClipboardList, Clock, RefreshCw, Eye, EyeOff, MapPin, Laptop, Smartphone } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { auditService, translateAuditAction, translateAuditEntity } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { apiKeyService, ApiKeyRecord } from '../services/apiKeyService';
import ActionModal from '../components/ActionModal';
import { Invitation, AuditLog } from '../types';
import { DEFAULT_EVENT_TYPES } from '../utils/defaults';
import { getUserFacingError } from '../utils/userFacingError';
import { CANONICAL_PERMISSIONS, MODULE_PERMISSIONS, normalizeModulePermissions, normalizePermissions, sanitizeModulePermissionsForSave, sanitizePermissionsForSave } from '../services/permissionKeys';
import {
  buildInviteLoginUrl,
  buildInviteMailto,
  buildInviteRegisterUrl,
  createInvitation,
  createMemberViaApi,
  deleteMemberViaApi,
} from '../services/inviteService';

const Settings: React.FC = () => {
  const { addToast } = useToast();
  const { profile, currentTenant, access } = useAuth();
  const [activeTab, setActiveTab] = useState('ai_config');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  
  // ... (Estados companyInfo, usersList, modals mantidos igual ao original)
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'EventsCar',
    cnpj: '',
    address: '',
    email: '',
    phone: '',
    logo_url: '', 
    apibrasil_token: '',
    detran_key: '',
    ai_provider: 'google',
    ai_model: 'gemini-3-pro-preview',
    openai_key: '',
    gemini_key: '',
    anthropic_key: '',
    groq_key: '',
    event_types: DEFAULT_EVENT_TYPES as string[]
  });
  const [newEventType, setNewEventType] = useState('');

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    id: '',
    full_name: '',
    role: 'Usuário',
    membership_role: 'member',
    permissions: {} as Record<string, boolean>,
    module_permissions: {} as Record<string, boolean>,
    newPassword: '',
    confirmPassword: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'member', password: '' });
  const [generatedLink, setGeneratedLink] = useState('');
  const [generatedLoginLink, setGeneratedLoginLink] = useState('');
  const [createdMemberInfo, setCreatedMemberInfo] = useState<{ email: string; password: string; loginUrl: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [creatingApiKey, setCreatingApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [currentTenant?.id]);

  useEffect(() => {
    if (activeTab === 'users') {
        loadUsers();
    }
    if (activeTab === 'audit') {
        loadAuditLogs();
    }
    if (activeTab === 'api_connect' && currentTenant?.id) {
        loadApiKeys();
    }
  }, [activeTab, currentTenant?.id]);

  useEffect(() => {
    if (inviteModalOpen) {
        setGeneratedLink('');
        setGeneratedLoginLink('');
        setCreatedMemberInfo(null);
        setCopied(false);
        setInviteError(null);
        setInviteData({ name: '', email: '', role: 'member', password: '' });
        setShowInvitePassword(false);
        loadInvitations();
    }
  }, [inviteModalOpen, currentTenant?.id]);

  // ... (Funções toggleShowKey, loadSettings, loadUsers, loadInvitations mantidas)
  const toggleShowKey = (keyName: string) => setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));

  const loadSettings = async () => {
    setLoading(true);
    try {
        if (!currentTenant?.id) return;
        const { data } = await supabase
          .from('saas_settings')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();
        if (data) {
            setCompanyInfo({
                company_name: data.company_name || 'EventsCar',
                cnpj: data.cnpj || '',
                address: data.address || '',
                email: data.email || '',
                phone: data.phone || '',
                logo_url: data.logo_url || '',
                apibrasil_token: data.apibrasil_token || '',
                detran_key: data.detran_key || '',
                ai_provider: data.ai_provider || 'google',
                ai_model: data.ai_model || 'gemini-3-pro-preview',
                openai_key: data.openai_key || '',
                gemini_key: data.gemini_key || '',
                anthropic_key: data.anthropic_key || '',
                groq_key: data.groq_key || '',
                event_types: Array.isArray(data.event_types) && data.event_types.length > 0
                  ? data.event_types
                  : DEFAULT_EVENT_TYPES
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      if (!currentTenant?.id) {
        setUsersList([]);
        return;
      }
      const { data, error } = await supabase.rpc('get_tenant_members', { target_tenant_id: currentTenant.id });
      if (error) throw error;
      setUsersList(data || []);
    } catch (err: any) {
      console.error('Falha ao carregar equipe:', err);
      addToast('error', 'Erro', getUserFacingError(err, 'Falha ao carregar a equipe da empresa.'));
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadInvitations = async () => {
      if (!currentTenant?.id) {
        setInvitations([]);
        return;
      }
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      setInvitations(data || []);
  };

  const loadAuditLogs = async () => {
      setLoadingLogs(true);
      const logs = await auditService.getLogs();
      setAuditLogs(logs);
      setLoadingLogs(false);
  };

  const loadApiKeys = async () => {
    if (!currentTenant?.id) return;
    setLoadingApiKeys(true);
    try {
      const keys = await apiKeyService.list(currentTenant.id);
      setApiKeys(keys);
    } catch (err: any) {
      console.error('Falha ao carregar chaves de API:', err);
      addToast('error', 'Erro', getUserFacingError(err, 'Falha ao carregar as chaves de integração.'));
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!currentTenant?.id || !newApiKeyName.trim()) {
      addToast('warning', 'Nome obrigatório', 'Informe um nome para identificar a chave.');
      return;
    }
    setCreatingApiKey(true);
    try {
      const created = await apiKeyService.create(currentTenant.id, newApiKeyName.trim(), ['read']);
      setCreatedApiKey(created.key);
      setNewApiKeyName('');
      await loadApiKeys();
      addToast('success', 'Chave criada', 'Copie a chave agora — ela não será exibida novamente.');
    } catch (err: any) {
      console.error('Falha ao criar chave de API:', err);
      addToast('error', 'Erro', getUserFacingError(err, 'Não foi possível criar a chave de integração.'));
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      await apiKeyService.revoke(keyId);
      await loadApiKeys();
      addToast('success', 'Revogada', 'Chave de API desativada.');
    } catch (err: any) {
      console.error('Falha ao revogar chave de API:', err);
      addToast('error', 'Erro', getUserFacingError(err, 'Não foi possível revogar a chave de integração.'));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    if (!currentTenant?.id) {
      addToast('error', 'Empresa obrigatoria', 'Selecione uma empresa antes de salvar configuracoes.');
      setSaving(false);
      return;
    }
    const payload = {
        tenant_id: currentTenant.id,
        ...companyInfo,
        updated_at: new Date().toISOString()
    };
    try {
        const { error } = await supabase.from('saas_settings').upsert(payload, { onConflict: 'tenant_id' });
        if (error) throw error;
        await auditService.log('Update Settings', 'Settings', 'Global', { provider: companyInfo.ai_provider });
        setSaved(true);
        addToast('success', 'Salvo', 'Configurações atualizadas.');
        setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
        console.error('Erro ao salvar configurações:', error);
        addToast('error', 'Erro', getUserFacingError(error, 'Não foi possível salvar as configurações.'));
    } finally {
        setSaving(false);
    }
  };

  // ... (Funções handleEditUser, handleDeleteUser, togglePermission, handleSaveUser, generateInviteLink, handleDeleteInvite, copyInviteLink mantidas)
  const handleEditUser = (user: any) => {
      setEditingUser(user);
      setUserForm({
          id: user.id,
          full_name: user.full_name || '',
          role: user.role || 'Usuário',
          membership_role: user.membership_role || 'member',
          permissions: normalizePermissions(user.permissions),
          module_permissions: normalizeModulePermissions(user.module_permissions),
          newPassword: '',
          confirmPassword: '',
      });
      setShowEditPassword(false);
      setUserModalOpen(true);
  };
  const handleDeleteUser = async () => {
      if (!userToDelete) return;
      try {
          if (!currentTenant?.id) throw new Error('Empresa atual nao encontrada.');

          // Sempre exclusao definitiva via API (Auth + empresa). Sem fallback soft.
          const result = await deleteMemberViaApi({
            userId: userToDelete.id,
            tenantId: currentTenant.id,
            deleteAuthAccount: true,
          });
          await auditService.log('Delete User', 'User', userToDelete.id, {
            email: userToDelete.email,
            authDeleted: result.authDeleted,
          });
          setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
          setUserToDelete(null);
          addToast(
            'success',
            result.authDeleted ? 'Conta excluida' : 'Removido da equipe',
            result.message ||
              (result.authDeleted
                ? 'Acesso e conta excluidos. Pode adicionar o membro novamente com senha nova.'
                : 'Acesso removido desta empresa.'),
          );
          if (!result.authDeleted && userToDelete.email) {
            addToast(
              'info',
              'Conta de acesso',
              'O acesso a esta empresa foi removido. Se precisar recriar o membro, use Adicionar com e-mail e senha novos.',
            );
          }
      } catch (err: any) {
          console.error(err);
          console.error('Falha ao remover usuário:', err);
          addToast('error', 'Erro', getUserFacingError(err, 'Falha ao remover o usuário.'));
      }
  };

  const togglePermission = (featureId: string) => { setUserForm(prev => ({ ...prev, permissions: { ...prev.permissions, [featureId]: !prev.permissions[featureId] } })); };
  const toggleModulePermission = (moduleId: string) => {
    setUserForm(prev => ({
      ...prev,
      module_permissions: { ...prev.module_permissions, [moduleId]: !prev.module_permissions[moduleId] },
    }));
  };
  const handleSaveUser = async () => {
      if (!editingUser || !currentTenant?.id) return;

      const newPassword = userForm.newPassword.trim();
      if (newPassword) {
        if (newPassword.length < 8) {
          addToast('error', 'Senha', 'A nova senha deve ter pelo menos 8 caracteres.');
          return;
        }
        if (newPassword !== userForm.confirmPassword) {
          addToast('error', 'Senha', 'A confirmacao de senha nao confere.');
          return;
        }
        if (!editingUser.email) {
          addToast('error', 'Senha', 'E-mail do usuario nao encontrado para redefinir senha.');
          return;
        }
      }

      const payload = {
          target_tenant_id: currentTenant.id,
          target_user_id: userForm.id,
          target_full_name: userForm.full_name,
          target_role: userForm.role,
          target_permissions: sanitizePermissionsForSave(userForm.permissions),
          target_membership_role: userForm.membership_role,
          target_module_permissions: sanitizeModulePermissionsForSave(userForm.module_permissions),
      };
      const { error } = await supabase.rpc('update_tenant_member_profile', payload);
      if (error) {
          console.error('Erro ao atualizar usuário:', error);
          addToast('error', 'Erro', getUserFacingError(error, 'Não foi possível atualizar o usuário.'));
          return;
      }

      if (newPassword) {
        setSavingPassword(true);
        try {
          await createMemberViaApi({
            email: String(editingUser.email).toLowerCase(),
            password: newPassword,
            name: userForm.full_name || editingUser.full_name || 'Usuario',
            role: userForm.membership_role || 'member',
            tenantId: currentTenant.id,
            userId: userForm.id,
          });
          addToast('success', 'Senha redefinida', 'O usuario ja pode entrar com a nova senha (e Google do mesmo e-mail).');
        } catch (err: any) {
          console.error('Erro ao redefinir senha:', err);
          addToast('error', 'Senha', getUserFacingError(err, 'Permissões salvas, mas não foi possível redefinir a senha.'));
          setSavingPassword(false);
          return;
        } finally {
          setSavingPassword(false);
        }
      }

      await auditService.log('Update User', 'User', userForm.id, payload);
      loadUsers();
      setUserModalOpen(false);
      addToast('success', 'Salvo', 'Usuário atualizado.');
  };
  const createTeamMember = async () => {
      if (!profile || !currentTenant?.id) return;

      const trimmedName = inviteData.name.trim();
      const trimmedEmail = inviteData.email.trim().toLowerCase();
      const password = inviteData.password;
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
      if (!trimmedName || !trimmedEmail || !isValidEmail) {
          setInviteError('Preencha nome e e-mail válido.');
          return;
      }
      if (!password || password.length < 8) {
          setInviteError('Defina uma senha com pelo menos 8 caracteres.');
          return;
      }

      setIsGeneratingInvite(true);
      setInviteError(null);
      setCreatedMemberInfo(null);

      try {
          const result = await createMemberViaApi({
              email: trimmedEmail,
              password,
              name: trimmedName,
              role: inviteData.role || 'member',
              tenantId: currentTenant.id,
          });

          await auditService.log('Create Member', 'User', trimmedEmail, {
              role: inviteData.role || 'member',
              created: result.created,
          });
          await loadUsers();
          await loadInvitations();
          setCreatedMemberInfo({
              email: trimmedEmail,
              password,
              loginUrl: result.loginUrl || `${window.location.origin}/login`,
              message: result.message || 'Membro pronto para acessar.',
          });
          addToast('success', 'Membro adicionado', 'Acesso liberado com e-mail e senha — sem link de convite.');
      } catch (err: any) {
          console.error('Erro ao criar membro:', err);
          setInviteError(getUserFacingError(err, 'Não foi possível criar o membro.'));
      } finally {
          setIsGeneratingInvite(false);
      }
  };

  const generateInviteLink = async () => { 
      if (!profile || !currentTenant?.id) return;

      const trimmedName = inviteData.name.trim();
      const trimmedEmail = inviteData.email.trim().toLowerCase();
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
      if (!trimmedName || !trimmedEmail || !isValidEmail) {
          setInviteError('Preencha nome e e-mail válido para gerar o convite.');
          return;
      }

      setIsGeneratingInvite(true);
      setInviteError(null);

      try {
          const result = await createInvitation({
              email: trimmedEmail,
              name: trimmedName,
              role: inviteData.role || 'member',
              tenantId: currentTenant.id,
          });

          const registerUrl = buildInviteRegisterUrl(result.token);
          const loginUrl = buildInviteLoginUrl(result.token);

          await auditService.log('Create Invite', 'Invitation', trimmedEmail, { registerUrl, loginUrl, role: inviteData.role || 'member' }); 
          await loadInvitations();
          setGeneratedLink(registerUrl);
          setGeneratedLoginLink(loginUrl);
          addToast('success', 'Convite gerado', 'Envie o link para o usuario aceitar o convite.');
      } catch (err: any) {
          console.error('Erro ao gerar convite:', err);
          setInviteError(getUserFacingError(err, 'Não foi possível gerar o convite.'));
      } finally {
          setIsGeneratingInvite(false);
      }
  };
  const handleDeleteInvite = async (id: string) => { await supabase.from('invitations').delete().eq('id', id); setInvitations(prev => prev.filter(i => i.id !== id)); };
  const copyInviteLink = () => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(() => setCopied(false), 2000); addToast('success', 'Copiado', 'Link na área de transferência.'); };
  const openInviteEmail = () => {
      if (!generatedLink || !generatedLoginLink) return;
      const mailto = buildInviteMailto({
          email: inviteData.email.trim().toLowerCase(),
          name: inviteData.name.trim(),
          companyName: currentTenant?.name || 'sua empresa',
          registerUrl: generatedLink,
          loginUrl: generatedLoginLink,
      });
      window.open(mailto, '_blank');
  };

  const tabs = [
    { id: 'ai_config', label: 'Inteligência Artificial', icon: Brain },
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'event_types', label: 'Tipos de Sinistro', icon: Shield },
    ...(access.canManageTeam ? [{ id: 'users', label: 'Equipe e Permissões', icon: Users }] : []),
    ...(access.canManageSettings ? [{ id: 'api_connect', label: 'API / Integrações', icon: LinkIcon }] : []),
    ...(access.canManageSettings ? [{ id: 'audit', label: 'Auditoria', icon: ClipboardList }] : []),
    { id: 'integrations', label: 'Outras Integrações', icon: Globe },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Configurações</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie as preferências globais do sistema.</p>
        </div>
        <button onClick={handleSaveAll} disabled={saving} className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest w-full md:w-auto justify-center ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70'}`}>
          {saving ? <Loader2 className="animate-spin" size={18}/> : saved ? <CheckCircle size={18}/> : <Save size={18} />} {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col md:flex-row">
          <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-4">
              <div className="flex overflow-x-auto md:block md:space-y-1 gap-2 pb-2 md:pb-0 custom-scrollbar">
                  {tabs.map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                          <tab.icon size={18}/> {tab.label}
                      </button>
                  ))}
              </div>
          </div>

          <div className="flex-1 p-4 md:p-8">
              {/* ... (Conteúdo das tabs 'general' e 'ai_config' omitidos para brevidade, mantidos do original) ... */}
              {activeTab === 'general' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Building size={24}/></div>
                          <div><h3 className="text-lg font-black text-slate-800">Dados da Empresa</h3></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Endereço da logomarca</label>
                            <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-slate-700 outline-none" value={companyInfo.logo_url} onChange={e => setCompanyInfo({...companyInfo, logo_url: e.target.value})} />
                          </div>
                          <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Razão Social</label><input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none" value={companyInfo.company_name} onChange={e => setCompanyInfo({...companyInfo, company_name: e.target.value})} /></div>
                          <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CNPJ</label><input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none" value={companyInfo.cnpj} onChange={e => setCompanyInfo({...companyInfo, cnpj: e.target.value})} /></div>
                      </div>
                  </div>
              )}

              {activeTab === 'ai_config' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                     {/* ... (Mantém inputs de API Key) ... */}
                     <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Brain size={24}/></div>
                        <div><h3 className="text-lg font-black text-slate-800">Modelo de inteligência artificial</h3></div>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Provedor Ativo</label>
                        <div className="flex flex-wrap gap-3 mb-8">
                            {['google', 'openai', 'anthropic', 'groq'].map(p => (
                                <button key={p} onClick={() => setCompanyInfo({...companyInfo, ai_provider: p})} className={`flex-1 min-w-[100px] py-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 border-2 ${companyInfo.ai_provider === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{companyInfo.ai_provider === p && <CheckCircle size={14}/>} {p}</button>
                            ))}
                        </div>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                            <input type={showKeys['google'] ? "text" : "password"} className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none" value={companyInfo.gemini_key} onChange={e => setCompanyInfo({...companyInfo, gemini_key: e.target.value})} placeholder="Chave do Google Gemini" />
                            <button type="button" onClick={() => toggleShowKey('google')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showKeys['google'] ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                        </div>
                     </div>
                  </div>
              )}

              {activeTab === 'event_types' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Shield size={24}/></div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800">Tipos de Sinistro</h3>
                            <p className="text-sm text-slate-500">Gerencie as opções exibidas no cadastro de sinistros.</p>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <input
                            className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                            placeholder="Novo tipo, ex: Acordo"
                            value={newEventType}
                            onChange={e => setNewEventType(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newEventType.trim()) {
                                e.preventDefault();
                                if (!companyInfo.event_types.includes(newEventType.trim())) {
                                  setCompanyInfo({ ...companyInfo, event_types: [...companyInfo.event_types, newEventType.trim()] });
                                }
                                setNewEventType('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newEventType.trim()) return;
                              if (!companyInfo.event_types.includes(newEventType.trim())) {
                                setCompanyInfo({ ...companyInfo, event_types: [...companyInfo.event_types, newEventType.trim()] });
                              }
                              setNewEventType('');
                            }}
                            className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"
                          >
                            <Plus size={14}/> Adicionar
                          </button>
                      </div>
                      <div className="space-y-2">
                          {companyInfo.event_types.map((type) => (
                            <div key={type} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <span className="font-bold text-slate-700">{type}</span>
                              <button
                                type="button"
                                onClick={() => setCompanyInfo({ ...companyInfo, event_types: companyInfo.event_types.filter(t => t !== type) })}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                                title="Remover"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          ))}
                      </div>
                  </div>
              )}

              {activeTab === 'users' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                          <h3 className="text-lg font-black text-slate-800">Gestão de Equipe</h3>
                          <button onClick={() => { setInviteModalOpen(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus size={14}/> Adicionar</button>
                      </div>
                      <div className="space-y-3">
                        {usersList.map(user => (
                            <div key={user.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div>
                                    <div><p className="font-bold text-slate-800">{user.full_name || 'Sem nome'}</p><p className="text-xs text-slate-400">{user.email}</p></div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditUser(user)} className="p-2 text-slate-300 hover:text-blue-600"><Edit2 size={16}/></button>
                                    <button onClick={() => setUserToDelete(user)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                      </div>
                  </div>
              )}

              {/* ABA DE AUDITORIA */}
              {activeTab === 'audit' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><ClipboardList size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Registros de auditoria</h3>
                              <p className="text-xs text-slate-400 font-medium">Rastreabilidade completa com Geolocalização e IP.</p>
                          </div>
                      </div>
                      
                      {loadingLogs ? (
                          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                      ) : (
                          <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden overflow-x-auto">
                              <table className="w-full text-left min-w-[800px]">
                                  <thead className="border-b border-slate-200 bg-slate-100">
                                      <tr>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuário</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ação</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Alvo</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">IP / Local</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Dispositivo</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                      {auditLogs.map((log: any) => (
                                          <tr key={log.id} className="text-xs group hover:bg-white transition-colors">
                                              <td className="p-4 text-slate-500 font-mono whitespace-nowrap">
                                                  {new Date(log.created_at).toLocaleString('pt-BR')}
                                              </td>
                                              <td className="p-4 font-bold text-slate-700">
                                                  {log.profiles?.full_name || log.user_email || 'Sistema'}
                                              </td>
                                              <td className="p-4">
                                                  <span className="bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-600">{translateAuditAction(log.action)}</span>
                                              </td>
                                              <td className="p-4 text-slate-500">
                                                  <span className="font-bold text-slate-600">{translateAuditEntity(log.entity)}</span> <span className="opacity-50">#{log.entity_id?.substring(0,6)}</span>
                                              </td>
                                              <td className="p-4 text-slate-500">
                                                  {(log.details?.ip) ? (
                                                      <div className="flex flex-col">
                                                          <span className="font-mono text-[10px]">{log.details.ip}</span>
                                                          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><MapPin size={8}/> {log.details.location || 'N/D'}</span>
                                                      </div>
                                                  ) : (
                                                      <span className="text-slate-300">-</span>
                                                  )}
                                              </td>
                                              <td className="p-4 text-slate-500">
                                                  {log.details?.os ? (
                                                      <div className="flex items-center gap-1" title={log.details.userAgent}>
                                                          {log.details.os === 'Android' || log.details.os === 'iOS' ? <Smartphone size={12}/> : <Laptop size={12}/>}
                                                          <span>{log.details.os} / {log.details.browser}</span>
                                                      </div>
                                                  ) : '-'}
                                              </td>
                                          </tr>
                                      ))}
                                      {auditLogs.length === 0 && (
                                          <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'api_connect' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><LinkIcon size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Conexão via API</h3>
                              <p className="text-xs text-slate-400 font-medium">Gere chaves para integrar ERPs, BI ou automações externas.</p>
                          </div>
                      </div>

                      <div className="p-6 bg-blue-50/60 rounded-3xl border border-blue-100">
                          <p className="text-sm font-bold text-slate-700 mb-2">Documentação técnica</p>
                          <p className="text-xs text-slate-500 mb-4">Consulte o arquivo <code className="bg-white px-2 py-1 rounded">docs/API-INTEGRACAO.md</code> no repositório ou acesse <code className="bg-white px-2 py-1 rounded">GET /api/v1</code> para metadados dos endpoints.</p>
                          <p className="text-xs font-bold text-slate-600">Base URL produção: <span className="font-mono">{window.location.origin}/api/v1</span></p>
                      </div>

                      <div className="flex flex-col md:flex-row gap-3">
                          <input
                            className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                            placeholder="Nome da integração (ex: ERP Matriz)"
                            value={newApiKeyName}
                            onChange={(e) => setNewApiKeyName(e.target.value)}
                          />
                          <button
                            type="button"
                            disabled={creatingApiKey}
                            onClick={handleCreateApiKey}
                            className="px-6 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
                          >
                            {creatingApiKey ? 'Gerando...' : 'Gerar chave'}
                          </button>
                      </div>

                      {createdApiKey && (
                        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
                          <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-2">Chave gerada — copie agora</p>
                          <div className="flex gap-2">
                            <input readOnly className="flex-1 p-3 bg-white border border-amber-100 rounded-xl font-mono text-xs" value={createdApiKey} />
                            <button type="button" onClick={() => { navigator.clipboard.writeText(createdApiKey); addToast('success', 'Copiado', 'Chave copiada.'); }} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-black uppercase">Copiar</button>
                          </div>
                        </div>
                      )}

                      {loadingApiKeys ? (
                        <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                      ) : (
                        <div className="space-y-3">
                          {apiKeys.map((key) => (
                            <div key={key.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                              <div>
                                <p className="font-black text-slate-800">{key.name}</p>
                                <p className="text-xs font-mono text-slate-500 mt-1">{key.key_prefix}••••••••</p>
                                <p className="text-[10px] text-slate-400 mt-1">Criada em {new Date(key.created_at).toLocaleString('pt-BR')}{key.last_used_at ? ` • Último uso ${new Date(key.last_used_at).toLocaleString('pt-BR')}` : ''}</p>
                              </div>
                              <button type="button" onClick={() => handleRevokeApiKey(key.id)} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-black uppercase">Revogar</button>
                            </div>
                          ))}
                          {apiKeys.length === 0 && <p className="text-sm font-bold text-slate-400 text-center py-8">Nenhuma chave ativa.</p>}
                        </div>
                      )}
                  </div>
              )}

              {/* ABA DE OUTRAS INTEGRAÇÕES (NOVO) */}
              {activeTab === 'integrations' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Globe size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Conectores Externos</h3>
                              <p className="text-xs text-slate-400 font-medium">Configure APIs de terceiros para enriquecimento de dados.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                              <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2"><Zap size={16} className="text-yellow-500"/> API Brasil (Veículos)</h4>
                              <div className="space-y-4">
                                  <p className="text-xs text-slate-500">Token para consulta automática de placas e FIPE.</p>
                                  <div className="relative">
                                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                      <input 
                                          type={showKeys['apibrasil'] ? "text" : "password"} 
                                          className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none" 
                                          value={companyInfo.apibrasil_token} 
                                          onChange={e => setCompanyInfo({...companyInfo, apibrasil_token: e.target.value})} 
                                          placeholder="Token APIBrasil" 
                                      />
                                      <button type="button" onClick={() => toggleShowKey('apibrasil')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showKeys['apibrasil'] ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                                  </div>
                              </div>
                          </div>

                          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                              <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2"><Server size={16} className="text-blue-500"/> Detran (Integração)</h4>
                              <div className="space-y-4">
                                  <p className="text-xs text-slate-500">Chave de acesso para consultas estaduais.</p>
                                  <div className="relative">
                                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                      <input 
                                          type={showKeys['detran'] ? "text" : "password"} 
                                          className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none" 
                                          value={companyInfo.detran_key} 
                                          onChange={e => setCompanyInfo({...companyInfo, detran_key: e.target.value})} 
                                          placeholder="Chave Detran" 
                                      />
                                      <button type="button" onClick={() => toggleShowKey('detran')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showKeys['detran'] ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Modals mantidos igual ... */}
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
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Perfil no sistema</label>
                          <select 
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.role}
                              onChange={e => setUserForm({...userForm, role: e.target.value})}
                          >
                              <option value="Usuário">Usuário (Padrão)</option>
                              <option value="Gerente">Gerente</option>
                              <option value="Admin">Administrador (Pode ver Config e Auditoria)</option>
                              {profile?.email?.toLowerCase() === 'devgpesc@gmail.com' && (
                                  <option value="super_admin">Administrador geral da plataforma</option>
                              )}
                          </select>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Papel nesta empresa</label>
                          <select
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                              value={userForm.membership_role}
                              onChange={e => setUserForm({...userForm, membership_role: e.target.value})}
                          >
                              <option value="member">Membro</option>
                              <option value="admin">Administrador da empresa</option>
                              <option value="owner">Proprietário da empresa</option>
                          </select>
                      </div>

                      <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Redefinir senha</label>
                            <p className="text-[11px] font-semibold text-slate-500 mb-2">
                              Opcional. Define nova senha e libera login imediato (sem e-mail de confirmacao).
                              {editingUser?.email ? <> E-mail: <strong>{editingUser.email}</strong></> : null}
                            </p>
                          </div>
                          <div className="relative">
                              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                              <input
                                type={showEditPassword ? 'text' : 'password'}
                                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                                value={userForm.newPassword}
                                onChange={e => setUserForm({...userForm, newPassword: e.target.value})}
                                placeholder="Nova senha (min. 8)"
                                autoComplete="new-password"
                              />
                              <button type="button" onClick={() => setShowEditPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                                {showEditPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                              </button>
                          </div>
                          <input
                            type={showEditPassword ? 'text' : 'password'}
                            className="w-full px-3 py-3 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
                            value={userForm.confirmPassword}
                            onChange={e => setUserForm({...userForm, confirmPassword: e.target.value})}
                            placeholder="Confirmar nova senha"
                            autoComplete="new-password"
                          />
                      </div>

                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 border-b border-slate-100 pb-2">Módulos desta empresa</label>
                          <p className="text-[11px] font-semibold text-slate-400 mb-3">
                            Controle quais áreas do sistema este usuário acessa nesta empresa.
                          </p>
                          {['Menu', 'Fluxo', 'Cadastros', 'Extra'].map((group) => (
                            <div key={group} className="mb-4">
                              <p className="text-[10px] font-black uppercase text-slate-300 mb-2">{group}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {MODULE_PERMISSIONS.filter((mod) => mod.group === group).map((mod) => (
                                  <label key={mod.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                      checked={!!userForm.module_permissions[mod.id]}
                                      onChange={() => toggleModulePermission(mod.id)}
                                    />
                                    <span className="text-xs font-bold text-slate-600">{mod.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>

                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 border-b border-slate-100 pb-2">Permissões granulares desta empresa</label>
                          <p className="text-[11px] font-semibold text-slate-400 mb-3">
                            Gerentes e administradores da empresa já têm acesso amplo. Use estas flags para liberar funções específicas a membros comuns.
                          </p>
                          <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                              {CANONICAL_PERMISSIONS.map((feat) => (
                                  <label key={feat.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                      <input 
                                          type="checkbox" 
                                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                          checked={!!userForm.permissions[feat.id]}
                                          onChange={() => togglePermission(feat.id)}
                                      />
                                      <span>
                                        <span className="block text-xs font-bold text-slate-700">{feat.label}</span>
                                        <span className="block text-[11px] font-medium text-slate-400">{feat.desc}</span>
                                      </span>
                                  </label>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <button onClick={() => setUserModalOpen(false)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancelar</button>
                          <button onClick={handleSaveUser} disabled={savingPassword} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">
                            {savingPassword ? 'Salvando...' : 'Salvar'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Adicionar Membro (modelo Esc Finan) */}
      {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInviteModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-6 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><UserPlus size={20}/></div>
                          <div>
                            <h3 className="text-xl font-black text-slate-800">Adicionar Membro</h3>
                            <p className="text-[11px] font-bold text-blue-600 mt-0.5">
                              Empresa: {currentTenant?.name || 'Empresa atual'}
                            </p>
                          </div>
                      </div>
                      <button onClick={() => setInviteModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1">
                      <div className="space-y-5">
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-800 leading-relaxed">
                            Como no Esc Finan: defina e-mail e senha. Acesso liberado na hora —
                            <strong> sem link de convite e sem confirmacao de e-mail</strong>.
                            Se o usuario ja existia com problema, exclua a conta na lista e adicione de novo.
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome</label>
                              <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                  <input className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-200 focus:bg-white transition-all" value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} placeholder="Nome completo do membro" />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail</label>
                              <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                  <input type="email" className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-200 focus:bg-white transition-all" value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} placeholder="usuario@empresa.com" />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Senha de acesso</label>
                              <div className="relative">
                                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                  <input
                                    type={showInvitePassword ? 'text' : 'password'}
                                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-200 focus:bg-white transition-all"
                                    value={inviteData.password}
                                    onChange={e => setInviteData({...inviteData, password: e.target.value})}
                                    placeholder="Minimo 8 caracteres"
                                  />
                                  <button type="button" onClick={() => setShowInvitePassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                                    {showInvitePassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                                  </button>
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Perfil de acesso</label>
                              <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-200 focus:bg-white transition-all" value={inviteData.role} onChange={e => setInviteData({...inviteData, role: e.target.value})}>
                                  <option value="member">Membro</option>
                                  <option value="admin">Administrador</option>
                                  <option value="owner">Proprietário</option>
                              </select>
                          </div>

                          {inviteError && (
                              <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-bold flex items-center gap-2">
                                  <AlertTriangle size={14}/> {inviteError}
                              </div>
                          )}

                          <button onClick={createTeamMember} disabled={isGeneratingInvite} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                              {isGeneratingInvite ? <Loader2 size={16} className="animate-spin"/> : <UserPlus size={16}/>} 
                              {isGeneratingInvite ? 'Criando...' : 'Criar e liberar acesso'}
                          </button>

                          {createdMemberInfo && (
                              <div className="animate-in fade-in slide-in-from-top-2 space-y-3 p-4 rounded-2xl bg-green-50 border border-green-100">
                                  <p className="text-xs font-bold text-green-800 flex items-center gap-2">
                                    <CheckCircle size={16}/> {createdMemberInfo.message}
                                  </p>
                                  <p className="text-[11px] font-semibold text-slate-600">
                                    Passe ao usuario: <strong>{createdMemberInfo.email}</strong> / senha definida.
                                    Acesso: <a className="text-blue-600 underline" href={createdMemberInfo.loginUrl} target="_blank" rel="noreferrer">{createdMemberInfo.loginUrl}</a>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = `Acesso EventsCar\nE-mail: ${createdMemberInfo.email}\nSenha: ${createdMemberInfo.password}\nEndereço de acesso: ${createdMemberInfo.loginUrl}`;
                                      navigator.clipboard.writeText(text);
                                      setCopied(true);
                                      addToast('success', 'Copiado', 'Credenciais na area de transferencia.');
                                      setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2"
                                  >
                                    {copied ? <Check size={16}/> : <Copy size={16}/>} Copiar credenciais
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const subject = encodeURIComponent(`Acesso EventsCar - ${currentTenant?.name || 'Empresa'}`);
                                      const body = encodeURIComponent(
                                        `Ola ${inviteData.name},\n\nSeu acesso ao EventsCar foi liberado.\n\nE-mail: ${createdMemberInfo.email}\nSenha: ${createdMemberInfo.password}\nEntrar: ${createdMemberInfo.loginUrl}\n\nAtenciosamente,\nEquipe EventsCar`
                                      );
                                      window.open(`mailto:${createdMemberInfo.email}?subject=${subject}&body=${body}`, '_blank');
                                    }}
                                    className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2"
                                  >
                                    <Send size={16}/> Enviar por e-mail (mailto)
                                  </button>
                              </div>
                          )}

                          <details className="pt-2 border-t border-slate-100">
                            <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer py-2">
                              Avancado: gerar link de convite (legado)
                            </summary>
                            <div className="space-y-3 pt-2">
                              <p className="text-[11px] text-slate-500 font-semibold">
                                So use se precisar do fluxo antigo com link. O modo recomendado e criar com senha acima.
                              </p>
                              <button onClick={generateInviteLink} disabled={isGeneratingInvite} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                                  {isGeneratingInvite ? <Loader2 size={16} className="animate-spin"/> : <LinkIcon size={16}/>} 
                                  Gerar link de convite
                              </button>
                              {generatedLink && (
                                  <div className="space-y-2">
                                      {generatedLoginLink && (
                                        <input readOnly className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-mono outline-none" value={generatedLoginLink} />
                                      )}
                                      <div className="flex items-center gap-2">
                                          <input readOnly className="flex-1 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs font-mono outline-none" value={generatedLink} />
                                          <button onClick={copyInviteLink} className="p-3 bg-green-100 text-green-700 rounded-xl">{copied ? <Check size={18}/> : <Copy size={18}/>}</button>
                                      </div>
                                      <button onClick={openInviteEmail} className="w-full py-2 text-blue-600 font-bold text-xs uppercase">Enviar link por e-mail</button>
                                  </div>
                              )}
                            </div>
                          </details>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <ActionModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Excluir usuário?"
        description={`Remove ${userToDelete?.full_name || userToDelete?.email} desta empresa e apaga a conta de login para poder recriar limpo (e-mail + senha).`}
        type="danger"
        confirmText="Sim, excluir acesso e conta"
      />
    </div>
  );
};

export default Settings;
