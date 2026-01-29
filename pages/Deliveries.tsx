
import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle, AlertTriangle, Clock, Archive } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface DeliveryItem {
  id: string;
  po: string;
  supplier: string;
  items: number;
  date: string;
  event: string;
  status?: 'Pendente' | 'Conforme' | 'Divergente';
}

const Deliveries: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Aguardando' | 'Concluído'>('Aguardando');
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    setLoading(true);
    const { data } = await supabase.from('deliveries').select('*');
    setDeliveries(data || []);
    setLoading(false);
  };

  const handleProcessDelivery = async (id: string, newStatus: 'Conforme' | 'Divergente') => {
    const { error } = await supabase
        .from('deliveries')
        .update({ status: newStatus })
        .eq('id', id);
        
    if (!error) {
        setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    } else {
        alert('Erro ao processar entrega');
    }
  };

  const pendingDeliveries = deliveries.filter(d => d.status === 'Pendente' || !d.status);
  const historyDeliveries = deliveries.filter(d => d.status && d.status !== 'Pendente');

  if (loading) return <div className="text-center py-20 text-slate-400">Carregando entregas...</div>;

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
            Histórico ({historyDeliveries.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {activeTab === 'Aguardando' ? (
          pendingDeliveries.length > 0 ? pendingDeliveries.map(delivery => (
            <div key={delivery.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-blue-600">
                  <Truck size={24} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Previsão</span>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Clock size={12}/> {new Date(delivery.date).toLocaleDateString()}</p>
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
                <button 
                  onClick={() => handleProcessDelivery(delivery.id, 'Conforme')}
                  className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/10"
                >
                  <CheckCircle size={16} /> Conforme
                </button>
                <button 
                  onClick={() => handleProcessDelivery(delivery.id, 'Divergente')}
                  className="flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                >
                  <AlertTriangle size={16} /> Divergente
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-slate-300"/></div>
               <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Tudo entregue!</p>
            </div>
          )
        ) : (
          historyDeliveries.length > 0 ? historyDeliveries.map(delivery => (
             <div key={delivery.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 opacity-80 hover:opacity-100 transition-all">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-slate-800">{delivery.po}</h3>
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${delivery.status === 'Conforme' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {delivery.status}
                   </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 flex justify-between">
                   <span>{delivery.supplier}</span>
                   <span>{delivery.items} itens</span>
                </div>
             </div>
          )) : (
            <div className="col-span-full py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
               <Archive size={32} className="mx-auto text-slate-300 mb-4"/>
               <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Histórico vazio</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Deliveries;
