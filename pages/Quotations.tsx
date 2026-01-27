
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, ChevronRight, ArrowLeft, Send, CheckCircle, 
  FileText, Package, Users, BarChart3, Clock, Trash2, Settings,
  Zap, Mail, MessageCircle, FileDown, Rocket, LayoutGrid, List,
  Eye, MoreVertical, ShieldAlert
} from 'lucide-react';
import { MOCK_SUPPLIERS } from '../constants';
import MatrixTable from '../components/MatrixTable';
import { mockStorage } from '../services/supabaseClient';
import { Event } from '../types';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardStep, setWizardStep] = useState(1);
  const [realEvents, setRealEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newQuote, setNewQuote] = useState({
    eventId: '',
    items: [] as string[],
    suppliers: [] as string[],
    sendMode: 'auto' as 'auto' | 'manual'
  });

  // State para cotações - INICIA VAZIO
  const [quotes, setQuotes] = useState<any[]>([]);
  
  // State para exclusão
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);

  useEffect(() => {
    // Carregar eventos do storage
    const savedEvents = mockStorage.get('events') || [];
    setRealEvents(savedEvents);

    // Carregar cotações do storage
    const savedQuotes = mockStorage.get('quotations') || [];
    setQuotes(savedQuotes);
  }, []);

  const filteredQuotes = quotes.filter(q => 
    q.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.eventRef.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = () => {
    if (quoteToDelete) {
      const updatedQuotes = quotes.filter(q => q.id !== quoteToDelete.id);
      setQuotes(updatedQuotes);
      mockStorage.set('quotations', updatedQuotes);
      setQuoteToDelete(null);
    }
  };

  const handleCreateQuote = () => {
    const selectedEvent = realEvents.find(e => e.id === newQuote.eventId);
    const newQuoteEntry = {
        id: Math.random().toString(36).substr(2, 9),
        code: `COT-2024-${String(quotes.length + 1).padStart(4, '0')}`,
        eventRef: selectedEvent ? selectedEvent.protocol : 'N/A',
        status: 'Em Aberto',
        date: new Date().toLocaleDateString('pt-BR'),
        suppliers: newQuote.suppliers.length,
        itemCount: newQuote.items.length
    };

    const updatedQuotes = [...quotes, newQuoteEntry];
    setQuotes(updatedQuotes);
    mockStorage.set('quotations', updatedQuotes);
    
    // Avança para a matriz
    setStep(3);
  };

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
          <input 
            type="text" 
            placeholder="Buscar cotações por código ou protocolo..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 transition-all" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={18} />
            </button>
          </div>
          <button onClick={() => { setStep(2); setWizardStep(1); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap">
            <Plus size={20} /> Nova Cotação
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {filteredQuotes.map(quote => (
            <div key={quote.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer relative overflow-hidden" onClick={() => setStep(3)}>
              <div className="flex justify-between items-start mb-6">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-3xl shadow-sm"><BarChart3 size={28} /></div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${quote.status === 'Finalizada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {quote.status}
                    </span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setQuoteToDelete(quote); }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                        title="Excluir Cotação"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight leading-none mb-1">{quote.code}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Ref: {quote.eventRef}</p>
              
              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                 <div className="flex -space-x-3">
                    {[...Array(quote.suppliers)].map((_, j) => (
                      <div key={j} className="w-9 h-9 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500 shadow-sm">S{j+1}</div>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">Analisar <ChevronRight size={18} /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo Ref.</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Parceiros</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setStep(3)}>
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-800 text-sm tracking-tight">{quote.code}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{quote.date}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-blue-600 font-black text-xs bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{quote.eventRef}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${quote.status === 'Finalizada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex justify-center -space-x-2">
                      {[...Array(quote.suppliers)].map((_, j) => (
                        <div key={j} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 shadow-sm">S{j+1}</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right flex justify-end gap-1">
                     <button onClick={(e) => { e.stopPropagation(); setStep(3); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Eye size={18}/></button>
                     <button onClick={(e) => { e.stopPropagation(); setQuoteToDelete(quote); }} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {filteredQuotes.length === 0 && (
        <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
           <BarChart3 className="mx-auto text-slate-200 mb-4" size={48} />
           <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Nenhuma cotação encontrada</p>
        </div>
      )}
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
                <div key={item.id} onClick={() => toggleItem(item.id)} className={`p-5 rounded-[32px] border-2 cursor-pointer flex items-center justify-between transition-all ${newQuote.items.includes(item.id) ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-500/5' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                  <p className="text-sm font-black text-slate-800">{item.name}</p>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${newQuote.items.includes(item.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}><CheckCircle size={16} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t border-slate-50">
            <button disabled={!newQuote.eventId || newQuote.items.length === 0} onClick={() => setWizardStep(2)} className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 disabled:opacity-20 flex items-center gap-3 hover:translate-x-1 transition-all">Próximo Passo <ChevronRight size={18}/></button>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 space-y-10 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Parceiros para Cotação ({newQuote.suppliers.length})</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {MOCK_SUPPLIERS.map(s => (
                <div key={s.id} onClick={() => toggleSupplier(s.id)} className={`p-6 rounded-[32px] border-2 cursor-pointer flex items-center gap-5 transition-all ${newQuote.suppliers.includes(s.id) ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-500/5' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl transition-colors ${newQuote.suppliers.includes(s.id) ? 'bg-blue-600' : 'bg-slate-300'}`}>{s.name.charAt(0)}</div>
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
            <button onClick={() => setWizardStep(1)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600">Voltar</button>
            <button disabled={newQuote.suppliers.length === 0} onClick={handleCreateQuote} className="px-16 py-6 bg-blue-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/40 flex items-center gap-4 hover:scale-105 transition-all">Finalizar e Gerar Matriz <Rocket size={20}/></button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-20">
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

      {/* Modal de Exclusão "Caixa Bonita" */}
      {quoteToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setQuoteToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Cotação?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              Você tem certeza que deseja excluir a cotação <span className="font-black text-slate-800">{quoteToDelete.code}</span>? Esta ação é irreversível.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setQuoteToDelete(null)} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleDelete} className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
