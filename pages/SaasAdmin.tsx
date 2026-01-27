
import React, { useState } from 'react';
import { 
  Globe, Building, Users, Database, 
  TrendingUp, Activity, Plus, MoreVertical, 
  Search, ShieldAlert, LogIn
} from 'lucide-react';

const SaasAdmin: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock de empresas no sistema SaaS
  const tenants = [
    { id: 1, name: 'Transportadora Global', plan: 'Enterprise', users: 45, events: 1250, status: 'active', revenue: 'R$ 12.500/mês' },
    { id: 2, name: 'Seguradora Confiança', plan: 'Business', users: 12, events: 340, status: 'active', revenue: 'R$ 4.800/mês' },
    { id: 3, name: 'Auto Center Premium', plan: 'Starter', users: 3, events: 58, status: 'blocked', revenue: 'R$ 890/mês' },
    { id: 4, name: 'Logística Express', plan: 'Business', users: 8, events: 110, status: 'active', revenue: 'R$ 4.800/mês' },
  ];

  const filtered = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Cards de Métricas SaaS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl shadow-slate-900/10">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Globe size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total MRR</span>
           </div>
           <p className="text-3xl font-black">R$ 22.990</p>
           <p className="text-xs text-green-400 font-bold mt-2 flex items-center gap-1"><TrendingUp size={12}/> +15% vs mês anterior</p>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Building size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Empresas Ativas</span>
           </div>
           <p className="text-3xl font-black text-slate-800">142</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Usuários</span>
           </div>
           <p className="text-3xl font-black text-slate-800">856</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Database size={20}/></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Storage Global</span>
           </div>
           <p className="text-3xl font-black text-slate-800">4.2 TB</p>
        </div>
      </div>

      {/* Lista de Empresas */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Globe size={24} className="text-blue-600"/> Gestão de Tenants</h3>
           <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl shadow-slate-900/20">
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

           <div className="space-y-4">
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
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{tenant.plan}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tenant.revenue}</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center gap-8 w-full md:w-auto mt-4 md:mt-0 justify-between md:justify-end">
                      <div className="text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase">Usuários</p>
                         <p className="font-bold text-slate-800">{tenant.users}</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase">Eventos</p>
                         <p className="font-bold text-slate-800">{tenant.events}</p>
                      </div>
                      <div className="h-8 w-px bg-slate-100 mx-2"></div>
                      <div className="flex items-center gap-2">
                         <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">
                            <LogIn size={14}/> Acessar
                         </button>
                         <button className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition-colors">
                            <MoreVertical size={20}/>
                         </button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default SaasAdmin;
