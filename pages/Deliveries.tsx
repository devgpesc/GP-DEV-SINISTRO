
import React, { useState } from 'react';
import { Truck, CheckCircle, AlertTriangle, Search, Filter, Camera, ClipboardList, Clock } from 'lucide-react';

const Deliveries: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Aguardando' | 'Concluído'>('Aguardando');

  const pendingDeliveries = [
    { id: '1', po: 'OC-2024-001', supplier: 'TAURO', items: 6, date: '15/05/2024', event: 'EVT-2024-001' },
    { id: '2', po: 'OC-2024-004', supplier: 'REA Peças', items: 2, date: '16/05/2024', event: 'EVT-2024-003' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Entregas</h2>
          <p className="text-sm text-slate-500 font-medium">Confirme recebimentos e registre conformidade para auditoria.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('Aguardando')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'Aguardando' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Aguardando ({pendingDeliveries.length})
          </button>
          <button 
            onClick={() => setActiveTab('Concluído')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'Concluído' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Histórico de Recebidos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingDeliveries.map(delivery => (
          <div key={delivery.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-blue-600">
                <Truck size={24} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Previsão</span>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Clock size={12}/> {delivery.date}</p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">{delivery.po}</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">Fornecedor: <span className="text-slate-800 font-bold">{delivery.supplier}</span></p>
            
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 mb-6 flex-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Protocolo</span>
                <span className="text-blue-600 font-bold">{delivery.event}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Volume</span>
                <span className="text-slate-700 font-bold">{delivery.items} itens</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/10">
                <CheckCircle size={16} /> Conforme
              </button>
              <button className="flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all">
                <AlertTriangle size={16} /> Divergente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Deliveries;
