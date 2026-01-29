import React, { useState, useEffect } from 'react';
import { 
  Globe, Building, TrendingUp, Plus, Search, 
  Loader2, CheckCircle, Mail, Lock, User, Copy, Check
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { SaasTenant, SaasPlan } from '../types';
import { useToast } from '../context/ToastContext';

const SaasAdmin: React.FC = () => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [newTenantData, setNewTenantData] = useState({ 
    name: '', 
    document: '', 
    plan_id: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });

  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: tenantsData, error: tenantsError } = await supabase
        .from('saas_tenants')
        .select('*, saas_plans(*)')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      const { data: plansData, error: plansError } = await supabase
        .from('saas_plans')
        .select('*');

      if (plansError) throw plansError;
      setPlans(plansData || []);

    } catch (error) {
      console.error("Erro ao carregar dados do admin:", error);
      addToast('error', 'Erro', 'Erro ao carregar dados do painel SaaS');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTenantData.plan_id) 
      return addToast('warning', 'Atenção', "Selecione um plano.");

    if (newTenantData.adminPassword.length < 6) 
      return addToast('warning', 'Senha fraca', "A senha deve ter no mínimo 6 caracteres.");

    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: {
          company: {
            name: newTenantData.name,
            document: newTenantData.document,
            plan_id: newTenantData.plan_id
          },
          admin: {
            name: newTenantData.adminName,
            email: newTenantData.adminEmail,
            password: newTenantData.adminPassword
          }
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      setCreatedCredentials({
        company: newTenantData.name,
        email: newTenantData.adminEmail,
        password: newTenantData.adminPassword
      });

      await loadData();
      setIsModalOpen(false);
      setShowSuccessModal(true);

      setNewTenantData({ 
        name: '', document: '', plan_id: '', 
        adminName: '', adminEmail: '', adminPassword: '' 
      });

      addToast('success', 'Sucesso', 'Empresa e administrador criados.');

    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro ao criar empresa', err.message || 'Falha no servidor');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = () => {
    const text = 
`Acesso AutoClaims Pro
Empresa: ${createdCredentials.company}
Login: ${createdCredentials.email}
Senha: ${createdCredentials.password}
Link: ${window.location.origin}/login`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('success', 'Copiado', 'Credenciais copiadas.');
  };

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = tenants.reduce(
    (acc, t) => acc + (t.saas_plans?.price || 0), 0
  );

  const activeTenants = tenants.filter(t => t.status === 'active').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-xl"><Globe size={20}/></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Total MRR
            </span>
          </div>
          <p className="text-3xl font-black">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-green-400 font-bold mt-2 flex items-center gap-1">
            <TrendingUp size={12}/> Receita ativa
          </p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Building size={20}/></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Empresas Ativas
            </span>
          </div>
          <p className="text-3xl font-black text-slate-800">{activeTenants}</p>
        </div>
      </div>

      {/* GESTÃO */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Globe size={24} className="text-blue-600"/> Gestão de Tenants
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <Plus size={16}/> Nova Empresa
        </button>
      </div>

      {/* BUSCA */}
      <div className="bg-white p-6 rounded-[40px] shadow-sm border">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
          <input 
            placeholder="Buscar empresa..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={40}/>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(tenant => (
              <div key={tenant.id} className="p-6 border rounded-3xl">
                <h4 className="font-black text-slate-800 text-lg">{tenant.name}</h4>
                <p className="text-xs text-slate-400">
                  {tenant.saas_plans?.name} • R$ {tenant.saas_plans?.price}/mês
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔔 Modais mantidos (criação + sucesso) — não alterei layout */}

      {/* ... (seus modais continuam iguais, não mexi neles) ... */}

    </div>
  );
};

export default SaasAdmin;
