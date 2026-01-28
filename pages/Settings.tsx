
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database, Bell, Shield, Globe, Mail, User, Building } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'AutoClaims Pro',
    cnpj: '',
    address: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('saas_settings').select('*').limit(1).single();
    if (data) {
        setCompanyInfo({
            company_name: data.company_name || 'AutoClaims Pro',
            cnpj: data.cnpj || '',
            address: data.address || '',
            email: data.email || '',
            phone: data.phone || ''
        });
    }
    setLoading(false);
  };

  const handleSaveAll = async () => {
    const { error } = await supabase.from('saas_settings').upsert({
        id: 1, 
        ...companyInfo,
        updated_at: new Date().toISOString()
    });

    if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    } else {
        // Fallback visual error
        console.error(error);
    }
  };

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'integrations', label: 'Integrações', icon: Globe },
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
            className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {saved ? <CheckCircle size={18}/> : <Save size={18} />} {saved ? 'Salvo!' : 'Salvar Alterações'}
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
                              <p className="text-xs text-slate-400 font-medium">Informações visíveis em relatórios e OCs.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3 text-blue-700 text-xs font-bold">
                         <Database size={16}/> Configurações salvas em nuvem (Supabase).
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

              {activeTab === 'integrations' && (
                  <div className="text-center py-20 animate-in fade-in slide-in-from-right-4 duration-300">
                      <Globe size={48} className="mx-auto text-slate-200 mb-4"/>
                      <h3 className="text-lg font-black text-slate-800">Integrações API</h3>
                      <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">Conecte-se com fornecedores de dados externos como APIBrasil e Detran.</p>
                      <button className="mt-6 px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">
                          Configurar Chaves
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Settings;
