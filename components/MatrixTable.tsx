
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, TrendingDown, ShoppingCart, Trophy, DollarSign, ArrowRight, Loader2, AlertTriangle, RefreshCw, XCircle, Edit2, Save, X, MessageSquare } from 'lucide-react';
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
        
        // Auto-selecionar os melhores preços iniciais
        const autoSelections: Record<string, string> = {};
        data.items.forEach(item => {
            const itemPrices = data.prices.filter(p => p.quotation_item_id === item.id);
            if (itemPrices.length > 0) {
                // Encontra menor preço
                const bestPrice = itemPrices.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
                autoSelections[item.id] = bestPrice.supplier_id;
            }
        });
        setSelections(autoSelections);

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
          // Upsert no Supabase (Atualiza ou Cria)
          const payload = {
              quotation_item_id: editingCell.itemId,
              supplier_id: editingCell.supplierId,
              price: priceValue,
              obs: editObs,
              availability: true,
              is_winner: false,
              created_at: new Date().toISOString() // Atualiza timestamp
          };

          const { error } = await supabase
              .from('quotation_supplier_prices')
              .upsert(payload, { onConflict: 'quotation_item_id, supplier_id' });

          if (error) throw error;

          // Recarrega dados para atualizar totais e melhores preços
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
  // -----------------------------

  const toggleSelection = (itemId: string, supplierId: string) => {
      if (editingCell) return; // Não seleciona se estiver editando
      setSelections(prev => ({ ...prev, [itemId]: supplierId }));
  };

  const calculateTotals = () => {
      let selectedTotal = 0;
      let maxTotal = 0; 

      Object.keys(selections).forEach(itemId => {
          const supplierId = selections[itemId];
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (priceObj) {
              const item = items.find(i => i.id === itemId);
              const qty = item?.quantity || 1;
              selectedTotal += (priceObj.price * qty);
          }

          const itemPrices = prices.filter(p => p.quotation_item_id === itemId).map(p => p.price);
          if (itemPrices.length > 0) {
              const maxPrice = Math.max(...itemPrices);
              const item = items.find(i => i.id === itemId);
              const qty = item?.quantity || 1;
              maxTotal += (maxPrice * qty);
          }
      });

      return { 
          selected: selectedTotal, 
          savings: maxTotal - selectedTotal,
          percent: maxTotal > 0 ? ((maxTotal - selectedTotal) / maxTotal) * 100 : 0
      };
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

  const totals = calculateTotals();

  if (loading) {
      return <div className="py-20 text-center flex flex-col items-center"><Loader2 className="animate-spin mb-4 text-blue-600" size={32}/><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Montando Matriz de Decisão...</p></div>;
  }

  if (items.length === 0) {
      return <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">Nenhum item nesta cotação.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Resumo Inteligente (Header) */}
      <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-8 relative overflow-hidden">
         <div className="relative z-10">
             <h3 className="text-2xl font-black mb-1 flex items-center gap-2"><ShoppingCart className="text-blue-400"/> Matriz de Decisão</h3>
             <p className="text-slate-400 font-medium text-sm">Clique no ícone de lápis para inserir preços manualmente ou clique no valor para eleger o vencedor.</p>
         </div>
         
         <div className="flex gap-8 relative z-10">
             <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Custo Total</p>
                 <p className="text-3xl font-black text-white">R$ {totals.selected.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
             </div>
             <div className="text-right pl-8 border-l border-slate-700">
                 <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1 flex items-center justify-end gap-1"><TrendingDown size={14}/> Economia (Savings)</p>
                 <p className="text-3xl font-black text-green-400">R$ {totals.savings.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                 <p className="text-xs font-bold text-green-600">{totals.percent.toFixed(1)}%</p>
             </div>
         </div>

         {/* Background Decor */}
         <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none"></div>
      </div>

      {prices.length === 0 && (
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex justify-between items-center">
              <div className="flex items-center gap-3 text-amber-800">
                  <AlertTriangle size={24}/>
                  <div>
                      <p className="font-bold text-sm">Aguardando Respostas</p>
                      <p className="text-xs">Nenhum preço lançado. Use o botão de edição nas células ou simule dados.</p>
                  </div>
              </div>
              <button 
                onClick={handleSimulate} 
                disabled={generatingSim}
                className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-2"
              >
                  {generatingSim ? <Loader2 className="animate-spin" size={14}/> : <><RefreshCw size={14}/> Simular Respostas (Demo)</>}
              </button>
          </div>
      )}

      {/* Tabela Cruzada (Matrix) */}
      <div className="overflow-x-auto rounded-[32px] border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest min-w-[250px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                          Item Solicitado
                      </th>
                      {suppliers.map(sup => (
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
                  {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Coluna Fixa do Item */}
                          <td className="p-6 sticky left-0 bg-white border-r border-slate-100 z-10 font-bold text-slate-700 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <span className="block text-sm">{item.name}</span>
                                      <span className="text-[10px] text-slate-400 font-black uppercase mt-1 bg-slate-50 px-2 py-0.5 rounded inline-block border border-slate-100">
                                          {item.quantity} {item.unit}
                                      </span>
                                  </div>
                                  {selections[item.id] && <CheckCircle2 size={18} className="text-green-500"/>}
                              </div>
                          </td>

                          {/* Células de Preço (Interativas) */}
                          {suppliers.map(sup => {
                              const priceObj = prices.find(p => p.quotation_item_id === item.id && p.supplier_id === sup.id);
                              
                              // Lógica de Melhor Preço da Linha
                              const rowPrices = prices.filter(p => p.quotation_item_id === item.id).map(p => p.price);
                              const minPrice = rowPrices.length > 0 ? Math.min(...rowPrices) : 0;
                              const isBestPrice = priceObj && priceObj.price === minPrice;
                              const isSelected = selections[item.id] === sup.id;
                              
                              // Modo Edição
                              const isEditing = editingCell?.itemId === item.id && editingCell?.supplierId === sup.id;

                              if (isEditing) {
                                  return (
                                      <td key={sup.id} className="p-2 relative">
                                          <div className="bg-white border-2 border-blue-500 rounded-2xl p-3 shadow-lg z-30 animate-in zoom-in duration-200">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <span className="text-xs font-bold text-slate-500">R$</span>
                                                  <input 
                                                    autoFocus
                                                    type="number" 
                                                    className="w-full font-black text-slate-800 outline-none border-b border-slate-200 focus:border-blue-500" 
                                                    value={editPrice}
                                                    onChange={e => setEditPrice(e.target.value)}
                                                    placeholder="0.00"
                                                  />
                                              </div>
                                              <input 
                                                className="w-full text-[10px] font-medium text-slate-500 outline-none bg-slate-50 p-1.5 rounded mb-2"
                                                placeholder="Obs (Marca/Prazo)..."
                                                value={editObs}
                                                onChange={e => setEditObs(e.target.value)}
                                              />
                                              <div className="flex justify-end gap-1">
                                                  <button onClick={cancelEditing} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500"><X size={14}/></button>
                                                  <button onClick={saveManualPrice} disabled={isSavingPrice} className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                                                      {isSavingPrice ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                                                  </button>
                                              </div>
                                          </div>
                                      </td>
                                  )
                              }

                              if (!priceObj) {
                                  return (
                                    <td key={sup.id} className="p-4 text-center group/cell relative">
                                        <div 
                                            onClick={() => startEditing(item.id, sup.id)}
                                            className="w-full py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-300 font-medium flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200 transition-all"
                                        >
                                            <XCircle size={14} className="group-hover/cell:hidden" /> 
                                            <Edit2 size={14} className="hidden group-hover/cell:block" />
                                            <span className="group-hover/cell:hidden">Sem Cotação</span>
                                            <span className="hidden group-hover/cell:inline font-bold">Lançar Preço</span>
                                        </div>
                                    </td>
                                  );
                              }

                              return (
                                  <td key={sup.id} className="p-3 text-center relative group/cell">
                                      {/* Edit Button Overlay */}
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); startEditing(item.id, sup.id, priceObj.price, priceObj.obs); }}
                                        className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-blue-600 rounded-full shadow-sm border border-slate-100 opacity-0 group-hover/cell:opacity-100 transition-opacity z-20"
                                        title="Editar Valor"
                                      >
                                          <Edit2 size={12}/>
                                      </button>

                                      <button 
                                        onClick={() => toggleSelection(item.id, sup.id)}
                                        className={`w-full py-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative group ${
                                            isSelected 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 z-10' 
                                            : isBestPrice 
                                                ? 'bg-green-50 border-green-300 text-slate-800 hover:border-green-500 shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:shadow-md'
                                        }`}
                                      >
                                          {isBestPrice && !isSelected && (
                                              <div className="absolute -top-3 bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm border border-white">
                                                  Melhor Preço
                                              </div>
                                          )}
                                          
                                          <span className="text-sm font-black flex items-center gap-1">
                                              <span className="opacity-50 text-[10px]">R$</span> 
                                              {priceObj.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                          </span>
                                          
                                          <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                              Total: R$ {(priceObj.price * item.quantity).toLocaleString('pt-BR', {maximumFractionDigits: 0})}
                                          </span>

                                          {priceObj.obs && (
                                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2" title={priceObj.obs}>
                                                  <MessageSquare size={10} className={isSelected ? 'text-blue-300' : 'text-slate-300'}/>
                                              </div>
                                          )}
                                      </button>
                                  </td>
                              );
                          })}
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* Ações Finais */}
      <div className="flex justify-end pt-6 pb-20">
          <button 
            onClick={handleProcessPurchase} 
            disabled={isSubmitting || prices.length === 0}
            className="px-12 py-5 bg-green-600 text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-600/30 flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-70 disabled:scale-100 disabled:shadow-none"
          >
              {isSubmitting ? <Loader2 className="animate-spin"/> : <><DollarSign size={20}/> Aprovar e Gerar OCs <ArrowRight size={20}/></>}
          </button>
      </div>
    </div>
  );
};

export default MatrixTable;
