
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, ChevronRight, ArrowLeft, Send, CheckCircle, 
  FileText, Package, Users, BarChart3, Clock, Trash2, Settings,
  Zap, Mail, MessageCircle, FileDown, Rocket, LayoutGrid, List
} from 'lucide-react';
import { MOCK_SUPPLIERS, MOCK_EVENTS } from '../constants';
import MatrixTable from '../components/MatrixTable';
import { mockStorage } from '../services/supabaseClient';
import { Event } from '../types';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardStep, setWizardStep] = useState(1);
  const [realEvents, setRealEvents] = useState<Event[]>([]);
  
  const [newQuote, setNewQuote] = useState({
    eventId: '',
    items: [] as string[],
    suppliers: [] as string[],
    sendMode: 'auto' as 'auto' | 'manual'
  });

  useEffect(() => {
    const saved = mockStorage.get('events') || MOCK_EVENTS;
    setRealEvents(saved);
  }, []);

  const mockQuotes = [
    { id: '1', code: 'COT-2024-0001', eventRef: 'EVT-2024-001', status: 'Em Aberto', date: 'Há 2 dias', suppliers: 3 },
    { id: '2', code: 'COT-2024-0002', eventRef: 'EVT-2024-001', status: 'Finalizada', date: 'Há 2 dias', suppliers: 3 },
  ];

  const catalogMock = [
    { id: '1', name: 'Parachoque Dianteiro Corolla', type: 'Peça' },
    { id: '2', name: 'Mão de Obra Funilaria', type: 'Serviço' },
    { id: '3', name: 'Farol LED Direito', type: 'Peça' },
    { id: '4', name: 'Radiador de Água', type: 'Peça' },
  ];

  const toggleItem = (id: string) => {
    setNewQuote(prev => ({
      ...prev,
      items: prev.items.includes(id) ? prev.items.filter(i => i !== id) : [...prev.items, id]
    }));
  };

  const toggleSupplier = (id: string) => {
    setNewQuote(prev => ({
      ...prev,
      suppliers: prev.suppliers.includes(id) ? prev.suppliers.filter(i => i !== id) : [...prev.suppliers, id]
    }));
  };

  const renderList = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Buscar cotações..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium" />
        </div>
        <button onClick={() => { setStep(2); setWizardStep(1); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20">
          <Plus size={20} /> Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockQuotes.map(quote => (
          <div key={quote.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer" onClick={() => setStep(3)}>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 text-blue-600 p-4 rounded-3xl shadow-sm"><BarChart3 size={28} /></div>
              <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border bg-amber-50 text-amber-600 border-amber-100">{quote.status}</span>
            </div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">{quote.code}</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Ref: {quote.eventRef}</p>
            <div className="flex justify-between items-center pt-6 border-t border-slate-50">
               <div className="flex -space-x-3">
                  {[1,2,3].map(j => <div key={j} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black">S{j}</div>)}
               </div>
               <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">Analisar <ChevronRight size={18} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWizard = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="flex items-center gap-6">
        <button onClick={() => setStep(1)} className="p-4 bg-white border border-slate-200 rounded-3xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><ArrowLeft size={24}/></button>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Configurar RFQ</h2>
          <p className="text-sm text-slate-500 font-medium">Inicie uma nova rodada de preços para um sinistro.</p>
        </div>
      </div>

      {wizardStep === 1 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Selecione o Sinistro (Eventos Reais)</label>
            <select 
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 font-black text-slate-800"
              value={newQuote.eventId}
              onChange={(e) => setNewQuote({...newQuote, eventId: e.target.value})}
            >
              <option value="">Selecione o Protocolo...</option>
              {realEvents.map(e => <option key={e.id} value={e.id}>{e.protocol} | {e.category} ({e.status})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Itens Necessários ({newQuote.items.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalogMock.map(item => (
                <div key={item.id} onClick={() => toggleItem(item.id)} className={`p-5 rounded-[32px] border-2 cursor-pointer flex items-center justify-between ${newQuote.items.includes(item.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                  <p className="text-sm font-black text-slate-800">{item.name}</p>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${newQuote.items.includes(item.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}><CheckCircle size={16} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t border-slate-50">
            <button disabled={!newQuote.eventId || newQuote.items.length === 0} onClick={() => setWizardStep(2)} className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 disabled:opacity-20 flex items-center gap-3">Próximo Passo <ChevronRight size={18}/></button>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Parceiros para Cotação ({newQuote.suppliers.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {MOCK_SUPPLIERS.map(s => (
                <div key={s.id} onClick={() => toggleSupplier(s.id)} className={`p-6 rounded-[32px] border-2 cursor-pointer flex items-center gap-5 ${newQuote.suppliers.includes(s.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl ${newQuote.suppliers.includes(s.id) ? 'bg-blue-600' : 'bg-slate-300'}`}>{s.name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800 text-sm">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase">{s.segment}</p>
                  </div>
                  {newQuote.suppliers.includes(s.id) && <CheckCircle size={24} className="text-blue-600" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between pt-6 border-t border-slate-50">
            <button onClick={() => setWizardStep(1)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px]">Voltar</button>
            <button disabled={newQuote.suppliers.length === 0} onClick={() => setStep(3)} className="px-16 py-6 bg-blue-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/40 flex items-center gap-4">Finalizar e Gerar Matriz <Rocket size={20}/></button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {step === 1 && renderList()}
      {step === 2 && renderWizard()}
      {step === 3 && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center gap-6">
              <button onClick={() => setStep(1)} className="p-4 bg-white border border-slate-200 rounded-3xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><ArrowLeft size={24}/></button>
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Análise Comparativa</h2>
                <p className="text-sm text-slate-500 font-medium">Comparação inteligente de preços por item.</p>
              </div>
           </div>
           <MatrixTable />
        </div>
      )}
    </div>
  );
};

export default Quotations;
