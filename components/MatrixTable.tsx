import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, TrendingDown, ShoppingCart, Trophy, DollarSign, ArrowRight, 
  Loader2, AlertTriangle, RefreshCw, XCircle, Edit2, Save, X, MessageSquare, 
  Filter, FileText, Download, CheckSquare, BarChart3, Search 
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { quotationService } from '../services/quotationService';
import { QuotationItem, SupplierPrice, Supplier } from '../types';
import { useToast } from '../context/ToastContext';

interface MatrixProps {
  quotationId?: string;
  eventId?: string;
}

const MatrixTable: React.FC<MatrixProps> = ({ quotationId, eventId }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatingSim, setGeneratingSim] = useState(false);

  // Dados Reais
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<SupplierPrice[]>([]);

  // Estado das seleções: { [itemId]: supplierId }
  const [selections, setSelections] = useState<Record<string, string>>({});

  // Filtros
  const [filterText, setFilterText] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos'); // Todos, Pendente, Cotado

  // Estado de Edição Manual
  const [editingCell, setEditingCell] = useState<{itemId: string, supplierId: string} | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editObs, setEditObs] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  useEffect(() => {
    if (quotationId) {
        loadData();
    }
  }, [quotationId]);

  const loadData = async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
        const data = await quotationService.getMatrixData(quotationId);
        setItems(data.items);
        setSuppliers(data.suppliers);
        setPrices(data.prices);
        
        // Auto-selecionar os melhores preços iniciais (se não tiver seleção manual prévia)
        if (Object.keys(selections).length === 0) {
            const autoSelections: Record<string, string> = {};
            data.items.forEach(item => {
                const itemPrices = data.prices.filter(p => p.quotation_item_id === item.id);
                if (itemPrices.length > 0) {
                    const bestPrice = itemPrices.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
                    autoSelections[item.id] = bestPrice.supplier_id;
                }
            });
            setSelections(autoSelections);
        }

    } catch (error) {
        console.error("Erro Matrix:", error);
        addToast('error', 'Erro ao carregar matriz', 'Não foi possível buscar os dados.');
    } finally {
        setLoading(false);
    }
  };

  const handleSimulate = async () => {
      if (!quotationId) return;
      setGeneratingSim(true);
      try {
          await quotationService.simulateSupplierResponses(quotationId);
          await loadData();
          addToast('success', 'Simulação Concluída', 'Preços fictícios gerados para teste.');
      } catch (e) {
          addToast('error', 'Erro', 'Falha na simulação.');
      } finally {
          setGeneratingSim(false);
      }
  };

  // --- LÓGICA DE EDIÇÃO MANUAL ---
  const startEditing = (itemId: string, supplierId: string, currentPrice?: number, currentObs?: string) => {
      setEditingCell({ itemId, supplierId });
      setEditPrice(currentPrice ? currentPrice.toString() : '');
      setEditObs(currentObs || '');
  };

  const cancelEditing = () => {
      setEditingCell(null);
      setEditPrice('');
      setEditObs('');
  };

  const saveManualPrice = async () => {
      if (!editingCell || !quotationId) return;
      
      const priceValue = parseFloat(editPrice.replace(',', '.'));
      
      if (isNaN(priceValue) || priceValue < 0) {
          addToast('warning', 'Valor Inválido', 'Insira um preço válido.');
          return;
      }

      setIsSavingPrice(true);
      try {
          // Upsert no Supabase
          const payload = {
              quotation_item_id: editingCell.itemId,
              supplier_id: editingCell.supplierId,
              price: priceValue,
              obs: editObs,
              availability: true,
              is_winner: false,
              created_at: new Date().toISOString()
          };

          const { error } = await supabase
              .from('quotation_supplier_prices')
              .upsert(payload, { onConflict: 'quotation_item_id, supplier_id' });

          if (error) throw error;

          await loadData(); 
          cancelEditing();
          addToast('success', 'Preço Lançado', 'Valor atualizado na matriz.');

      } catch (error: any) {
          console.error(error);
          addToast('error', 'Erro ao Salvar', error.message);
      } finally {
          setIsSavingPrice(false);
      }
  };

  const toggleSelection = (itemId: string, supplierId: string) => {
      if (editingCell) return;
      setSelections(prev => ({ ...prev, [itemId]: supplierId }));
  };

  const handleProcessPurchase = async () => {
      if (!quotationId || Object.keys(selections).length === 0) {
          addToast('warning', 'Seleção Vazia', 'Selecione pelo menos um item para comprar.');
          return;
      }

      setIsSubmitting(true);
      try {
          await quotationService.processPurchase(quotationId, selections, eventId);
          addToast('success', 'Ordens Geradas!', 'As OCs foram criadas e a cotação finalizada.');
          navigate('/compras');
      } catch (error: any) {
          addToast('error', 'Erro no Processamento', error.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleExportPDF = () => {
      window.print(); // Simple approach, can be upgraded to jspdf
  };

  // --- CÁLCULOS ESTATÍSTICOS ---
  const stats = useMemo(() => {
      let selectedTotal = 0;
      let maxTotal = 0; 
      let countWithPrice = 0;
      let totalItems = items.length;

      // Calcular Cobertura
      const itemsWithAnyPrice = items.filter(item => 
          prices.some(p => p.quotation_item_id === item.id)
      ).length;
      const coverage = totalItems > 0 ? (itemsWithAnyPrice / totalItems) * 100 : 0;

      // Calcular Totais e Savings
      Object.keys(selections).forEach(itemId => {
          const supplierId = selections[itemId];
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (priceObj) {
              const item = items.find(i => i.id === itemId);
              const qty = item?.quantity || 1;
              selectedTotal += (priceObj.price * qty);
          }

          // Achar o maior preço para comparar savings
          const itemPrices = prices.filter(p => p.quotation_item_id === itemId).map(p => p.price);
          if (itemPrices.length > 0) {
              const maxPrice = Math.max(...itemPrices);
              const item = items.find(i => i.id === itemId);
              const qty = item?.quantity || 1;
              maxTotal += (maxPrice * qty);
              countWithPrice++;
          }
      });

      const avgItemValue = selectedTotal > 0 && countWithPrice > 0 ? selectedTotal / countWithPrice : 0;

      return { 
          selected: selectedTotal, 
          savings: maxTotal - selectedTotal,
          percent: maxTotal > 0 ? ((maxTotal - selectedTotal) / maxTotal) * 100 : 0,
          coverage,
          avgItemValue,
          responsesCount: prices.length
      };
  }, [items, prices, selections]);

  // --- FILTROS ---
  const filteredItems = items.filter(item => {
      const matchText = item.name.toLowerCase().includes(filterText.toLowerCase());
      
      let matchStatus = true;
      if (filterStatus === 'Sem Cotação') {
          matchStatus = !prices.some(p => p.quotation_item_id === item.id);
      } else if (filterStatus === 'Cotado') {
          matchStatus = prices.some(p => p.quotation_item_id === item.id);
      }

      return matchText && matchStatus;
  });

  const filteredSuppliers = suppliers.filter(sup => 
      !filterSupplier || sup.id === filterSupplier
  );

  if (loading) {
      return <div className="py-20 text-center flex flex-col items-center"><Loader2 className="animate-spin mb-4 text-blue-600" size={32}/><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Montando Matriz de Decisão...</p></div>;
  }

  if (items.length === 0) {
      return <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">Nenhum item nesta cotação.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 print:p-0">
      
      {/* --- DASHBOARD ESTATÍSTICO (NOVO) --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Selecionado</p>
              <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">R$ {stats.selected.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
              </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingDown size={12} className="text-green-500"/> Savings</p>
              <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-green-600">R$ {stats.savings.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className="text-xs font-bold text-green-500 mb-1">{stats.percent.toFixed(1)}%</span>
              </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cobertura</p>
              <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{width: `${stats.coverage}%`}}></div>
                  </div>
                  <span className="text-xs font-bold text-blue-600">{stats.coverage.toFixed(0)}%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{stats.responsesCount} preços recebidos</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Médio/Item</p>
              <span className="text-2xl font-black text-slate-800">R$ {stats.avgItemValue.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</span>
          </div>
      </div>

      {prices.length === 0 && (
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex justify-between items-center print:hidden">
              <div className="flex items-center gap-3 text-amber-800">
                  <AlertTriangle size={24}/>
                  <div>
                      <p className="font-bold text-sm">Aguardando Respostas</p>
                      <p className="text-xs">Use o botão de edição (lápis) nas células para inserir preços manualmente ou simule dados.</p>
                  </div>
              </div>
              <button onClick={handleSimulate} disabled={generatingSim} className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-2">
                  {generatingSim ? <Loader2 className="animate-spin" size={14}/> : <><RefreshCw size={14}/> Simular (Demo)</>}
              </button>
          </div>
      )}

      {/* --- BARRA DE FERRAMENTAS E FILTROS --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-100 p-2 rounded-2xl print:hidden">
          <div className="flex items-center gap-2 flex-1">
              <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input placeholder="Filtrar itens..." className="pl-9 pr-4 py-2 bg-white rounded-xl text-sm font-medium outline-none w-48" value={filterText} onChange={e => setFilterText(e.target.value)} />
              </div>
              <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                  <option value="">Todos Fornecedores</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option>Todos</option>
                  <option>Cotado</option>
                  <option>Sem Cotação</option>
              </select>
          </div>
          <div className="flex gap-2">
              <button onClick={handleExportPDF} className="p-2 bg-white text-slate-600 hover:text-blue-600 rounded-xl transition-all shadow-sm" title="Imprimir/PDF">
                  <FileText size={18}/>
              </button>
              <button className="p-2 bg-white text-slate-600 hover:text-green-600 rounded-xl transition-all shadow-sm" title="Exportar Excel">
                  <Download size={18}/>
              </button>
          </div>
      </div>

      {/* --- MATRIZ DE PREÇOS --- */}
      <div className="overflow-x-auto rounded-[32px] border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest min-w-[250px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                          Item Solicitado
                      </th>
                      {filteredSuppliers.map(sup => (
                          <th key={sup.id} className="p-6 text-center min-w-[200px]">
                              <div className="flex flex-col items-center group cursor-help">
                                  <span className="font-bold text-slate-800 text-sm">{sup.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold uppercase">{sup.city || 'Local'}</span>
                                      <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5"><Trophy size={10} fill="currentColor"/> {sup.rating}</span>
                                  </div>
                              </div>
                          </th>
                      ))}
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-5