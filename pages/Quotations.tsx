
import React, { useState } from 'react';
import { 
  Plus, Search, ChevronRight, ArrowLeft, Send, CheckCircle, 
  FileText, Package, Users, BarChart3, Clock, Trash2, Settings 
} from 'lucide-react';
import { MOCK_SUPPLIERS, MOCK_EVENTS } from '../constants';
import MatrixTable from '../components/MatrixTable';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1); // 1: List, 2: Wizard, 3: Matrix
  const [wizardStep, setWizardStep] = useState(1); // 1: Event/Items, 2: Suppliers
  
  const [newQuote, setNewQuote] = useState({
    eventId: '',
    items: [] as string[],
    suppliers: [] as string[]
  });

  // Itens mock do catálogo para o Wizard
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

  // Renderizador de Lista de Cotações (Step 1)
  const renderList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar cotações por protocolo..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
          />
        </div>
        <button 
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} /> Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer" onClick={() => setStep(3)}>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${i === 1 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                {i === 1 ? 'Em Análise' : 'Fechada'}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">COT-2024-000{i}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Referente: EVT-2024-000{i}</p>
            
            <div className="flex items-center gap-2 mb-6">
              <Clock size={14} className="text-slate-300" />
              <span className="text-xs text-slate-500 font-medium">Criada há 2 dias por João S.</span>
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-slate-50">
               <div className="flex -space-x-2">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black">S{j}</div>
                  ))}
               </div>
               <div className="flex items-center gap-1 text-blue-600 font-black text-xs uppercase tracking-widest group-hover:gap-2 transition-all">
                 Abrir Matriz <ChevronRight size={16} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Renderizador do Wizard (Step 2)
  const renderWizard = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setStep(1)} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm"><ArrowLeft size={20}/></button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerar Nova Cotação</h2>
          <p className="text-sm text-slate-500 font-medium">Siga os passos para configurar a matriz de preços.</p>
        </div>
      </div>

      {/* Wizard Steps Indicator */}
      <div className="flex items-center justify-between p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className={`flex-1 text-center py-3 rounded-xl transition-all ${wizardStep === 1 ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 font-medium'}`}>1. Itens e Evento</div>
        <div className="px-4 text-slate-200">→</div>
        <div className={`flex-1 text-center py-3 rounded-xl transition-all ${wizardStep === 2 ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 font-medium'}`}>2. Fornecedores</div>
      </div>

      {wizardStep === 1 ? (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Vincular ao Evento (Sinistro)</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              value={newQuote.eventId}
              onChange={(e) => setNewQuote({...newQuote, eventId: e.target.value})}
            >
              <option value="">Selecione o Protocolo...</option>
              {MOCK_EVENTS.map(e => <option key={e.id} value={e.id}>{e.protocol} - {e.category}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Selecionar Itens do Catálogo ({newQuote.items.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
              {catalogMock.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => toggleItem(item.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${newQuote.items.includes(item.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${newQuote.items.includes(item.id) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>
                      {item.type === 'Peça' ? <Package size={16}/> : <Settings size={16}/>}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{item.name}</span>
                  </div>
                  {newQuote.items.includes(item.id) && <CheckCircle size={20} className="text-blue-600" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              disabled={!newQuote.eventId || newQuote.items.length === 0}
              onClick={() => setWizardStep(2)}
              className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              Próximo Passo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Escolher Fornecedores para Cotar ({newQuote.suppliers.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_SUPPLIERS.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => toggleSupplier(s.id)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${newQuote.suppliers.includes(s.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black ${newQuote.suppliers.includes(s.id) ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'bg-slate-300'}`}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.segment}</p>
                  </div>
                  {newQuote.suppliers.includes(s.id) && <CheckCircle size={20} className="text-blue-600 ml-auto" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setWizardStep(1)} className="px-6 py-3 text-slate-400 font-bold hover:text-slate-600">Voltar</button>
            <button 
              onClick={() => setStep(3)}
              className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all"
            >
              Gerar Matriz
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizador da Matriz (Step 3)
  const renderMatrix = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setStep(1)} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm"><ArrowLeft size={20}/></button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Matriz de Cotação: COT-2024-098</h2>
          <p className="text-sm text-slate-500 font-medium">Evento: EVT-2024-001 | Veículo: ABC-1234</p>
        </div>
      </div>
      <MatrixTable eventId={newQuote.eventId} />
    </div>
  );

  return (
    <div>
      {step === 1 && renderList()}
      {step === 2 && renderWizard()}
      {step === 3 && renderMatrix()}
    </div>
  );
};

export default Quotations;
