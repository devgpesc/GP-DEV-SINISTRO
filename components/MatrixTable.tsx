import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  Clock, 
  Printer, 
  ShoppingCart,
  Trophy,
  Truck,
  DollarSign,
  ArrowRight,
  Package,
  Check
} from 'lucide-react';
import { MOCK_SUPPLIERS } from '../constants';
import { mockStorage } from '../services/supabaseClient';

interface MatrixProps {
  eventId?: string;
}

interface MatrixItem {
  id: string;
  description: string;
  partNumber: string;
  quantity: number;
  refPrice: number; // Preço de mercado/referência
}

interface QuoteDetail {
  price: number;
  deliveryDays: number;
  available: boolean;
  selected: boolean;
  obs?: string;
}

const MatrixTable: React.FC<MatrixProps> = ({ eventId }) => {
  const navigate = useNavigate();

  // Mock de Itens da Cotação
  const [items] = useState<MatrixItem[]>([
    { id: 'i1', description: 'Alma De Aço Dianteira', partNumber: '52021-02190', quantity: 1, refPrice: 450.00 },
    { id: 'i2', description: 'Capô do Motor', partNumber: '53301-02300', quantity: 1, refPrice: 1200.00 },
    { id: 'i3', description: 'Emblema Frontal Toyota', partNumber: '90975-02085', quantity: 1, refPrice: 150.00 },
    { id: 'i4', description: 'Farol LED Direito', partNumber: '81110-02J80', quantity: 1, refPrice: 2800.00 },
    { id: 'i5', description: 'Farol LED Esquerdo', partNumber: '81150-02J80', quantity: 1, refPrice: 2800.00 },
    { id: 'i6', description: 'Guia do Para-choque LE', partNumber: '52116-02220', quantity: 1, refPrice: 85.00 },
  ]);

  // Mock de Fornecedores e suas respostas
  const [suppliers] = useState([
    { id: 's1', name: 'TAURO Peças', rating: 4.8 },
    { id: 's2', name: 'REA Distribuidora', rating: 4.2 },
    { id: 's3', name: 'AutoZone Pro', rating: 4.5 }
  ]);

  // Estado das Cotações (Matriz)
  const [quotes, setQuotes] = useState<Record<string, Record<string, QuoteDetail>>>({
    'i1': { 
      's1': { price: 390.00, deliveryDays: 2, available: true, selected: false },
      's2': { price: 410.00, deliveryDays: 1, available: true, selected: false },
      's3': { price: 0, deliveryDays: 0, available: false, selected: false }
    },
    'i2': { 
      's1': { price: 1100.00, deliveryDays: 5, available: true, selected: false },
      's2': { price: 1050.00, deliveryDays: 3, available: true, selected: false },
      's3': { price: 1150.00, deliveryDays: 2, available: true, selected: false }
    },
    'i3': { 
      's1': { price: 120.00, deliveryDays: 2, available: true, selected: false },
      's2': { price: 130.00, deliveryDays: 1, available: true, selected: false },
      's3': { price: 110.00, deliveryDays: 7, available: true, selected: false }
    },
    'i4': { 
      's1': { price: 2500.00, deliveryDays: 3, available: true, selected: false },
      's2': { price: 2600.00, deliveryDays: 2, available: true, selected: false },
      's3': { price: 2450.00, deliveryDays: 10, available: true, selected: false }
    },
    'i5': { 
      's1': { price: 2500.00, deliveryDays: 3, available: true, selected: false },
      's2': { price: 2600.00, deliveryDays: 2, available: true, selected: false },
      's3': { price: 2450.00, deliveryDays: 10, available: true, selected: false }
    },
    'i6': { 
      's1': { price: 80.00, deliveryDays: 1, available: true, selected: false },
      's2': { price: 75.00, deliveryDays: 2, available: true, selected: false },
      's3': { price: 70.00, deliveryDays: 5, available: true, selected: false }
    },
  });

  const [generatedOCs, setGeneratedOCs] = useState<any[] | null>(null);

  // Auto-selecionar o menor preço ao carregar
  useEffect(() => {
    const initialQuotes = { ...quotes };
    items.forEach(item => {
      let bestPrice = Infinity;
      let bestSupplierId = '';

      suppliers.forEach(s => {
        const q = initialQuotes[item.id]?.[s.id];
        if (q && q.available && q.price > 0 && q.price < bestPrice) {
          bestPrice = q.price;
          bestSupplierId = s.id;
        }
      });

      if (bestSupplierId) {
        Object.keys(initialQuotes[item.id]).forEach(sid => {
          initialQuotes[item.id][sid].selected = (sid === bestSupplierId);
        });
      }
    });
    setQuotes(initialQuotes);
  }, []);

  // Análise Estatística em Tempo Real
  const analysis = useMemo(() => {
    let totalRef = 0;
    let totalActual = 0;
    let totalItems = 0;
    let selectedItems = 0;

    items.forEach(item => {
      totalItems++;
      totalRef += item.refPrice;
      
      const supplierQuotes = quotes[item.id];
      if (supplierQuotes) {
        const selected = Object.values(supplierQuotes).find(q => q.selected);
        if (selected) {
          totalActual += selected.price;
          selectedItems++;
        }
      }
    });

    const savings = totalRef - totalActual;
    const savingsPercent = totalRef > 0 ? (savings / totalRef) * 100 : 0;

    return { totalRef, totalActual, savings, savingsPercent, coverage: (selectedItems/totalItems)*100 };
  }, [items, quotes]);

  const handleSelect = (itemId: string, supplierId: string) => {
    setQuotes(prev => {
      const itemQuotes = { ...prev[itemId] };
      // Desmarca todos deste item
      Object.keys(itemQuotes).forEach(sid => {
        itemQuotes[sid] = { ...itemQuotes[sid], selected: false };
      });
      // Marca o selecionado
      if (itemQuotes[supplierId].available) {
        itemQuotes[supplierId] = { ...itemQuotes[supplierId], selected: true };
      }
      return { ...prev, [itemId]: itemQuotes };
    });
  };

  const handleGenerateOrders = () => {
    // Agrupar itens por fornecedor
    const orders: Record<string, { supplierId: string, supplierName: string, items: any[], total: number }> = {};

    items.forEach(item => {
      const supplierQuotes = quotes[item.id];
      Object.entries(supplierQuotes).forEach(([supplierId, quote]) => {
        if (quote.selected) {
          if (!orders[supplierId]) {
            const sName = suppliers.find(s => s.id === supplierId)?.name || 'Desconhecido';
            orders[supplierId] = { supplierId, supplierName: sName, items: [], total: 0 };
          }
          orders[supplierId].items.push({ ...item, price: quote.price });
          orders[supplierId].total += quote.price;
        }
      });
    });

    setGeneratedOCs(Object.values(orders));
  };

  const handleConfirmEmission = () => {
    if (!generatedOCs) return;

    // Recupera OCs existentes
    const existingOrders = mockStorage.get('purchase_orders') || [];

    // Cria os objetos de OC baseados na seleção
    const newOrders = generatedOCs.map((oc, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      code: `OC-2024-${String(existingOrders.length + index + 4).padStart(3, '0')}`, // Continua a sequência (simulada)
      eventId: eventId || 'EVT-GENERIC',
      supplierId: oc.supplierId,
      total: oc.total,
      status: 'Gerada', // Status inicial
      createdAt: new Date().toISOString(),
      items: oc.items.map((i: any) => ({
        catalogId: i.id,
        name: i.description,
        quantity: i.quantity,
        price: i.price
      }))
    }));

    // Salva no storage (simulando persistência)
    const updatedList = [...newOrders, ...existingOrders];
    mockStorage.set('purchase_orders', updatedList);

    // Navega para a tela de compras
    navigate('/compras');
  };

  if (generatedOCs) {
    return (
      <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 animate-in zoom-in duration-300">
         <div className="text-center mb-10">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Cotação Finalizada com Sucesso!</h2>
            <p className="text-slate-500 mt-2">O sistema preparou <b>{generatedOCs.length} Ordens de Compra</b> baseadas na sua seleção.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {generatedOCs.map((oc, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-6 rounded-3xl relative overflow-hidden group hover:border-blue-300 transition-all">
                 <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase">
                    Nova OC
                 </div>
                 <h3 className="font-black text-slate-800 text-lg mb-1">{oc.supplierName}</h3>
                 <p className="text-xs text-slate-500 mb-4">{oc.items.length} itens selecionados</p>
                 
                 <div className="space-y-2 mb-6">
                    {oc.items.map((item: any, i: number) => (
                       <div key={i} className="flex justify-between text-xs border-b border-slate-200 pb-1 last:border-0">
                          <span className="text-slate-600 truncate max-w-[180px]">{item.description}</span>
                          <span className="font-bold text-slate-800">R$ {item.price.toFixed(2)}</span>
                       </div>
                    ))}
                 </div>

                 <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                    <span className="text-xs font-black text-slate-400 uppercase">Total OC</span>
                    <span className="text-xl font-black text-blue-600">R$ {oc.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                 </div>
              </div>
            ))}
         </div>

         <div className="flex justify-center gap-4">
            <button onClick={() => setGeneratedOCs(null)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Voltar para Matriz</button>
            <button 
                onClick={handleConfirmEmission} 
                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
               <ShoppingCart size={16}/> Confirmar e Emitir OCs
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* KPI Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Referência (FIPE/Mercado)</p>
           <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Package size={20}/></div>
              <p className="text-2xl font-black text-slate-400 line-through decoration-slate-300">
                 R$ {analysis.totalRef.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-green-100 to-transparent rounded-bl-full"></div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Negociado (Atual)</p>
           <div className="flex items-center gap-2 relative z-10">
              <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/30"><DollarSign size={20}/></div>
              <p className="text-3xl font-black text-blue-600">
                 R$ {analysis.totalActual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 group-hover:scale-110 transition-transform">
              <TrendingDown size={64} className="text-green-600"/>
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Economia Gerada (Saving)</p>
           <div className="flex items-center gap-3">
              <p className="text-3xl font-black text-green-600">
                 R$ {analysis.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-1 rounded-lg">
                -{analysis.savingsPercent.toFixed(1)}%
              </span>
           </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center text-white">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">SLA Cotação</p>
           <div className="flex items-center gap-2 text-amber-400 font-black text-xl">
              <Clock size={24}/>
              01h 45min
           </div>
           <p className="text-[9px] text-slate-500 mt-1">Restante para encerramento</p>
        </div>
      </div>

      {/* Matriz Comparativa */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[300px]">Item / Part Number</th>
                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ref.</th>
                {suppliers.map(s => (
                  <th key={s.id} className="px-4 py-4 min-w-[200px] border-l border-slate-100 bg-slate-50/50">
                    <div className="flex flex-col items-center">
                      <span className="font-black text-slate-800 text-sm">{s.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                         <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold">★ {s.rating}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                // Calcular melhor preço e melhor prazo para este item
                const itemQuotesVals = Object.values(quotes[item.id] || {});
                const validQuotes = itemQuotesVals.filter(q => q.available && q.price > 0);
                const minPrice = validQuotes.length > 0 ? Math.min(...validQuotes.map(q => q.price)) : 0;
                const minDays = validQuotes.length > 0 ? Math.min(...validQuotes.map(q => q.deliveryDays)) : 999;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><Package size={16}/></div>
                         <div>
                            <p className="font-bold text-slate-800 text-sm">{item.description}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">PN: {item.partNumber}</p>
                         </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-5 text-center">
                       <span className="text-xs font-bold text-slate-400 line-through">
                          {item.refPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                       </span>
                    </td>

                    {suppliers.map(s => {
                      const quote = quotes[item.id]?.[s.id];
                      const isBestPrice = quote?.price === minPrice && quote?.available;
                      const isFastest = quote?.deliveryDays === minDays && quote?.available;
                      const isSelected = quote?.selected;
                      const savings = item.refPrice - (quote?.price || 0);
                      const savingsPct = (savings / item.refPrice) * 100;

                      if (!quote || !quote.available) {
                         return (
                            <td key={s.id} className="px-4 py-5 border-l border-slate-50 text-center bg-slate-50/30">
                               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sem Cotação</span>
                            </td>
                         );
                      }

                      return (
                        <td 
                           key={s.id} 
                           onClick={() => handleSelect(item.id, s.id)}
                           className={`px-4 py-2 border-l border-slate-50 cursor-pointer relative transition-all duration-300 ${isSelected ? 'bg-blue-50/60 shadow-inner' : ''}`}
                        >
                           <div className={`p-3 rounded-2xl border transition-all ${isSelected ? 'border-blue-500 bg-white shadow-md scale-105' : 'border-transparent hover:border-slate-200'}`}>
                              
                              {/* Header da Célula: Preço */}
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <p className={`text-base font-black ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                       R$ {quote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    {isBestPrice && (
                                       <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md w-fit mt-1">
                                          <Trophy size={10}/> MELHOR PREÇO
                                       </span>
                                    )}
                                 </div>
                                 {isSelected && <div className="bg-blue-600 text-white p-1 rounded-full"><Check size={12}/></div>}
                              </div>

                              {/* Footer da Célula: SLA e Savings */}
                              <div className="flex justify-between items-end">
                                 <div className="text-[10px] font-bold text-slate-500 flex flex-col">
                                    <span className={`flex items-center gap-1 ${isFastest ? 'text-indigo-600' : ''}`}>
                                       {isFastest && <Truck size={10}/>} {quote.deliveryDays} dias
                                    </span>
                                 </div>
                                 
                                 {savingsPct > 0 ? (
                                    <span className="text-[9px] font-black text-green-600">-{savingsPct.toFixed(0)}%</span>
                                 ) : (
                                    <span className="text-[9px] font-black text-red-400">+{Math.abs(savingsPct).toFixed(0)}%</span>
                                 )}
                              </div>

                           </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-lg sticky bottom-6 z-20">
         <div className="flex items-center gap-6">
            <div className="text-right border-r border-slate-200 pr-6">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens Cobertos</p>
               <p className="text-xl font-black text-slate-800">{analysis.coverage.toFixed(0)}%</p>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total da Compra</p>
               <p className="text-2xl font-black text-blue-600">R$ {analysis.totalActual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
         </div>

         <div className="flex gap-3">
            <button className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 flex items-center gap-2 transition-all">
               <Printer size={18}/> PDF
            </button>
            <button 
               onClick={handleGenerateOrders}
               className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-3"
            >
               Gerar Ordens de Compra <ArrowRight size={18}/>
            </button>
         </div>
      </div>

    </div>
  );
};

export default MatrixTable;