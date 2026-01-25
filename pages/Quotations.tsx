
import React, { useState } from 'react';
import { 
  Plus, Search, ChevronRight, ArrowLeft, Send, CheckCircle, 
  FileText, Package, Users, BarChart3, Clock, Trash2, Settings,
  Zap, Mail, MessageCircle, FileDown, Rocket, LayoutGrid, List
} from 'lucide-react';
import { MOCK_SUPPLIERS, MOCK_EVENTS } from '../constants';
import MatrixTable from '../components/MatrixTable';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1); // 1: List, 2: Wizard, 3: Matrix
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardStep, setWizardStep] = useState(1); // 1: Event/Items, 2: Suppliers, 3: Send Mode
  
  const [newQuote, setNewQuote] = useState({
    eventId: '',
    items: [] as string[],
    suppliers: [] as string[],
    sendMode: 'auto' as 'auto' | 'manual'
  });

  // Mock de cotações existentes para a listagem
  const mockQuotes = [
    { id: '1', code: 'COT-2024-0001', eventRef: 'EVT-2024-001', status: 'Em Aberto', date: 'Há 2 dias', suppliers: 3 },
    { id: '2', code: 'COT-2024-0002', eventRef: 'EVT-2024-001', status: 'Finalizada', date: 'Há 2 dias', suppliers: 3 },
    { id: '3', code: 'COT-2024-0003', eventRef: 'EVT-2024-005', status: 'Em Aberto', date: 'Hoje', suppliers: 2 },
  ];

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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar cotações por protocolo ou fornecedor..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Ver em Cards"
            >
              <LayoutGrid size={18}/>
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Ver em Lista"
            >
              <List size={18}/>
            </button>
          </div>

          <button 
            onClick={() => { setStep(2); setWizardStep(1); }}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
          >
            <Plus size={20} /> Nova Cotação
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockQuotes.map(quote => (
            <div key={quote.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer" onClick={() => setStep(3)}>
              <div className="flex justify-between items-start mb-6">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-3xl shadow-sm">
                  <BarChart3 size={28} />
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${quote.status === 'Em Aberto' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                  {quote.status}
                </span>
              </div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">{quote.code}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Ref: {quote.eventRef}</p>
              
              <div className="flex items-center gap-3 mb-8 p-3 bg-slate-50 rounded-2xl">
                <Clock size={16} className="text-amber-500" />
                <span className="text-[10px] text-slate-500 font-black uppercase">Criada {quote.date}</span>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                 <div className="flex -space-x-3">
                    {Array.from({ length: quote.suppliers }).map((_, j) => (
                      <div key={j} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black shadow-sm">S{j+1}</div>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-all">
                   Analisar <ChevronRight size={18} />
                 </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cotação</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referência Evento</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Criação</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parceiros</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mockQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setStep(3)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BarChart3 size={16}/></div>
                      <p className="font-black text-slate-800">{quote.code}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-bold text-slate-500 text-sm">{quote.eventRef}</td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-bold text-slate-600 flex items-center gap-2"><Clock size={14} className="text-slate-400"/> {quote.date}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex -space-x-2">
                       {Array.from({ length: quote.suppliers }).map((_, j) => (
                         <div key={j} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-black shadow-sm" title={`Fornecedor ${j+1}`}>S{j+1}</div>
                       ))}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${quote.status === 'Em Aberto' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><ChevronRight size={20}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Renderizador do Wizard (Step 2)
  const renderWizard = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="flex items-center gap-6">
        <button onClick={() => setStep(1)} className="p-4 bg-white border border-slate-200 rounded-3xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><ArrowLeft size={24}/></button>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Configurar RFQ</h2>
          <p className="text-sm text-slate-500 font-medium">Request for Quotation: Itens → Fornecedores → Disparo.</p>
        </div>
      </div>

      {/* Wizard Steps Indicator */}
      <div className="flex items-center justify-between p-3 bg-white rounded-3xl shadow-sm border border-slate-100">
        <div className={`flex-1 text-center py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all ${wizardStep === 1 ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20' : 'text-slate-400 font-bold'}`}>1. Itens</div>
        <div className="px-4 text-slate-200">→</div>
        <div className={`flex-1 text-center py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all ${wizardStep === 2 ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20' : 'text-slate-400 font-bold'}`}>2. Fornecedores</div>
        <div className="px-4 text-slate-200">→</div>
        <div className={`flex-1 text-center py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all ${wizardStep === 3 ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20' : 'text-slate-400 font-bold'}`}>3. Modo Envio</div>
      </div>

      {wizardStep === 1 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Vincular ao Evento Ativo</label>
            <select 
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 font-black text-slate-800 transition-all"
              value={newQuote.eventId}
              onChange={(e) => setNewQuote({...newQuote, eventId: e.target.value})}
            >
              <option value="">Selecione o Protocolo...</option>
              {MOCK_EVENTS.map(e => <option key={e.id} value={e.id}>{e.protocol} | {e.category}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Itens Necessários ({newQuote.items.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-4 scrollbar-thin">
              {catalogMock.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => toggleItem(item.id)}
                  className={`p-5 rounded-[32px] border-2 transition-all cursor-pointer flex items-center justify-between group ${newQuote.items.includes(item.id) ? 'border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-600/5' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl transition-all ${newQuote.items.includes(item.id) ? 'bg-blue-600 text-white scale-110' : 'bg-white text-slate-400'}`}>
                      {item.type === 'Peça' ? <Package size={20}/> : <Settings size={20}/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.type}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${newQuote.items.includes(item.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-transparent group-hover:border-blue-300'}`}>
                    <CheckCircle size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-50">
            <button 
              disabled={!newQuote.eventId || newQuote.items.length === 0}
              onClick={() => setWizardStep(2)}
              className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-20 flex items-center gap-3"
            >
              Próximo Passo <ChevronRight size={18}/>
            </button>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Fornecedores Selecionados ({newQuote.suppliers.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {MOCK_SUPPLIERS.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => toggleSupplier(s.id)}
                  className={`p-6 rounded-[32px] border-2 transition-all cursor-pointer flex items-center gap-5 ${newQuote.suppliers.includes(s.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-all ${newQuote.suppliers.includes(s.id) ? 'bg-blue-600 scale-105 shadow-blue-600/20' : 'bg-slate-300 shadow-slate-200'}`}>
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800 text-sm tracking-tight">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{s.segment}</p>
                  </div>
                  {newQuote.suppliers.includes(s.id) && <CheckCircle size={24} className="text-blue-600" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-50">
            <button onClick={() => setWizardStep(1)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600">Voltar</button>
            <button 
              disabled={newQuote.suppliers.length === 0}
              onClick={() => setWizardStep(3)}
              className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-20 flex items-center gap-3"
            >
              Escolher Envio <ChevronRight size={18}/>
            </button>
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
           <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Modo de Disparo para Fornecedores</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div 
                  onClick={() => setNewQuote({...newQuote, sendMode: 'auto'})}
                  className={`p-10 rounded-[40px] border-4 transition-all cursor-pointer flex flex-col items-center text-center gap-6 relative ${newQuote.sendMode === 'auto' ? 'border-blue-600 bg-blue-50/50 shadow-2xl shadow-blue-600/10' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                 >
                    <div className={`p-6 rounded-[32px] ${newQuote.sendMode === 'auto' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'bg-white text-slate-400 shadow-sm'}`}>
                       <Rocket size={48} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Envio Automático</h3>
                       <p className="text-xs text-slate-500 font-medium leading-relaxed">Disparo imediato via WhatsApp e E-mail. Inclui link para fornecedor preencher preços online.</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                       <div className="bg-green-100 text-green-600 p-2 rounded-xl" title="WhatsApp"><MessageCircle size={16}/></div>
                       <div className="bg-blue-100 text-blue-600 p-2 rounded-xl" title="Email"><Mail size={16}/></div>
                       <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl" title="Notificação App Fornecedor"><Zap size={16}/></div>
                    </div>
                    {newQuote.sendMode === 'auto' && <div className="absolute top-6 right-6 text-blue-600"><CheckCircle size={32} /></div>}
                 </div>

                 <div 
                  onClick={() => setNewQuote({...newQuote, sendMode: 'manual'})}
                  className={`p-10 rounded-[40px] border-4 transition-all cursor-pointer flex flex-col items-center text-center gap-6 relative ${newQuote.sendMode === 'manual' ? 'border-blue-600 bg-blue-50/50 shadow-2xl shadow-blue-600/10' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                 >
                    <div className={`p-6 rounded-[32px] ${newQuote.sendMode === 'manual' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'bg-white text-slate-400 shadow-sm'}`}>
                       <FileDown size={48} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Envio Manual</h3>
                       <p className="text-xs text-slate-500 font-medium leading-relaxed">Gere o PDF do pré-orçamento. Você fica responsável por contatar e coletar os preços.</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                       <div className="bg-slate-100 text-slate-600 p-2 rounded-xl" title="Download PDF"><FileDown size={16}/></div>
                    </div>
                    {newQuote.sendMode === 'manual' && <div className="absolute top-6 right-6 text-blue-600"><CheckCircle size={32} /></div>}
                 </div>
              </div>
           </div>

           <div className="flex justify-between pt-6 border-t border-slate-50">
            <button onClick={() => setWizardStep(2)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600">Voltar</button>
            <button 
              onClick={() => setStep(3)}
              className="px-16 py-6 bg-blue-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/40 hover:bg-blue-700 transition-all flex items-center gap-4"
            >
              {newQuote.sendMode === 'auto' ? 'Disparar e Abrir Matriz' : 'Gerar Matriz'} <Rocket size={20}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizador da Matriz (Step 3)
  const renderMatrix = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-6">
        <button onClick={() => setStep(1)} className="p-4 bg-white border border-slate-200 rounded-3xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><ArrowLeft size={24}/></button>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Matriz COT-2024-098</h2>
          <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
            <Rocket size={14} className="text-blue-500" />
            Modo: {newQuote.sendMode === 'auto' ? 'Envio Automático Ativo' : 'Operação Manual'}
          </p>
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
