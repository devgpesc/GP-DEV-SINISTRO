import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, TrendingDown, Clock, MessageSquare } from 'lucide-react';

interface MatrixProps {
  items: any[];
  suppliers: any[];
  onSelect: (itemId: string, supplierId: string) => void;
  selections: Record<string, string>; // itemId -> supplierId
}

const MatrixTable: React.FC<MatrixProps> = ({ items, suppliers, onSelect, selections }) => {
  // Mock data for prices - in a real app these come from QuoteResponse
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({
    'i1': { 's1': 450, 's2': 420, 's3': 460 },
    'i2': { 's1': 120, 's2': 150, 's3': 110 },
    'i3': { 's1': 800, 's2': 780, 's3': 850 },
  });

  const getLowestPrice = (itemId: string) => {
    const itemPrices = prices[itemId] || {};
    // Fix: Cast values to number[] to resolve 'unknown' type error on line 24
    const values = Object.values(itemPrices) as number[];
    if (values.length === 0) return null;
    return Math.min(...values);
  };

  const totalSelection = useMemo(() => {
    return Object.entries(selections).reduce((acc: number, [itemId, supplierId]) => {
      return acc + (prices[itemId]?.[supplierId] || 0);
    }, 0);
  }, [selections, prices]);

  const totalMarketAvg = useMemo(() => {
    return items.reduce((acc: number, item) => {
      // Fix: Cast Object.values result to number[] to avoid 'unknown' type errors on line 36
      const itemPrices = Object.values(prices[item.id] || {}) as number[];
      // Fix: Explicitly type reduce parameters to resolve '+' operator issues with 'unknown' types on line 36
      const avg = itemPrices.length ? itemPrices.reduce((a: number, b: number) => a + b, 0) / itemPrices.length : 0;
      return acc + avg;
    }, 0);
  }, [items, prices]);

  const economy = totalMarketAvg - totalSelection;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2">
          <TrendingDown size={18} className="text-blue-600" />
          Matriz Comparativa de Preços
        </h3>
        <div className="flex gap-4">
            <div className="text-right">
                <p className="text-xs text-slate-500">Investimento Total</p>
                <p className="font-bold text-slate-800">R$ {totalSelection.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
                <p className="text-xs text-slate-500">Economia Estimada</p>
                <p className="font-bold text-green-600">R$ {economy > 0 ? economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</p>
            </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-4 bg-slate-50 border-b border-r sticky left-0 z-10 w-64 text-sm font-semibold text-slate-600 uppercase">Item / Descrição</th>
              {suppliers.map(s => (
                <th key={s.id} className="p-4 bg-slate-50 border-b text-center min-w-[160px]">
                  <p className="text-sm font-bold text-slate-800">{s.name}</p>
                  <div className="flex justify-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${i < Math.floor(s.rating) ? 'bg-yellow-400' : 'bg-slate-200'}`}></span>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const minPrice = getLowestPrice(item.id);
              return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 border-b border-r sticky left-0 bg-white z-10 group">
                    <p className="font-medium text-slate-800">{item.description}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{item.category}</p>
                  </td>
                  {suppliers.map(s => {
                    const price = prices[item.id]?.[s.id];
                    const isMin = price === minPrice;
                    const isSelected = selections[item.id] === s.id;

                    return (
                      <td 
                        key={s.id} 
                        className={`p-4 border-b text-center cursor-pointer transition-all ${isSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => onSelect(item.id, s.id)}
                      >
                        <div className="relative">
                          {price ? (
                            <div className="space-y-1">
                              <p className={`text-lg font-bold ${isMin ? 'text-green-600' : 'text-slate-800'}`}>
                                R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                                <Clock size={12} /> 2-3 dias
                              </p>
                              {isMin && !isSelected && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                                  Menor Preço
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="absolute -top-2 -right-2 text-blue-600" size={20} />
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-300 flex flex-col items-center">
                              <AlertCircle size={20} />
                              <span className="text-[10px] mt-1">N/A</span>
                            </div>
                          )}
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
      
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
        <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-white">Exportar PDF</button>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700">Aprovar Seleção & Gerar OCs</button>
      </div>
    </div>
  );
};

export default MatrixTable;