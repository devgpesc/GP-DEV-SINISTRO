
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, ChevronRight, ArrowLeft, BarChart3, Trash2, Rocket, List, Package, Users, Edit3, Box, Zap, Save, Loader2, Check, CheckSquare, LayoutGrid, Wrench, UserPlus, Paperclip, Eye } from 'lucide-react';
import MatrixTable from '../components/MatrixTable';
import { supabase } from '../services/supabaseClient';
import { eventService } from '../services/eventService';
import { Event, EventStatus, EventType, Priority, Supplier, CatalogItem } from '../types';
import { useToast } from '../context/ToastContext';
import ActionModal from '../components/ActionModal';
import { useEventTypes } from '../hooks/useEventTypes';
import { ATTACHMENT_ACCEPT } from '../utils/defaults';
import { lookupService } from '../services/lookupService';
import { formatDateTimeBr, formatVehicleLabel, formatVehicleModelShort } from '../utils/vehicleLabel';
import { quotationService } from '../services/quotationService';

const Quotations: React.FC = () => {
  const { addToast } = useToast();
  const { eventTypes } = useEventTypes();
  const [step, setStep] = useState(1); // 1: List, 2: Wizard, 3: Matrix
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [wizardStep, setWizardStep] = useState(1);
  const [realEvents, setRealEvents] = useState<Event[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<Supplier[]>([]);
  const [associatesById, setAssociatesById] = useState<Record<string, { id: string; name: string }>>({});
  const [vehiclesById, setVehiclesById] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // State da Nova/Edit Cotação
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  
  interface WizardItem {
      id?: string;
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      item_type?: 'Peça' | 'Serviço';
      catalog_item_id?: string;
  }

  const [newQuote, setNewQuote] = useState({
    eventId: '',
    eventProtocol: '',
    items: [] as WizardItem[], 
    selectedSuppliers: [] as string[],
    participationQuota: '',
    attachments: [] as any[],
  });

  // --- STATES DO CATÁLOGO INTELIGENTE ---
  const [itemSearch, setItemSearch] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [itemTypeTab, setItemTypeTab] = useState<'Peça' | 'Serviço'>('Peça');
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rfqFileInputRef = useRef<HTMLInputElement>(null);
  // --------------------------------------

  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  
  // Estado para passar para a Matriz
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [quickForm, setQuickForm] = useState({
    clientName: '',
    document: '',
    plate: '',
    type: EventType.COLLISION,
    description: '',
    participationQuota: '',
  });
  const selectedEvent = realEvents.find(ev => ev.id === newQuote.eventId);

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
                      .eq('type', itemTypeTab)
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
  }, [itemSearch, itemTypeTab]);

  const loadData = async () => {
    const [{ data: eventsData }, { data: suppliersData }, { data: quotesData }, { data: associatesData }, { data: vehiclesData }] =
      await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').eq('status', 'Ativo'),
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
        supabase.from('associates').select('id, name'),
        supabase.from('vehicles').select('id, plate, brand, model, year_fab, year_model'),
      ]);

    setRealEvents(eventsData || []);
    setRealSuppliers(suppliersData || []);
    setQuotes(quotesData || []);

    const aMap: Record<string, { id: string; name: string }> = {};
    (associatesData || []).forEach((a: any) => { aMap[a.id] = a; });
    setAssociatesById(aMap);

    const vMap: Record<string, any> = {};
    (vehiclesData || []).forEach((v: any) => { vMap[v.id] = v; });
    setVehiclesById(vMap);
  };

  const describeEventOption = (e: Event) => {
    const associate = associatesById[(e as any).associateId] || associatesById[(e as any).associate_id];
    const vehicle = vehiclesById[(e as any).vehicleId] || vehiclesById[(e as any).vehicle_id];
    const plate = vehicle?.plate || '—';
    const client = associate?.name || 'Sem associado';
    return `${e.protocol} · ${client} · ${plate} · ${e.status}`;
  };

  const filteredQuotes = quotes.filter(q => 
    q.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.eventRef?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getQuoteStatusClass = (status: string) => {
    if (status === 'Compra Autorizada') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'Compra Realizada') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Cancelada') return 'bg-red-50 text-red-600 border-red-100';
    if (status === 'Finalizada') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
  };

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
              category: i.category,
              item_type: i.item_type || 'Peça'
          })) || [],
          selectedSuppliers: qSuppliers?.map((qs: any) => qs.supplier_id) || [],
          participationQuota: quote.participation_quota != null ? String(quote.participation_quota) : '',
          attachments: Array.isArray(quote.attachments) ? quote.attachments : [],
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

        const quotaValue = newQuote.participationQuota ? Number(newQuote.participationQuota) : null;

        if (editingQuoteId) {
            const { error: updateError } = await supabase.from('quotations').update({
                suppliers: newQuote.selectedSuppliers.length,
                "itemCount": newQuote.items.length,
                participation_quota: quotaValue,
                attachments: newQuote.attachments,
                updated_at: new Date().toISOString()
            }).eq('id', editingQuoteId);

            if (updateError) throw updateError;
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
                participation_quota: quotaValue,
                attachments: newQuote.attachments,
                created_at: new Date().toISOString()
            }]).select().single();

            if (quoteError) throw quoteError;
            quoteId = quoteData.id;
        }

        if (!quoteId) throw new Error("ID da cotação inválido");

        if (editingQuoteId) {
            await quotationService.syncQuotationItems(quoteId, newQuote.items);
            await quotationService.syncQuotationSuppliers(quoteId, newQuote.selectedSuppliers);
        } else {
            if (newQuote.items.length > 0) {
                const itemsPayload = newQuote.items.map(item => ({
                    quotation_id: quoteId,
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit || (item.item_type === 'Serviço' ? 'HL' : 'UN'),
                    category: item.category,
                    item_type: item.item_type || 'Peça',
                    catalog_item_id: item.catalog_item_id || null,
                    status: 'Pendente'
                }));
                const { error: itemsError } = await supabase.from('quotation_items').insert(itemsPayload);
                if (itemsError) throw itemsError;
            }

            if (newQuote.selectedSuppliers.length > 0) {
                const suppliersPayload = newQuote.selectedSuppliers.map(supId => ({
                    quotation_id: quoteId,
                    supplier_id: supId,
                    status: 'Aguardando'
                }));
                const { error: suppliersError } = await supabase.from('quotation_suppliers').insert(suppliersPayload);
                if (suppliersError) throw suppliersError;
            }
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
              item_type: cItem.type || 'Peça',
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
      const isService = itemTypeTab === 'Serviço';
      
      setNewQuote(prev => ({
          ...prev, 
          items: [...prev.items, { 
              name: manualName, 
              quantity: manualQty, 
              unit: isService ? 'HL' : 'UN', 
              category: isService ? 'Serviços' : 'Geral',
              item_type: itemTypeTab
          }]
      }));
      setItemSearch('');
      setManualQty(1);
      setShowCatalogDropdown(false);
  };

  const updateWizardItem = (index: number, patch: Partial<WizardItem>) => {
      setNewQuote(prev => ({
          ...prev,
          items: prev.items.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
      }));
  };

  const createAndAddCatalogItem = async () => {
      if (!itemSearch.trim()) return;
      const isService = itemTypeTab === 'Serviço';
      
      const newItemPayload = {
          name: itemSearch.trim(),
          code: `NEW-${Date.now().toString().slice(-4)}`,
          category: isService ? 'Serviços' : 'Geral',
          type: itemTypeTab,
          unit: isService ? 'HL' : 'UN'
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

  const resetQuickForm = () => {
    setQuickForm({
      clientName: '',
      document: '',
      plate: '',
      type: EventType.COLLISION,
      description: '',
      participationQuota: '',
    });
  };

  const handleQuickDocLookup = async () => {
    const cleanDoc = quickForm.document.replace(/\D/g, '');
    if (cleanDoc.length !== 14) return;
    const data = await lookupService.fetchCNPJ(cleanDoc);
    if (data) {
      setQuickForm(prev => ({
        ...prev,
        clientName: data.fantasy || data.name || prev.clientName,
      }));
      addToast('success', 'CNPJ encontrado', 'Nome preenchido automaticamente.');
    }
  };

  const handleRfqFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newAttachments = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).slice(2, 11),
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      url: URL.createObjectURL(file),
      file,
      isNew: true,
    }));
    setNewQuote(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
    if (rfqFileInputRef.current) rfqFileInputRef.current.value = '';
  };

  const removeRfqAttachment = (id: string) => {
    setNewQuote(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
  };

  const handleQuickRegister = async () => {
    const clientName = quickForm.clientName.trim();
    const cleanPlate = quickForm.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanDocument = quickForm.document.replace(/\D/g, '');

    if (!clientName) {
      addToast('warning', 'Nome obrigatorio', 'Informe o nome do cliente.');
      return;
    }
    if (cleanPlate.length < 7) {
      addToast('warning', 'Placa invalida', 'Informe uma placa valida com 7 caracteres.');
      return;
    }

    setIsQuickSaving(true);
    try {
      let associateId = '';
      const docToUse = cleanDocument || `RAP${Date.now().toString().slice(-8)}`;

      const { data: existingAssociate } = await supabase
        .from('associates')
        .select('id')
        .eq('document', docToUse)
        .maybeSingle();

      if (existingAssociate?.id) {
        associateId = existingAssociate.id;
        await supabase.from('associates').update({ name: clientName }).eq('id', associateId);
      } else {
        const { data: newAssociate, error: associateError } = await supabase
          .from('associates')
          .insert([{
            name: clientName,
            document: docToUse,
            type: 'PF',
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();
        if (associateError) throw associateError;
        associateId = newAssociate.id;
      }

      let vehicleId = '';
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id, associate_id')
        .eq('plate', cleanPlate)
        .maybeSingle();

      if (existingVehicle?.id) {
        vehicleId = existingVehicle.id;
        await supabase.from('vehicles').update({ associate_id: associateId }).eq('id', vehicleId);
      } else {
        let brand = '';
        let model = '';
        try {
          const looked = await lookupService.fetchPlate(cleanPlate);
          brand = looked?.brand || '';
          model = looked?.model || '';
        } catch {
          /* opcional */
        }
        const currentYear = new Date().getFullYear().toString();
        const { data: newVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert([{
            plate: cleanPlate,
            associate_id: associateId,
            status: 'Ativo',
            brand: (brand || '—').toUpperCase(),
            model: (model || cleanPlate).toUpperCase(),
            color: 'BRANCA',
            fuel: 'FLEX',
            type: 'Automovel',
            year_fab: currentYear,
            year_model: currentYear,
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();
        if (vehicleError) throw vehicleError;
        vehicleId = newVehicle.id;
      }

      const protocol = `EVT-${new Date().getFullYear()}-${String(realEvents.length + 1).padStart(4, '0')}`;
      const createdEvent = await eventService.createEvent({
        protocol,
        type: quickForm.type,
        priority: Priority.MEDIUM,
        category: quickForm.type,
        vehicleId,
        associateId,
        description: quickForm.description.trim() || 'Sinistro aberto via cadastro rapido na cotacao.',
        participation_quota: quickForm.participationQuota ? Number(quickForm.participationQuota) : null,
        status: EventStatus.WAITING,
        createdAt: new Date().toISOString(),
        attachments: [],
        history: [],
      });

      await loadData();
      setNewQuote((prev) => ({
        ...prev,
        eventId: createdEvent.id,
        eventProtocol: createdEvent.protocol,
        participationQuota: quickForm.participationQuota || (createdEvent.participation_quota != null ? String(createdEvent.participation_quota) : ''),
      }));
      setShowQuickRegister(false);
      resetQuickForm();
      addToast('success', 'Sinistro criado', `Protocolo ${createdEvent.protocol} vinculado a cotacao.`);
    } catch (error: any) {
      console.error('Cadastro rapido:', error);
      addToast('error', 'Erro no cadastro', error.message || 'Nao foi possivel criar o sinistro.');
    } finally {
      setIsQuickSaving(false);
    }
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
          <button onClick={() => { setStep(2); setWizardStep(1); setEditingQuoteId(null); setNewQuote({eventId: '', eventProtocol: '', items: [], selectedSuppliers: [], participationQuota: '', attachments: []}); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap">
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
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${getQuoteStatusClass(quote.status)}`}>
                        {quote.status}
                        </span>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight leading-none mb-1">{quote.code}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Ref: {quote.eventRef}</p>
                  <p className="text-[11px] text-slate-500 font-bold mb-6">Cotação: {formatDateTimeBr(quote.created_at || quote.createdAt)}</p>
                  
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
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código / Protocolo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Itens</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fornecedores</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Hora cotação</th>
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
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getQuoteStatusClass(quote.status)}`}>
                        {quote.status}
                        </span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-700">{formatDateTimeBr(quote.created_at || quote.createdAt)}</p>
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
                      setNewQuote({
                        ...newQuote,
                        eventId: e.target.value,
                        eventProtocol: evt?.protocol || '',
                        participationQuota: evt?.participation_quota != null ? String(evt.participation_quota) : newQuote.participationQuota,
                      });
                  }} disabled={!!editingQuoteId}>
                    <option value="">Selecione...</option>
                    {realEvents.map(e => (
                      <option key={e.id} value={e.id}>{describeEventOption(e)}</option>
                    ))}
                  </select>

                  {!editingQuoteId && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowQuickRegister((prev) => !prev)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-blue-700 text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
                      >
                        <UserPlus size={16} />
                        {showQuickRegister ? 'Fechar cadastro rapido' : 'Cadastro rapido de sinistro'}
                      </button>

                      {showQuickRegister && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Novo sinistro sem sair da cotacao</p>
                          <input
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none"
                            placeholder="Nome do cliente *"
                            value={quickForm.clientName}
                            onChange={(e) => setQuickForm((prev) => ({ ...prev, clientName: e.target.value }))}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none uppercase"
                              placeholder="Placa *"
                              value={quickForm.plate}
                              onChange={(e) => setQuickForm((prev) => ({ ...prev, plate: e.target.value }))}
                              maxLength={8}
                            />
                            <input
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none"
                              placeholder="CPF/CNPJ (opcional — CNPJ busca automática)"
                              value={quickForm.document}
                              onChange={(e) => setQuickForm((prev) => ({ ...prev, document: e.target.value }))}
                              onBlur={handleQuickDocLookup}
                            />
                          </div>
                          <select
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none"
                            value={quickForm.type}
                            onChange={(e) => setQuickForm((prev) => ({ ...prev, type: e.target.value as EventType }))}
                          >
                            {eventTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none"
                            placeholder="Cota de participação do veículo (opcional)"
                            value={quickForm.participationQuota}
                            onChange={(e) => setQuickForm((prev) => ({ ...prev, participationQuota: e.target.value }))}
                          />
                          <textarea
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none min-h-[70px]"
                            placeholder="Descricao do sinistro (opcional)"
                            value={quickForm.description}
                            onChange={(e) => setQuickForm((prev) => ({ ...prev, description: e.target.value }))}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => { setShowQuickRegister(false); resetQuickForm(); }}
                              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 bg-white border border-slate-200"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleQuickRegister}
                              disabled={isQuickSaving}
                              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {isQuickSaving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                              Criar e vincular
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Cota de participação do veículo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none"
                      placeholder="R$ 0,00 (opcional)"
                      value={newQuote.participationQuota}
                      onChange={(e) => setNewQuote({ ...newQuote, participationQuota: e.target.value })}
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexos da cotação</label>
                      <button type="button" onClick={() => rfqFileInputRef.current?.click()} className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-100 flex items-center gap-1">
                        <Paperclip size={12} /> Adicionar
                      </button>
                      <input type="file" ref={rfqFileInputRef} className="hidden" multiple accept={ATTACHMENT_ACCEPT} onChange={handleRfqFileSelect} />
                    </div>
                    {newQuote.attachments.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400">Nenhum anexo — fotos, vídeos, laudos ou PDFs.</p>
                    ) : (
                      <div className="space-y-2">
                        {newQuote.attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                            <Paperclip size={14} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400">{att.size}</p>
                            </div>
                            {att.url && (
                              <a href={att.url} target="_blank" rel="noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={14} /></a>
                            )}
                            <button type="button" onClick={() => removeRfqAttachment(att.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedEvent && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400 font-bold uppercase tracking-wider">Protocolo</p>
                          <p className="text-slate-700 font-black">{selectedEvent.protocol}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-bold uppercase tracking-wider">Status</p>
                          <p className="text-slate-700 font-black">{selectedEvent.status || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-bold uppercase tracking-wider">Associado</p>
                          <p className="text-slate-700 font-black">
                            {associatesById[(selectedEvent as any).associateId]?.name ||
                              associatesById[(selectedEvent as any).associate_id]?.name ||
                              '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-bold uppercase tracking-wider">Placa / Veículo</p>
                          <p className="text-slate-700 font-black">
                            {formatVehicleLabel(
                              vehiclesById[(selectedEvent as any).vehicleId] ||
                                vehiclesById[(selectedEvent as any).vehicle_id],
                            )}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-slate-400 font-bold uppercase tracking-wider">Abertura do sinistro (solicitação)</p>
                          <p className="text-slate-700 font-black">
                            {formatDateTimeBr((selectedEvent as any).createdAt || (selectedEvent as any).created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
               </div>
            </div>

            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-200 h-full flex flex-col relative">
               <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><List size={20} className="text-blue-600"/> 2. Defina os Itens</h3>
               <div className="flex-1 space-y-4">
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button type="button" onClick={() => setItemTypeTab('Peça')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${itemTypeTab === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                      <Package size={14} /> Pecas
                    </button>
                    <button type="button" onClick={() => setItemTypeTab('Serviço')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${itemTypeTab === 'Serviço' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}>
                      <Wrench size={14} /> Servicos / Mao de Obra
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {newQuote.items.length} item(ns)
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewQuote(prev => ({ ...prev, items: [] }))}
                      disabled={newQuote.items.length === 0}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 disabled:opacity-40"
                    >
                      Limpar Lista
                    </button>
                  </div>
                  
                  {/* Busca Inteligente (Step 2 Melhorado) */}
                  <div className="relative z-20">
                      <div className="flex gap-2">
                          <div className="flex-1 relative">
                              <input 
                                ref={searchInputRef}
                                className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" 
                                placeholder={itemTypeTab === 'Serviço' ? 'Busque servico ou digite mao de obra...' : 'Busque no catalogo ou digite...'} 
                                value={itemSearch} 
                                onChange={e => setItemSearch(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && !showCatalogDropdown && addManualItem()} 
                              />
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                  {isSearchingCatalog ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                              </div>
                          </div>
                          <input type="number" className="w-20 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-center" value={manualQty} onChange={e => setManualQty(Math.max(0.5, Number(e.target.value) || 1))} min={itemTypeTab === 'Serviço' ? 0.5 : 1} step={itemTypeTab === 'Serviço' ? 0.5 : 1} title={itemTypeTab === 'Serviço' ? 'Horas (HL)' : 'Quantidade'} />
                          <button onClick={addManualItem} className={`text-white p-4 rounded-2xl shadow-lg hover:scale-105 transition-all ${itemTypeTab === 'Serviço' ? 'bg-purple-600' : 'bg-slate-900'}`} title={itemTypeTab === 'Serviço' ? 'Adicionar servico' : 'Adicionar peca'}><Plus size={20}/></button>
                      </div>

                      {/* Dropdown de Catálogo */}
                      {showCatalogDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 z-50">
                              {searchResults.length > 0 ? (
                                  <>
                                    <div className="p-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0">
                                      Catalogo Oficial — {itemTypeTab === 'Serviço' ? 'Servicos' : 'Pecas'}
                                    </div>
                                    {searchResults.map(item => (
                                        <button key={item.id} onClick={() => addCatalogItem(item)} className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center group transition-colors">
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{item.code} • {item.unit} • {item.category} • {item.type}</p>
                                            </div>
                                            <Plus size={16} className="text-blue-600 opacity-0 group-hover:opacity-100"/>
                                        </button>
                                    ))}
                                  </>
                              ) : (
                                  <div className="p-4 text-center">
                                      <p className="text-xs text-slate-400 mb-2">Item não encontrado no catálogo.</p>
                                      <button onClick={createAndAddCatalogItem} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 w-full p-2 rounded-xl hover:bg-blue-50">
                                          <Save size={14}/> Cadastrar "{itemSearch}" como {itemTypeTab === 'Serviço' ? 'servico' : 'peca'} e adicionar
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
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.item_type === 'Serviço' ? 'bg-purple-100 text-purple-600' : item.catalog_item_id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                      {item.item_type === 'Serviço' ? <Wrench size={14}/> : item.catalog_item_id ? <Zap size={14} fill="currentColor"/> : <Box size={14}/>}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} {item.unit} {item.item_type === 'Serviço' ? '• Servico' : ''} {item.category ? `• ${item.category}` : ''}</p>
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
