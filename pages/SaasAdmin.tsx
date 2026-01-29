
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, Building, Users, Database, 
  TrendingUp, Activity, Plus, MoreVertical, 
  Search, ShieldAlert, LogIn, Loader2, CheckCircle, Mail, Lock, User, Copy, Check,
  Edit, Trash2, Layers, DollarSign, BarChart3, PieChart, CreditCard, Layout
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, SaasPlan } from '../types';
import { useToast } from '../context/ToastContext';

const SaasAdmin: React.FC = () => {
  const { addToast } = useToast();
  
  // Estado Geral
  const [activeTab, setActiveTab] = useState<'overview' | 'plans'>('overview');
  const [loading, setLoading] = useState(true);
  
  // Dados
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals States
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Form States (Tenant)
  const [editingTenant, setEditingTenant] = useState<SaasTenant | null>(null);
  const [tenantForm, setTenantForm] = useState({ 
      name: '', 
      document: '', 
      plan_id: '',
      status: 'active',
      // Admin fields (only for creation)
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
      features: {}
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Carrega Tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('saas_tenants')
        .select('*, saas_plans(*)');
      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Carrega Planos
      const { data: plansData, error: plansError } = await supabase.from('saas_plans').select('*').order('price', { ascending: true });
      if (plansError) throw plansError;
      setPlans(plansData || []);

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

  const openEditTenantModal = (tenant: SaasTenant) => {
      setEditingTenant(tenant);
      setTenantForm({
          name: tenant.name,
          document: tenant.document,
          plan_id: tenant.plan_id,
          status: tenant.status,
          adminName: '', adminEmail: '', adminPassword: '' // Não edita admin aqui
      });
      setIsTenantModalOpen(true);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantForm.plan_id) return addToast('warning', 'Atenção', "Selecione um plano.");
    
    setIsProcessing(true);
    try {
        if (editingTenant) {
            // EDITAR (Update direto no banco)
            const { error } = await supabase
                .from('saas_tenants')
                .update({
                    name: tenantForm.name,
                    document: tenantForm.document,
                    plan_id: tenantForm.plan_id,
                    status: tenantForm.status
                })
                .eq('id', editingTenant.id);

            if (error) throw error;
            addToast('success', 'Atualizado', 'Dados da empresa atualizados.');
            setIsTenantModalOpen(false);
            loadData();

        } else {
            // CRIAR (Via Edge Function para criar User + Tenant)
            if (tenantForm.adminPassword.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");

            const { data, error } = await supabase.functions.invoke('create-tenant', {
                body: {
                    companyName: tenantForm.name,
                    document: tenantForm.document,
                    planId: tenantForm.plan_id,
                    adminName: tenantForm.adminName,
                    adminEmail: tenantForm.adminEmail,
                    adminPassword: tenantForm.adminPassword
                }
            });

            if (error) throw new Error(error.message || 'Erro ao conectar com servidor.');
            if (data?.error) throw new Error(data.error);

            setCreatedCredentials({
                company: tenantForm.name,
                email: tenantForm.adminEmail,
                password: tenantForm.adminPassword
            });
            
            setIsTenantModalOpen(false);
            setShowSuccessModal(true);
            loadData();
        }
    } catch (err: any) {
        addToast('error', 'Erro', err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LÓGICA DE PLANOS ---

  const openPlanModal = (plan?: SaasPlan) => {
      if (plan) {
          setEditingPlan(plan);
          setPlanForm({
              name: plan.name,
              price: plan.price,
              max_users: plan.max_users,
              max_events: plan.max_events,
              features: plan.features || {}
          });
      } else {
          setEditingPlan(null);
          setPlanForm({ name: '', price: 0, max_users: 5, max_events: 100, features: {} });
      }
      setIsPlanModalOpen(true);
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
              addToast('success', 'Sucesso', 'Plano atualizado.');
          } else {
              const { error } = await supabase.from('saas_plans').insert([payload]);
              if (error) throw error;
              addToast('success', 'Sucesso', 'Novo plano criado.');
          }
          
          setIsPlanModalOpen(false);
          loadData();
      } catch (err: any) {
          addToast('error', 'Erro', err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- ESTATÍSTICAS ---
  const stats = useMemo(() => {
      const activeTenantsCount = tenants.filter(t => t.status === 'active').length;
      const totalRevenue = tenants.reduce((acc, t) => acc + (t.saas_plans?.price || 0), 0);
      const avgTicket = activeTenantsCount > 0 ? totalRevenue / activeTenantsCount : 0;
      const totalCapacity = tenants.reduce((acc, t) => acc + (t.saas_plans?.max_users || 0), 0);

      return { activeTenantsCount, totalRevenue, avgTicket, totalCapacity };
  }, [tenants]);

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const copyToClipboard = () => {
      const text = `Acesso AutoClaims Pro\nEmpresa: ${createdCredentials.company}\nLogin: ${createdCredentials.email}\nSenha: ${createdCredentials.password}\nLink: ${window.location.origin}/login`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('success', 'Copiado', 'Credenciais copiadas.');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header com Abas */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-1">
          <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('overview')} 
                className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  Visão Geral
              </button>
              <button 
                onClick={() => setActiveTab('plans')} 
                className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  Gestão de Planos
              </button>
          </div>
      </div>

      {activeTab === 'overview' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            {/* KPI Cards Expandidos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl shadow-slate-900/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/10 rounded-xl"><Globe size={20}/></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total MRR</span>
                    </div>
                    <p className="text-3xl font-black">R$ {stats.totalRevenue.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-green-400 font-bold mt-2 flex items-center gap-1"><TrendingUp size={12}/> Métricas Reais</p>
                </div>
                
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Building size={20}/></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Empresas Ativas</span>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{stats.activeTenantsCount}</p>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl"><DollarSign size={20}/></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ticket Médio</span>
                    </div>
                    <p className="text-3xl font-black text-slate-800">R$ {stats.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Users size={20}/></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Capacidade Usuários</span>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{stats.totalCapacity}</p>
                </div>
            </div>

            {/* Lista de Empresas */}
            <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            type="text" 
                            placeholder="Buscar empresa..." 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={openNewTenantModal} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20">
                        <Plus size={16}/> Nova Empresa
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>
                ) : (
                    <div className="space-y-3">
                        {filteredTenants.map(tenant => (
                        <div key={tenant.id} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-md transition-all group">
                            <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${tenant.status === 'blocked' ? 'bg-red-100 text-red-500' : 'bg-white text-blue-600 border border-slate-200'}`}>
                                    {tenant.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                                        {tenant.name}
                                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest border ${tenant.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                            {tenant.status === 'active' ? 'Ativo' : 'Bloqueado'}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">{tenant.document}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</p>
                                    <p className="font-bold text-slate-700 text-sm">{tenant.saas_plans?.name || '---'}</p>
                                </div>
                                <div className="text-right w-24">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</p>
                                    <p className="font-black text-slate-800 text-sm">R$ {tenant.saas_plans?.price}/mês</p>
                                </div>
                                <button onClick={() => openEditTenantModal(tenant)} className="p-2 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-xl transition-all shadow-sm">
                                    <Edit size={18}/>
                                </button>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
      )}

      {activeTab === 'plans' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Layers size={20} className="text-blue-600"/> Planos de Assinatura</h3>
                  <button onClick={() => openPlanModal()} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl">
                      <Plus size={16}/> Novo Plano
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map(plan => (
                      <div key={plan.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all group relative">
                          <div className="flex justify-between items-start mb-6">
                              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                  {plan.name}
                              </span>
                              <button onClick={() => openPlanModal(plan)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors">
                                  <Edit size={16}/>
                              </button>
                          </div>
                          
                          <div className="mb-6">
                              <span className="text-4xl font-black text-slate-800">R$ {plan.price}</span>
                              <span className="text-slate-400 font-bold text-xs ml-1">/mês</span>
                          </div>

                          <div className="space-y-3 pt-6 border-t border-slate-100">
                              <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                  <Users size={16} className="text-blue-500"/>
                                  Até {plan.max_users} Usuários
                              </div>
                              <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                  <Activity size={16} className="text-green-500"/>
                                  Até {plan.max_events} Eventos/mês
                              </div>
                              <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                  <Database size={16} className="text-amber-500"/>
                                  Suporte Prioritário
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Modal Tenant (Criar/Editar) */}
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

                {!editingTenant && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2 flex items-center gap-2"><User size={14}/> Administrador Inicial</h4>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome Completo</label>
                            <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                value={tenantForm.adminName} onChange={e => setTenantForm({...tenantForm, adminName: e.target.value})} placeholder="Ex: João Admin" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail de Acesso</label>
                            <input required type="email" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                value={tenantForm.adminEmail} onChange={e => setTenantForm({...tenantForm, adminEmail: e.target.value})} placeholder="admin@empresa.com" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Senha Provisória</label>
                            <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                value={tenantForm.adminPassword} onChange={e => setTenantForm({...tenantForm, adminPassword: e.target.value})} placeholder="Defina uma senha" />
                        </div>
                    </div>
                )}

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

      {/* Modal Plano (Criar/Editar) */}
      {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsPlanModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
                  <h3 className="text-2xl font-black text-slate-800 mb-6">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
                  <form onSubmit={handleSavePlan} className="space-y-5">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome do Plano</label>
                          <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                              value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} placeholder="Ex: Premium" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Preço (R$)</label>
                              <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                  value={planForm.price} onChange={e => setPlanForm({...planForm, price: Number(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Max Usuários</label>
                              <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                                  value={planForm.max_users} onChange={e => setPlanForm({...planForm, max_users: Number(e.target.value)})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Limite Eventos/Mês</label>
                          <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                              value={planForm.max_events} onChange={e => setPlanForm({...planForm, max_events: Number(e.target.value)})} />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsPlanModalOpen(false)} disabled={isProcessing} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                          <button type="submit" disabled={isProcessing} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2">
                              {isProcessing ? <Loader2 className="animate-spin" size={14}/> : 'Salvar Plano'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Modal Sucesso */}
      {showSuccessModal && createdCredentials && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
              <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300 text-center">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                      <CheckCircle size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Empresa Criada!</h3>
                  <p className="text-sm text-slate-500 mb-8 font-medium">
                      O ambiente para <strong>{createdCredentials.company}</strong> foi configurado e o usuário admin criado.
                  </p>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-left mb-6 relative group">
                      <button onClick={copyToClipboard} className="absolute top-4 right-4 text-slate-400 hover:text-blue-600 transition-colors">
                          {copied ? <Check size={18}/> : <Copy size={18}/>}
                      </button>
                      <div className="space-y-3">
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Login</p>
                              <p className="font-bold text-slate-800">{createdCredentials.email}</p>
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</p>
                              <p className="font-bold text-slate-800 font-mono">{createdCredentials.password}</p>
                          </div>
                      </div>
                  </div>

                  <button onClick={() => setShowSuccessModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-xl transition-all">
                      Fechar
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default SaasAdmin;
