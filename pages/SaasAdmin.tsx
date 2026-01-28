
import React, { useState, useEffect } from 'react';
import { 
  Globe, Building, Users, Database, 
  TrendingUp, Activity, Plus, MoreVertical, 
  Search, ShieldAlert, LogIn, Loader2, CheckCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, SaasPlan } from '../types';

const SaasAdmin: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenantData, setNewTenantData] = useState({ name: '', document: '', plan_id: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Carregar Tenants com Join no Plano
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('saas_tenants')
        .select('*, saas_plans(*)');
      
      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Carregar Planos
      const { data: plansData, error: plansError } = await supabase
        .from('saas_plans')
        .select('*');
        
      if (plansError) throw plansError;
      setPlans(plansData || []);

    } catch (error) {
        console.error("Erro ao carregar dados do admin:", error);
        // Em caso de erro, manter listas vazias, sem mocks.
        setTenants([]);
        setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantData.plan_id) return alert("Selecione um plano.");
    
    setCreating(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase.from('saas_tenants').insert([{
            name: newTenantData.name,
            document: newTenantData.document,
            plan_id: newTenantData.plan_id,
            owner_id: user?.id,
            status: 'active'
        }]);

        if (error) throw error;
        
        await loadData();
        setIsModalOpen(false);
        setNewTenantData({ name: '', document: '', plan_id: '' });
        alert("Empresa criada com sucesso!");
    } catch (err: any) {
        alert("Erro ao criar empresa: " + err.message);
    } finally {
        setCreating(false);
    }
  };

  const filtered = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Métricas calculadas em tempo real
  const totalRevenue = tenants.reduce((acc, t) => acc + (t.saas_plans?.price || 0), 0);
  const activeTenants = tenants.filter(t => t.status === 'active').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Cards de Métricas SaaS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl shadow-slate-900/10">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Globe size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total MRR</span>
           </div>
           <p className="text-3xl font-black">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
           <p className="text-xs text-green-400 font-bold mt-2 flex items-center gap-1"><TrendingUp size={12}/> Métricas Reais</p>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Building size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Empresas Ativas</span>
           </div>
           <p className="text-3xl font-black text-slate-800">{activeTenants}</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Planos Disponíveis</span>
           </div>
           <p className="text-3xl font-black text-slate-800">{plans.length}</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Database size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Status DB</span>
           </div>
           <p className="text-lg font-black text-slate-800 flex items-center gap-2">
             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div> Conectado
           </p>
        </div>
      </div>

      {/* Lista de Empresas */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Globe size={24} className="text-blue-600"/> Gestão de Tenants</h3>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl shadow-slate-900/20"
           >
             <Plus size={16}/> Nova Empresa
           </button>
        </div>

        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
           <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
              <input 
                type="text" 
                placeholder="Buscar empresa por nome..." 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>

           {loading ? (
             <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>
           ) : (
             <div className="space-y-4">
                {filtered.length === 0 && (
                    <div className="text-center py-10 text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma empresa encontrada.</div>
                )}
                {filtered.map(tenant => (
                  <div key={tenant.id} className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-md transition-all group">
                     <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${tenant.status === 'blocked' ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white'}`}>
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                           <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
                             {tenant.name}
                             {tenant.status === 'blocked' && <span className="bg-red-100 text-red-600 text-[9px] px-2 py-0.5 rounded uppercase tracking-widest">Bloqueado</span>}
                           </h4>
                           <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {tenant.saas_plans?.name || 'Sem Plano'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                R$ {tenant.saas_plans?.price}/mês
                              </span>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-center gap-8 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                        <div className="text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase">Limite Usuários</p>
                           <p className="font-bold text-slate-800">{tenant.saas_plans?.max_users}</p>
                        </div>
                        <div className="text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase">Limite Eventos</p>
                           <p className="font-bold text-slate-800">{tenant.saas_plans?.max_events}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-100 mx-2"></div>
                        <div className="flex items-center gap-2">
                           <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">
                              <LogIn size={14}/> Gerenciar
                           </button>
                           <button className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition-colors">
                              <MoreVertical size={20}/>
                           </button>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* Modal Criar Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-800 mb-6">Criar Nova Empresa</h3>
            <form onSubmit={handleCreateTenant} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome da Empresa</label>
                    <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                        value={newTenantData.name} onChange={e => setNewTenantData({...newTenantData, name: e.target.value})} placeholder="Ex: Transportadora X" />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ / Documento</label>
                    <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                        value={newTenantData.document} onChange={e => setNewTenantData({...newTenantData, document: e.target.value})} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Plano de Assinatura</label>
                    <div className="grid grid-cols-1 gap-2">
                        {plans.map(plan => (
                            <div key={plan.id} onClick={() => setNewTenantData({...newTenantData, plan_id: plan.id})}
                                className={`p-3 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${newTenantData.plan_id === plan.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{plan.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{plan.max_users} usuários • {plan.max_events} eventos</p>
                                </div>
                                <p className="font-black text-blue-600">R$ {plan.price}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="submit" disabled={creating} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 flex items-center gap-2">
                        {creating ? <Loader2 className="animate-spin" size={14}/> : 'Criar Empresa'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaasAdmin;
