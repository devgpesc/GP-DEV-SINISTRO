
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, Building, Users, Database, 
  TrendingUp, Activity, Plus, MoreVertical, 
  Search, ShieldAlert, LogIn, Loader2, CheckCircle, Mail, Lock, User, Copy, Check,
  Edit, Trash2, Layers, DollarSign, BarChart3, PieChart, CreditCard, Layout, Calendar, AlertCircle,
  LayoutGrid, List, Archive, Star, Zap, Link as LinkIcon
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js'; 
import { supabase } from '../services/supabaseClient';
import { SaasTenant, SaasPlan } from '../types';
import { useToast } from '../context/ToastContext';
import ActionModal from '../components/ActionModal';
import { useAuth } from '../context/AuthContext';

const SaasAdmin: React.FC = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  
  // Estado Geral
  const [activeTab, setActiveTab] = useState<'overview' | 'plans'>('overview');
  const [loading, setLoading] = useState(true);
  
  // Dados
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [planUsage, setPlanUsage] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Modals States
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  // New Credentials Modal
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, link: string} | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete States
  const [tenantToDelete, setTenantToDelete] = useState<SaasTenant | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SaasPlan | null>(null);
  
  // Verification State
  const [verifyState, setVerifyState] = useState({ loading: false, blocked: false, message: '' });
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingAdminData, setLoadingAdminData] = useState(false);

  // Form States (Tenant)
  const [editingTenant, setEditingTenant] = useState<SaasTenant | null>(null);
  const [tenantForm, setTenantForm] = useState({ 
      name: '', 
      document: '', 
      plan_id: '',
      status: 'active',
      adminName: '',
      adminEmail: '',
      adminPassword: ''
  });

  // Form States (Plan)
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [planForm, setPlanForm] = useState({
      name: '',
      price: 0,
      max_users: 5,
      max_events: 100,
      features: {
          ai_analysis: false,
          advanced_reports: false,
          financial_module: true,
          api_access: false,
          multi_branch: false
      } as any
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      const [tenantsRes, plansRes] = await Promise.all([
          supabase.from('saas_tenants').select('*, saas_plans(*)'),
          supabase.from('saas_plans').select('*').order('price', { ascending: true })
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (plansRes.error) throw plansRes.error;

      const tenantsData = tenantsRes.data || [];
      setTenants(tenantsData);
      setPlans(plansRes.data || []);

      const usage: Record<string, number> = {};
      tenantsData.forEach(t => {
          if (t.plan_id) {
              usage[t.plan_id] = (usage[t.plan_id] || 0) + 1;
          }
      });
      setPlanUsage(usage);

    } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        addToast('error', 'Erro', error.message);
    } finally {
      setLoading(false);
    }
  }

  // --- LÓGICA DE TENANTS ---
  const openNewTenantModal = () => {
      setEditingTenant(null);
      setTenantForm({ name: '', document: '', plan_id: '', status: 'active', adminName: '', adminEmail: '', adminPassword: '' });
      setIsTenantModalOpen(true);
  };

  const openEditTenantModal = async (tenant: SaasTenant) => {
      setEditingTenant(tenant);
      setIsTenantModalOpen(true);
      
      let adminName = '';
      let adminEmail = '';
      
      if (tenant.owner_id) {
          setLoadingAdminData(true);
          try {
              const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', tenant.owner_id).single();
              if (profile) {
                  adminName = profile.full_name || '';
                  adminEmail = profile.email || '';
              }
          } catch (e) { console.error(e); } finally { setLoadingAdminData(false); }
      }

      setTenantForm({
          name: tenant.name,
          document: tenant.document,
          plan_id: tenant.plan_id || '', // Garante string vazia para o value do input/select
          status: tenant.status,
          adminName: adminName, 
          adminEmail: adminEmail, 
          adminPassword: ''
      });
  };

  const handleRequestDelete = async (tenant: SaasTenant) => {
      setTenantToDelete(tenant);
      setVerifyState({ loading: true, blocked: false, message: 'Verificando dependências de dados...' });

      try {
          const [membersRes, eventsRes] = await Promise.all([
              supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
              supabase.from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
          ]);

          const count = (membersRes.count || 0) + (eventsRes.count || 0);

          if (count > 0) {
              setVerifyState({
                  loading: false,
                  blocked: true,
                  message: `Não é possível excluir. Esta empresa possui ${count} registros vinculados.`
              });
          } else {
              setVerifyState({
                  loading: false,
                  blocked: false,
                  message: 'Esta ação removerá permanentemente o acesso da empresa. Tem certeza?'
              });
          }
      } catch (err) {
          setVerifyState({ loading: false, blocked: true, message: 'Erro ao verificar integridade.' });
      }
  };

  const handleDeleteTenant = async () => {
      if (!tenantToDelete) return;
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('saas_tenants').delete().eq('id', tenantToDelete.id);
          if (error) throw error;
          setTenants(prev => prev.filter(t => t.id !== tenantToDelete.id));
          addToast('success', 'Sucesso', 'Empresa removida.');
          setTenantToDelete(null);
      } catch (error: any) {
          addToast('error', 'Erro', error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      
      // SANITIZAÇÃO CRÍTICA: Converter string vazia para NULL para campos UUID
      const planIdToSend = tenantForm.plan_id && tenantForm.plan_id.trim() !== '' ? tenantForm.plan_id : null;
      
      try {
          if (editingTenant) {
              // UPDATE
              const { error } = await supabase.from('saas_tenants').update({
                  name: tenantForm.name,
                  document: tenantForm.document,
                  plan_id: planIdToSend,
                  status: tenantForm.status
              }).eq('id', editingTenant.id);

              if (error) throw error;
              addToast('success', 'Atualizado', 'Dados da empresa atualizados.');
              setIsTenantModalOpen(false);
          } else {
              // CREATE NEW - ATTEMPT SERVER FUNCTION
              try {
                  const { data, error } = await supabase.functions.invoke('create-tenant', {
                      body: {
                          companyName: tenantForm.name,
                          document: tenantForm.document,
                          planId: planIdToSend,
                          adminName: tenantForm.adminName,
                          adminEmail: tenantForm.adminEmail,
                          adminPassword: tenantForm.adminPassword
                      }
                  });

                  if (error) throw error;
                  if (data && data.error) throw new Error(data.error);
                  
                  addToast('success', 'Criado', 'Empresa e administrador criados via Server.');
                  setIsTenantModalOpen(false);

              } catch (serverError: any) {
                  console.warn("Edge Function falhou, usando Fallback com Convite:", serverError);
                  
                  if (!user) throw new Error("Você precisa estar logado.");

                  // 1. Criar Tenant
                  const { data: tenant, error: dbError } = await supabase.from('saas_tenants').insert([{
                      name: tenantForm.name,
                      document: tenantForm.document,
                      plan_id: planIdToSend,
                      status: 'active',
                      owner_id: user.id 
                  }]).select().single();

                  if (dbError) throw dbError;

                  // 2. Criar Convite para o Admin (Já que não podemos criar o user diretamente aqui)
                  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                  const inviteLink = `${window.location.origin}/register?invite=${token}`;

                  await supabase.from('invitations').insert([{
                      tenant_id: tenant.id,
                      email: tenantForm.adminEmail,
                      name: tenantForm.adminName,
                      role: 'owner',
                      token: token,
                      created_by: user.id
                  }]);

                  // 3. Mostrar Modal com o Link
                  setCreatedCredentials({
                      email: tenantForm.adminEmail,
                      link: inviteLink
                  });
                  
                  setIsTenantModalOpen(false);
                  setShowCredentialsModal(true);
                  addToast('warning', 'Atenção', 'Servidor de email indisponível. Use o link gerado.');
              }
          }
          
          loadData();
      } catch (error: any) {
          console.error(error);
          addToast('error', 'Erro Crítico', error.message || 'Falha na operação.');
      } finally {
          setIsProcessing(false);
      }
  };

  const copyLink = () => {
      if (createdCredentials?.link) {
          navigator.clipboard.writeText(createdCredentials.link);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
          addToast('success', 'Copiado', 'Link copiado para área de transferência.');
      }
  };

  const openPlanModal = (plan?: SaasPlan) => {
      if (plan) {
          setEditingPlan(plan);
          setPlanForm({ name: plan.name, price: plan.price, max_users: plan.max_users, max_events: plan.max_events, features: { ai_analysis: false, advanced_reports: false, financial_module: false, api_access: false, multi_branch: false, ...plan.features } });
      } else {
          setEditingPlan(null);
          setPlanForm({ name: '', price: 0, max_users: 5, max_events: 100, features: { ai_analysis: false, advanced_reports: false, financial_module: true, api_access: false, multi_branch: false } });
      }
      setIsPlanModalOpen(true);
  };

  const checkPlanDeletion = (plan: SaasPlan) => {
      const usage = planUsage[plan.id] || 0;
      if (usage > 0) {
          addToast('warning', 'Ação Bloqueada', `Este plano possui ${usage} empresas ativas.`);
          return;
      }
      setPlanToDelete(plan);
  };

  const handleDeletePlan = async () => {
      if (!planToDelete) return;
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('saas_plans').delete().eq('id', planToDelete.id);
          if (error) throw error;
          setPlans(prev => prev.filter(p => p.id !== planToDelete.id));
          addToast('success', 'Plano Removido', 'Pacote excluído.');
          setPlanToDelete(null);
      } catch (err: any) {
          addToast('error', 'Erro', 'Falha ao excluir plano.');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const payload = {
              name: planForm.name,
              price: Number(planForm.price),
              max_users: Number(planForm.max_users),
              max_events: Number(planForm.max_events),
              features: planForm.features
          };

          if (editingPlan) {
              const { error } = await supabase.from('saas_plans').update(payload).eq('id', editingPlan.id);
              if (error) throw error;
              addToast('success', 'Plano Atualizado', 'Alterações salvas.');
          } else {
              const { error } = await supabase.from('saas_plans').insert([payload]);
              if (error) throw error;
              addToast('success', 'Plano Criado', 'Novo pacote disponível.');
          }
          setIsPlanModalOpen(false);
          loadData();
      } catch (err: any) {
          addToast('error', 'Erro', err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const toggleFeature = (key: string) => {
      setPlanForm(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  };

  const stats = useMemo(() => {
      const activeTenantsCount = tenants.filter(t => t.status === 'active').length;
      const totalRevenue = tenants.reduce((acc, t) => acc + (t.saas_plans?.price || 0), 0);
      const avgTicket = activeTenantsCount > 0 ? totalRevenue / activeTenantsCount : 0;
      const totalCapacity = tenants.reduce((acc, t) => acc + (t.saas_plans?.max_users || 0), 0);
      return { activeTenantsCount, totalRevenue, avgTicket, totalCapacity };
  }, [tenants]);

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const renderPlanFeatures = (features: any) => (
      <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-50">
          {features?.ai_analysis && <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600"><Zap size={12}/> IA Visionária</div>}
          {features?.financial_module && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><DollarSign size={12}/> Financeiro Completo</div>}
          {features?.advanced_reports && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><BarChart3 size={12}/> Relatórios BI</div>}
          {features?.api_access && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><Globe size={12}/> API de Integração</div>}
      </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-1">
          <div className="flex gap-8">
              <button onClick={() => setActiveTab('overview')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Visão Geral (Licenças)</button>
              <button onClick={() => setActiveTab('plans')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Planos de Venda</button>
          </div>
      </div>

      {activeTab === 'overview' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">MRR (Mensal)</p>
                    <p className="text-2xl font-black text-slate-800">R$ {stats.totalRevenue.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Clientes Ativos</p>
                    <p className="text-2xl font-black text-slate-800">{stats.activeTenantsCount}</p>
                </div>
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ticket Médio</p>
                    <p className="text-2xl font-black text-slate-800">R$ {stats.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assinaturas</p>
                    <p className="text-2xl font-black text-slate-800">{stats.totalCapacity}</p>
                </div>
            </div>

            {/* Lista de Empresas */}
            <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar empresa..." />
                    </div>
                    <button onClick={openNewTenantModal} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20">
                        <Plus size={16}/> Nova Empresa
                    </button>
                </div>

                {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div> : (
                    <div className="space-y-3">
                        {filteredTenants.map(tenant => (
                        <div key={tenant.id} onClick={() => openEditTenantModal(tenant)} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-lg shadow-sm ${tenant.status === 'blocked' ? 'bg-red-100 text-red-500' : 'bg-white text-blue-600 border border-slate-200'}`}>
                                    {tenant.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                                        {tenant.name}
                                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest border ${tenant.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{tenant.status}</span>
                                        {tenant.subscription_status === 'trial' && <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase font-bold border border-blue-200">Trial</span>}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">{tenant.document}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 flex-shrink-0">
                                <div className="w-32 text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plano</p>
                                    <p className="font-bold text-slate-700 text-sm truncate">{tenant.saas_plans?.name || '---'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); openEditTenantModal(tenant); }} className="p-2 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-xl transition-all shadow-sm"><Edit size={18}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleRequestDelete(tenant); }} className="p-2 bg-white text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl transition-all shadow-sm"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
      )}

      {/* activeTab === 'plans' content omitted for brevity as it remains unchanged */}
      {activeTab === 'plans' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Layers size={20} className="text-blue-600"/> Catálogo de Planos</h3>
                  <button onClick={() => openPlanModal()} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl">
                      <Plus size={16}/> Criar Plano
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map(plan => {
                      const usage = planUsage[plan.id] || 0;
                      return (
                          <div key={plan.id} className={`bg-white p-8 rounded-[40px] border shadow-sm transition-all group relative cursor-pointer flex flex-col ${usage > 0 ? 'border-blue-200 shadow-blue-100' : 'border-slate-200 hover:border-blue-200 hover:-translate-y-1 hover:shadow-xl'}`} onClick={() => openPlanModal(plan)}>
                              
                              {/* Header Card */}
                              <div className="flex justify-between items-start mb-6">
                                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">{plan.name}</span>
                                  {usage > 0 ? (
                                      <span className="flex items-center gap-1 text-[9px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full"><Users size={10}/> {usage} ativos</span>
                                  ) : (
                                      <span className="flex items-center gap-1 text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">Sem uso</span>
                                  )}
                              </div>
                              
                              {/* Pricing */}
                              <div className="mb-6">
                                  <span className="text-4xl font-black text-slate-800">R$ {plan.price}</span>
                                  <span className="text-slate-400 font-bold text-xs ml-1">/mês</span>
                              </div>

                              {/* Limits */}
                              <div className="space-y-3 pt-6 border-t border-slate-100 flex-1">
                                  <div className="flex items-center gap-3 text-sm font-bold text-slate-600"><Users size={16} className="text-blue-500"/> Até {plan.max_users} Usuários</div>
                                  <div className="flex items-center gap-3 text-sm font-bold text-slate-600"><Activity size={16} className="text-green-500"/> Até {plan.max_events} Eventos/mês</div>
                                  {renderPlanFeatures(plan.features)}
                              </div>

                              {/* Actions */}
                              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); openPlanModal(plan); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit size={16}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); checkPlanDeletion(plan); }} className={`p-2 bg-slate-50 rounded-xl transition-colors ${usage > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600'}`} disabled={usage > 0} title={usage > 0 ? "Plano em uso (não pode excluir)" : "Excluir Plano"}>
                                      {usage > 0 ? <Archive size={16}/> : <Trash2 size={16}/>}
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* Modal Tenant */}
      {isTenantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsTenantModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-slate-800 mb-6">{editingTenant ? 'Editar Empresa' : 'Criar Nova Empresa'}</h3>
            <form onSubmit={handleSaveTenant} className="space-y-6">
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2 flex items-center gap-2"><Building size={14}/> Dados da Empresa</h4>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome da Empresa</label>
                        <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                            value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} placeholder="Ex: Transportadora X" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ / Documento</label>
                        <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                            value={tenantForm.document} onChange={e => setTenantForm({...tenantForm, document: e.target.value})} placeholder="00.000.000/0001-00" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Status</label>
                        <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                            value={tenantForm.status} onChange={e => setTenantForm({...tenantForm, status: e.target.value as any})}>
                            <option value="active">Ativo</option>
                            <option value="blocked">Bloqueado</option>
                            <option value="suspended">Suspenso</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Plano de Assinatura</label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {plans.map(plan => (
                                <div key={plan.id} onClick={() => setTenantForm({...tenantForm, plan_id: plan.id})}
                                    className={`p-3 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${tenantForm.plan_id === plan.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{plan.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400">{plan.max_users} usuários</p>
                                    </div>
                                    <p className="font-black text-blue-600">R$ {plan.price}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2 flex items-center gap-2">
                        <User size={14}/> 
                        {editingTenant ? 'Administrador da Conta' : 'Administrador Inicial'}
                        {loadingAdminData && <Loader2 size={12} className="animate-spin ml-2"/>}
                    </h4>
                    
                    <div className={`transition-opacity ${loadingAdminData ? 'opacity-50' : 'opacity-100'}`}>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome Completo</label>
                            <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                value={tenantForm.adminName} onChange={e => setTenantForm({...tenantForm, adminName: e.target.value})} placeholder="Ex: João Admin" />
                        </div>
                        <div className="mt-4">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail de Acesso</label>
                            <input required type="email" disabled={!!editingTenant} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none disabled:opacity-60 disabled:bg-slate-100" 
                                value={tenantForm.adminEmail} onChange={e => setTenantForm({...tenantForm, adminEmail: e.target.value})} placeholder="admin@empresa.com" />
                            {editingTenant && <p className="text-[9px] text-slate-400 mt-1 pl-1 flex items-center gap-1"><AlertCircle size={10}/> Para alterar o e-mail, utilize a gestão de usuários.</p>}
                        </div>
                        {!editingTenant && (
                            <div className="mt-4">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Senha Provisória</label>
                                <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                    value={tenantForm.adminPassword} onChange={e => setTenantForm({...tenantForm, adminPassword: e.target.value})} placeholder="Defina uma senha" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setIsTenantModalOpen(false)} disabled={isProcessing} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="submit" disabled={isProcessing} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 flex items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" size={14}/> : (editingTenant ? 'Salvar Alterações' : 'Criar Empresa & Admin')}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
      
      {/* SUCCESS MODAL FOR CREDENTIALS (NEW) */}
      {showCredentialsModal && createdCredentials && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowCredentialsModal(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in zoom-in duration-300 text-center">
                  <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                      <CheckCircle size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Empresa Criada!</h3>
                  <p className="text-sm text-slate-500 font-medium mb-6">
                      Devido a uma limitação temporária no servidor de e-mail, o usuário administrador precisa ser ativado manualmente.
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Link de Ativação (Convite)</p>
                      <div className="flex gap-2">
                          <input readOnly className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-600 outline-none" value={createdCredentials.link}/>
                          <button onClick={copyLink} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                              {copiedLink ? <Check size={16}/> : <Copy size={16}/>}
                          </button>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-2 font-bold flex items-center gap-1">
                          <AlertCircle size={10}/> Envie este link para o cliente definir a senha.
                      </p>
                  </div>

                  <button onClick={() => setShowCredentialsModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">
                      Entendi, Concluir
                  </button>
              </div>
          </div>
      )}

      {/* Modal Plano Avançado */}
      {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsPlanModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-2xl font-black text-slate-800 mb-6">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
                  <form onSubmit={handleSavePlan} className="space-y-6">
                      <div className="space-y-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome Comercial</label>
                              <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                  value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} placeholder="Ex: Premium Enterprise" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Preço (R$)</label>
                                  <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                      value={planForm.price} onChange={e => setPlanForm({...planForm, price: Number(e.target.value)})} />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Usuários</label>
                                  <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                      value={planForm.max_users} onChange={e => setPlanForm({...planForm, max_users: Number(e.target.value)})} />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Eventos Mensais</label>
                              <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                  value={planForm.max_events} onChange={e => setPlanForm({...planForm, max_events: Number(e.target.value)})} />
                          </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Funcionalidades (Features)</label>
                          <div className="space-y-2">
                              {[
                                  { id: 'ai_analysis', label: 'Inteligência Artificial (IA)', icon: Zap, color: 'indigo' },
                                  { id: 'financial_module', label: 'Módulo Financeiro & OCs', icon: DollarSign, color: 'green' },
                                  { id: 'advanced_reports', label: 'Relatórios Estratégicos', icon: BarChart3, color: 'blue' },
                                  { id: 'api_access', label: 'Acesso via API', icon: Globe, color: 'purple' },
                                  { id: 'multi_branch', label: 'Multi-Filiais', icon: Building, color: 'amber' }
                              ].map(feat => (
                                  <div key={feat.id} onClick={() => toggleFeature(feat.id)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${planForm.features[feat.id] ? `border-${feat.color}-500 bg-${feat.color}-50` : 'border-slate-100 hover:border-slate-300'}`}>
                                      <div className="flex items-center gap-3">
                                          <div className={`p-1.5 rounded-lg ${planForm.features[feat.id] ? `bg-${feat.color}-200 text-${feat.color}-700` : 'bg-slate-200 text-slate-400'}`}>
                                              <feat.icon size={14}/>
                                          </div>
                                          <span className={`text-xs font-bold ${planForm.features[feat.id] ? `text-${feat.color}-900` : 'text-slate-500'}`}>{feat.label}</span>
                                      </div>
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${planForm.features[feat.id] ? `bg-${feat.color}-600 border-${feat.color}-600` : 'border-slate-300'}`}>
                                          {planForm.features[feat.id] && <Check size={12} className="text-white"/>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <button type="button" onClick={() => setIsPlanModalOpen(false)} disabled={isProcessing} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                          <button type="submit" disabled={isProcessing} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2">
                              {isProcessing ? <Loader2 className="animate-spin" size={14}/> : 'Salvar Definições'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Confirmação de Exclusão de Plano */}
      <ActionModal 
        isOpen={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={handleDeletePlan}
        title="Excluir Plano?"
        description="Esta ação é irreversível. O plano não aparecerá mais para novas empresas."
        type="danger"
        confirmText="Sim, Excluir Plano"
      />

      {/* Confirmação de Exclusão de Tenant */}
      <ActionModal 
        isOpen={!!tenantToDelete}
        onClose={() => setTenantToDelete(null)}
        onConfirm={verifyState.blocked ? () => setTenantToDelete(null) : handleDeleteTenant}
        title={verifyState.loading ? 'Verificando...' : (verifyState.blocked ? 'Ação Bloqueada' : 'Excluir Empresa?')}
        description={verifyState.message}
        type={verifyState.blocked ? 'warning' : 'danger'}
        confirmText={verifyState.loading ? '...' : (verifyState.blocked ? 'Entendi' : 'Sim, Excluir')}
        showCancel={!verifyState.blocked && !verifyState.loading}
      />
    </div>
  );
};

export default SaasAdmin;
