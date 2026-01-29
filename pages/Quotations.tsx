
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, ChevronRight, ArrowLeft, BarChart3, Trash2, Rocket, List, Package, Users, Edit3, Box, Zap, Save, Loader2, Check, CheckSquare, LayoutGrid } from 'lucide-react';
import MatrixTable from '../components/MatrixTable';
import { supabase } from '../services/supabaseClient';
import { Event, Supplier, CatalogItem } from '../types';
import { useToast } from '../context/ToastContext';
import ActionModal from '../components/ActionModal';

const Quotations: React.FC = () => {
  const { addToast } = useToast();
  const [step, setStep] = useState(1); // 1: List, 2: Wizard, 3: Matrix
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardStep, setWizardStep] = useState(1);
  const [realEvents, setRealEvents] = useState<Event[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State da Nova/Edit Cotação
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  
  interface WizardItem {
      id?: string;
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      catalog_item_id?: string;
  }

  const [newQuote, setNewQuote] = useState({
    eventId: '',
    eventProtocol: '',
    items: [] as WizardItem[], 
    selectedSuppliers: [] as string[] 
  });

  // --- STATES DO CATÁLOGO INTELIGENTE ---
  const [itemSearch, setItemSearch] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // --------------------------------------

  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  
  // Estado para passar para a Matriz
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Busca no Catálogo (Debounce)
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
          if (itemSearch.trim().length >= 2) {
              setIsSearchingCatalog(true);
              try {
                  const { data } = await supabase
                      .from('catalog_items')
                      .select('*')
                      .or(`name.ilike.%${itemSearch}%,code.ilike.%${itemSearch}%`)
                      .limit(5);
                  setSearchResults(data || []);
                  setShowCatalogDropdown(true);
              } catch (e) {
                  console.error(e);
              } finally {
                  setIsSearchingCatalog(false);
              }
          } else {
              setSearchResults([]);
              setShowCatalogDropdown(false);
          }
      }, 300);

      return () => clearTimeout(delayDebounceFn);
  }, [itemSearch]);

  const loadData = async () => {
    const { data: eventsData } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    setRealEvents(eventsData || []);

    const { data: suppliersData } = await supabase.from('suppliers').select('*').eq('status', 'Ativo');
    setRealSuppliers(suppliersData || []);

    const { data: quotesData } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
    setQuotes(quotesData || []);
  };

  const filteredQuotes = quotes.filter(q => 
    q.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.eventRef?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditQuote = async (quote: any) => {
      setEditingQuoteId(quote.id);
      
      const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', quote.id);
      const { data: qSuppliers } = await supabase.from('quotation_suppliers').select('supplier_id').eq('quotation_id', quote.id);
      
      setNewQuote({
          eventId: quote.eventId,
          eventProtocol: quote.eventRef,
          items: items?.map(i => ({ 
              id: i.id,
              name: i.name, 
              quantity: i.quantity, 
              unit: i.unit || 'UN',
              catalog_item_id: i.catalog_item_id,
              category: i.category
          })) || [],
          selectedSuppliers: qSuppliers?.map((qs: any) => qs.supplier_id) || []
      });
      
      setStep(2);
      setWizardStep(1);
  };

  const handleDeleteQuote = async () => {
      if (!quoteToDelete) return;
      try {
          await supabase.from('quotations').delete().eq('id', quoteToDelete.id);
          setQuotes(quotes.filter(q => q.id !== quoteToDelete.id));
          addToast('success', 'Excluída', 'Cotação removida com sucesso.');
          setQuoteToDelete(null);
      } catch (error: any) {
          addToast('error', 'Erro', 'Não foi possível excluir a cotação.');
      }
  };

  const handleCreateOrUpdateQuote = async () => {
    if (!newQuote.eventId || newQuote.selectedSuppliers.length === 0) {
        addToast('warning', 'Dados Incompletos', "Selecione um evento e pelo menos um fornecedor.");
        return;
    }

    try {
        const selectedEvent = realEvents.find(e => e.id === newQuote.eventId);
        let quoteId = editingQuoteId;

        if (editingQuoteId) {
            await supabase.from('quotations').update({
                suppliers: newQuote.selectedSuppliers.length,
                "itemCount": newQuote.items.length,
                updated_at: new Date().toISOString()
            }).eq('id', editingQuoteId);

            await supabase.from('quotation_suppliers').delete().eq('quotation_id', editingQuoteId);
            await supabase.from('quotation_items').delete().eq('quotation_id', editingQuoteId);
            
        } else {
            const code = `COT-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`;
            const { data: quoteData, error: quoteError } = await supabase.from('quotations').insert([{
                code: code,
                eventRef: selectedEvent ? selectedEvent.protocol : 'N/A',
                status: 'Em Aberto',
                date: new Date().toLocaleDateString('pt-BR'),
                suppliers: newQuote.selectedSuppliers.length,
                "itemCount": newQuote.items.length,
                "eventId": newQuote.eventId,
                created_at: new Date().toISOString()
            }]).select().single();

            if (quoteError) throw quoteError;
            quoteId = quoteData.id;
        }

        if (!quoteId) throw new Error("ID da cotação inválido");

        if (newQuote.items.length > 0) {
            const itemsPayload = newQuote.items.map(item => ({
                quotation_id: quoteId,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit || 'UN',
                category: item.category,
                catalog_item_id: item.catalog_item_id || null, 
                status: 'Pendente'
            }));
            await supabase.from('quotation_items').insert(itemsPayload);
        }

        if (newQuote.selectedSuppliers.length > 0) {
            const suppliersPayload = newQuote.selectedSuppliers.map(supId => ({
                quotation_id: quoteId,
                supplier_id: supId,
                status: 'Aguardando'
            }));
            await supabase.from('quotation_suppliers').insert(suppliersPayload);
        }
        
        await supabase.from('events').update({ status: 'Em Cotação' }).eq('id', newQuote.eventId);
        
        addToast('success', editingQuoteId ? 'Cotação Atualizada' : 'Cotação Criada', 'RFQ pronta. Acesse a matriz.');
        await loadData();
        setActiveQuoteId(quoteId);
        setActiveEventId(newQuote.eventId);
        setStep(3); 

    } catch (error: any) {
        console.error('Erro:', error);
        addToast('error', 'Erro Crítico', error.message);
    }
  };

  // --- LÓGICA DO WIZARD INTELIGENTE (CATÁLOGO) ---

  const addCatalogItem = (cItem: CatalogItem) => {
      setNewQuote(prev => ({
          ...prev,
          items: [...prev.items, { 
              name: cItem.name, 
              quantity: manualQty, 
              unit: cItem.unit, 
              category: cItem.category, 
              catalog_item_id: cItem.id 
          }]
      }));
      setItemSearch('');
      setManualQty(1);
      setShowCatalogDropdown(false);
      searchInputRef.current?.focus();
  };

  const addManualItem = async () => {
      if (!itemSearch.trim()) return;
      const manualName = itemSearch.trim();
      
      setNewQuote(prev => ({
          ...prev, 
          items: [...prev.items, { name: manualName, quantity: manualQty, unit: 'UN', category: 'Geral' }]
      }));
      setItemSearch('');
      setManualQty(1);
      setShowCatalogDropdown(false);
  };

  const createAndAddCatalogItem = async () => {
      if (!itemSearch.trim()) return;
      
      const newItemPayload = {
          name: itemSearch.trim(),
          code: `NEW-${Date.now().toString().slice(-4)}`,
          category: 'Geral',
          type: 'Peça',
          unit: 'UN'
      };

      try {
          const { data, error } = await supabase.from('catalog_items').insert([newItemPayload]).select().single();
          if (error) throw error;
          
          addCatalogItem(data);
          addToast('success', 'Item Criado', 'Adicionado ao catálogo e à cotação.');
      } catch (e: any) {
          addToast('error', 'Erro', 'Falha ao criar item no catálogo.');
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
      setActiveEventId(quote.eventId);
      setStep(3);
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
          <div className="flex bg-slate-100 p-1 rounded-2xl">
             <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
             <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><List size={20}/></button>
          </div>
          <button onClick={() => { setStep(2); setWizardStep(1); setEditingQuoteId(null); setNewQuote({eventId: '', eventProtocol: '', items: [], selectedSuppliers: []}); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap">
            <Plus size={20} /> Nova Cotação
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {filteredQuotes.map(quote => (
            <div key={quote.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group relative overflow-hidden">
              <div onClick={() => openMatrix(quote)} className="cursor-pointer">
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
                        {[...Array(Math.min(quote.suppliers || 0, 5))].map((_, j) => (
                          <div key={j} className="w-9 h-9 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500 shadow-sm">S{j+1}</div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">Analisar <ChevronRight size={18} /></div>
                  </div>
              </div>
              
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleEditQuote(quote); }} className="p-2 bg-white text-slate-400 hover:text-blue-600 rounded-xl shadow-sm hover:shadow-md transition-all"><Edit3 size={16}/></button>
                  <button onClick={(e) => { e.stopPropagation(); setQuoteToDelete(quote); }} className="p-2 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm hover:shadow-md transition-all"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código / Ref</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Itens</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fornecedores</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredQuotes.map(quote => (
                  <tr key={quote.id} className="hover:bg-slate-50/50 group cursor-pointer" onClick={() => openMatrix(quote)}>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-800 text-sm">{quote.code}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{quote.eventRef}</p>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <span className="font-bold text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded-lg">{quote.itemCount || 0}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <div className="flex justify-center -space-x-2">
                          {[...Array(Math.min(quote.suppliers || 0, 3))].map((_, j) => (
                            <div key={j} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">S{j+1}</div>
                          ))}
                          {(quote.suppliers || 0) > 3 && <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">+{quote.suppliers - 3}</div>}
                       </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${quote.status === 'Finalizada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {quote.status}
                        </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleEditQuote(quote); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setQuoteToDelete(quote); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                          <button onClick={(e) => { e.stopPropagation(); openMatrix(quote); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><ChevronRight size={16}/></button>
                       </div>
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
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{editingQuoteId ? 'Editar Cotação' : 'Nova Cotação (RFQ)'}</h2>
          <p className="text-sm text-slate-500 font-medium">Configure os itens e convide fornecedores.</p>
        </div>
      </div>

      {wizardStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 h-full">
               <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Package size={20} className="text-blue-600"/> 1. Selecione o Sinistro</h3>
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Eventos Disponíveis</label>
                  <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-slate-800 disabled:opacity-50" value={newQuote.eventId} onChange={(e) => {
                      const evt = realEvents.find(ev => ev.id === e.target.value);
                      setNewQuote({...newQuote, eventId: e.target.value, eventProtocol: evt?.protocol || ''});
                  }} disabled={!!editingQuoteId}>
                    <option value="">Selecione...</option>
                    {realEvents.map(e => <option key={e.id} value={e.id}>{e.protocol} - {e.category} ({e.status})</option>)}
                  </select>
               </div>
            </div>

            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 h-full flex flex-col relative">
               <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><List size={20} className="text-blue-600"/> 2. Defina os Itens</h3>
               <div className="flex-1 space-y-4">
                  
                  {/* Busca Inteligente (Step 2 Melhorado) */}
                  <div className="relative z-20">
                      <div className="flex gap-2">
                          <div className="flex-1 relative">
                              <input 
                                ref={searchInputRef}
                                className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" 
                                placeholder="Busque no catálogo ou digite..." 
                                value={itemSearch} 
                                onChange={e => setItemSearch(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && !showCatalogDropdown && addManualItem()} 
                              />
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                  {isSearchingCatalog ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                              </div>
                          </div>
                          <input type="number" className="w-20 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-center" value={manualQty} onChange={e => setManualQty(Number(e.target.value))} min={1} />
                          <button onClick={addManualItem} className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg hover:scale-105 transition-all"><Plus size={20}/></button>
                      </div>

                      {/* Dropdown de Catálogo */}
                      {showCatalogDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 z-50">
                              {searchResults.length > 0 ? (
                                  <>
                                    <div className="p-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0">Catálogo Oficial</div>
                                    {searchResults.map(item => (
                                        <button key={item.id} onClick={() => addCatalogItem(item)} className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center group transition-colors">
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{item.code} • {item.unit} • {item.category}</p>
                                            </div>
                                            <Plus size={16} className="text-blue-600 opacity-0 group-hover:opacity-100"/>
                                        </button>
                                    ))}
                                  </>
                              ) : (
                                  <div className="p-4 text-center">
                                      <p className="text-xs text-slate-400 mb-2">Item não encontrado no catálogo.</p>
                                      <button onClick={createAndAddCatalogItem} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 w-full p-2 rounded-xl hover:bg-blue-50">
                                          <Save size={14}/> Cadastrar "{itemSearch}" e Adicionar
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 mt-4 custom-scrollbar">
                      {newQuote.items.length === 0 && (
                          <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                              <Box className="mx-auto text-slate-200 mb-2" size={32}/>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lista vazia</p>
                          </div>
                      )}
                      {newQuote.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-blue-100 transition-all">
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.catalog_item_id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                      {item.catalog_item_id ? <Zap size={14} fill="currentColor"/> : <Box size={14}/>}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} {item.unit} {item.category ? `• ${item.category}` : ''}</p>
                                  </div>
                              </div>
                              <button onClick={() => setNewQuote(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
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
            <button onClick={handleCreateOrUpdateQuote} disabled={newQuote.selectedSuppliers.length === 0} className="px-16 py-6 bg-blue-600 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/40 flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">
                {editingQuoteId ? 'Atualizar Cotação' : 'Lançar Cotação'} <Rocket size={20}/>
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
           <MatrixTable quotationId={activeQuoteId || undefined} eventId={activeEventId || undefined} />
        </div>
      )}
      <ActionModal 
        isOpen={!!quoteToDelete}
        onClose={() => setQuoteToDelete(null)}
        onConfirm={handleDeleteQuote}
        title="Excluir Cotação?"
        description="Esta ação removerá todos os itens e preços associados a esta cotação."
        type="danger"
        confirmText="Sim, Excluir"
      />
    </div>
  );
};

export default Quotations;
