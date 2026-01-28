
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Database } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Settings: React.FC = () => {
  const [saved, setSaved] = useState(false);
  
  // Exemplo de settings persistentes no banco (tabela 'saas_settings')
  // Se a tabela não existir, vai falhar silenciosamente e não persistir
  const [companyInfo, setCompanyInfo] = useState({
    company_name: 'AutoClaims Pro',
    cnpj: '',
    address: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('saas_settings').select('*').limit(1).single();
    if (data) {
        setCompanyInfo({
            company_name: data.company_name || '',
            cnpj: data.cnpj || '',
            address: data.address || ''
        });
    }
  };

  const handleSaveAll = async () => {
    const { error } = await supabase.from('saas_settings').upsert({
        id: 1, // Assumindo single tenant ou ID fixo para settings globais simples
        ...companyInfo,
        updated_at: new Date().toISOString()
    });

    if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    } else {
        alert('Erro ao salvar configurações. Verifique se a tabela saas_settings existe.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-20">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><SettingsIcon size={32}/></div>
           <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Governança</h2>
              <p className="text-sm text-slate-500 font-medium">Controle granular (Dados persistidos no DB).</p>
           </div>
        </div>
        <button onClick={handleSaveAll} className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-xl uppercase text-xs tracking-widest ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? <CheckCircle size={18}/> : <Save size={18} />} {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Razão Social</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none" 
                  value={companyInfo.company_name} onChange={e => setCompanyInfo({...companyInfo, company_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CNPJ</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none" 
                  value={companyInfo.cnpj} onChange={e => setCompanyInfo({...companyInfo, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Endereço</label>
                <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none h-24" 
                  value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} />
              </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3 text-blue-700 text-xs font-bold">
             <Database size={16}/> Estas configurações são salvas diretamente na tabela 'saas_settings' do Supabase.
          </div>
      </div>
    </div>
  );
};

export default Settings;
