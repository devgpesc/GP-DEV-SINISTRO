
import React, { useState, useEffect } from 'react';
import { Plus, Search, ChevronRight, ArrowLeft, BarChart3, Trash2, Rocket, LayoutGrid, List, Eye, CheckSquare, Square, Package, Users } from 'lucide-react';
import MatrixTable from '../components/MatrixTable';
import { supabase } from '../services/supabaseClient';
import { Event, Supplier } from '../types';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1); // 1: List, 2: Wizard, 3: Matrix
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardStep, setWizardStep] = useState(1);
  const [realEvents, setRealEvents] = useState<Event[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State da Nova Cotação
  const [newQuote, setNewQuote] = useState({
    eventId: '',
    eventProtocol: '',
    items: [] as string[], // Lista de nomes de itens
    selectedSuppliers: [] as string[] // IDs dos fornecedores
  });

  // Input temporário para adicionar itens manuais no Wizard
  const [manualItem, setManualItem] = useState('');

  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  
  // Estado para passar para a Matriz
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // 1. Carregar eventos reais (Aguardando ou Em Cotação)
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .order('created_at', { ascending: false });
    setRealEvents(eventsData || []);

    // 2. Carregar fornecedores reais
    const { data: suppliersData } = await supabase.from('suppliers')
        .select('*')
        .eq('status', 'Ativo');
    setRealSuppliers(suppliersData || []);

    // 3. Carregar cotações existentes
    const { data: quotesData } = await supabase.from('quotations')
        .select('*')
        .order('created_at', { ascending: false });
    setQuotes(quotesData || []);
  };

  const filteredQuotes = quotes.filter(q => 
    q.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.eventRef?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateQuote = async () => {
    if (!newQuote.eventId || newQuote.selectedSuppliers.length === 0) {
        alert("Selecione um evento e pelo menos um fornecedor.");
        return;
    }

    const selectedEvent = realEvents.find(e => e.id === newQuote.eventId);
    const code = `COT-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`;
    
    const payload = {
        code: code,
        eventRef: selectedEvent ? selectedEvent.protocol : 'N/A',
        status: 'Em Aberto',
        date: new Date().toLocaleDateString('pt-BR'),
        suppliers: newQuote.selectedSuppliers.length,
        itemCount: newQuote.items.length,
        eventId: newQuote.eventId,
        created_at: new Date().toISOString()
    };

    // Salva a cotação no banco
    const { data, error } = await supabase.from('quotations').insert([payload]).select().single();
    
    if (!error && data) {
        // Atualiza status do evento
        await supabase.from('events').update({ status: 'Em Cotação' }).eq('id', newQuote.eventId);
        
        setQuotes([data, ...quotes]);
        setActiveQuoteId(data.id);
        setActiveEventId(newQuote.eventId);
        setStep(3); // Vai para a Matriz
    } else {
        console.error('Erro ao criar cotação:', error);
        // Fallback visual
        setStep(3);
        setActiveEventId(newQuote.eventId);
    }
  };

  const addItem = () => {
      if (manualItem.trim()) {
          setNewQuote(prev => ({...prev, items: [...prev.items, manualItem]}));
          setManualItem('');
      }
  };

  const toggleSupplier = (id: string) => {
    setNewQuote(prev => ({
      ...prev,
      selectedSuppliers: prev.selectedSuppliers.includes(id) 
        ? prev.selectedSuppliers.filter(i => i !== id) 
        : [...prev.selectedSuppliers, id]
    }));
  };

  const openMatrix = (quote: any) => {
      setActiveQuoteId(quote.id);
      setActiveEventId(quote.eventId); // Garante que o ID do evento seja passado
      setStep(3);
  };

  // --- RENDERIZADORES ---

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
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List size={18} /></button>
          </div>
          <button onClick={() => { setStep(2); setWizardStep(1); setNewQuote({eventId: '', eventProtocol: '', items: [], selectedSuppliers: []}); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap">
            <Plus size={20} /> Nova Cotação
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {filteredQuotes.map(quote => (
            <div key={quote.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer relative overflow-hidden" onClick={() => openMatrix(quote)}>
              <div className="flex justify-between items-start mb-6">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-3xl shadow-sm"><BarChart3 size={28} /></div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${quote.status === 'Finalizada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {quote.status}
                    </span>
                </div>
              </div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight leading-none mb-1">{quote.code}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Ref: {quote.eventRef}</p>
              
              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                 <div className="flex -space-x-3">
                    {[...Array(quote.suppliers || 1)].map((_, j) => (
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
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => openMatrix(quote)}>
                  <td className="px-8 py-5"><p className="font-black text-slate-800 text-sm tracking-tight">{quote.code}</p></td>
                  <td className="px-8 py-5"><span className="text-blue-600 font-black text-xs bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{quote.eventRef}</span></td>
                  <td className="px-8 py-5 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${quote.status === 'Finalizada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{quote.status}</span></td>
                  <td className="px-8 py-5 text-right flex justify-end gap-1">
                     <button onClick={(e) => { e.stopPropagation(); openMatrix(quote); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Eye size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderWizard = () => (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="flex items-center gap-6">
        <button onClick={() => setStep(1)} className="p-4 bg-white border border-slate-200 rounded-3xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><ArrowLeft size={24}/></button>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Nova Cotação (RFQ)</h2>
          <p className="text-sm text-slate-500 font-medium">Configure os itens e convide fornecedores.</p>
        </div>
      </div>

      {/* STEP 1: Selecionar Evento e Itens */}
      {wizardStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 h-full">
               <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Package size={20} className="text-blue-600"/> 1. Selecione o Sinistro</h3>
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Eventos Disponíveis</label>
                  <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-slate-800" value={newQuote.eventId} onChange={(e) => {
                      const evt = realEvents.find(ev => ev.id === e.target.value);
                      setNewQuote({...newQuote, eventId: e.target.value, eventProtocol: evt?.protocol || ''});
                  }}>
                    <option value="">Selecione...</option>
                    {realEvents.map(e => <option key={e.id} value={e.id}>{e.protocol} - {e.category} ({e.status})</option>)}
                  </select>
               </div>
            </div>

            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 h-full flex flex-col">
               <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><List size={20} className="text-blue-600"/> 2. Defina os Itens</h3>
               <div className="flex-1 space-y-4">
                  <div className="flex gap-2">
                      <input className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium" placeholder="Nome da peça ou serviço..." value={manualItem} onChange={e => setManualItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
                      <button onClick={addItem} className="bg-slate-900 text-white p-4 rounded-2xl"><Plus size={20}/></button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {newQuote.items.length === 0 && <p className="text-center text-slate-400 py-10 text-xs uppercase tracking-widest font-bold">Nenhum item adicionado</p>}
                      {newQuote.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-700 text-sm">{item}</span>
                              <button onClick={() => setNewQuote(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>
               </div>
               <div className="flex justify-end pt-6 border-t border-slate-50 mt-6">
                  <button disabled={!newQuote.eventId || newQuote.items.length === 0} onClick={() => setWizardStep(2)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2">
                      Continuar <ChevronRight size={16}/>
                  </button>
               </div>
            </div>
        </div>
      )}

      {/* STEP 2: Selecionar Fornecedores */}
      {wizardStep === 2 && (
        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600"/> 3. Convide Fornecedores</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-h-[400px] overflow-y-auto p-2">
             {realSuppliers.map(sup => (
                 <div key={sup.id} onClick={() => toggleSupplier(sup.id)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${newQuote.selectedSuppliers.includes(sup.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}>
                     <div>
                         <p className="font-bold text-slate-800">{sup.name}</p>
                         <p className="text-xs text-slate-500">{sup.city} • {sup.rating} ★</p>
                     </div>
                     <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${newQuote.selectedSuppliers.includes(sup.id) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                         {newQuote.selectedSuppliers.includes(sup.id) && <CheckSquare size={14}/>}
                     </div>
                 </div>
             ))}
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-50">
            <button onClick={() => setWizardStep(1)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600">Voltar</button>
            <button onClick={handleCreateQuote} disabled={newQuote.selectedSuppliers.length === 0} className="px-16 py-6 bg-blue-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/40 flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">
                Lançar Cotação <Rocket size={20}/>
            </button>
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
                  <p className="text-sm text-slate-500">Compare preços e aprove as melhores ofertas.</p>
              </div>
           </div>
           {/* IMPORTANTE: Passar o activeEventId corretamente para evitar erro UUID */}
           <MatrixTable eventId={activeEventId || undefined} />
        </div>
      )}
    </div>
  );
};

export default Quotations;
