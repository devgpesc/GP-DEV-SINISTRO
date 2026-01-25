
import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  Clock, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  Trash2,
  ChevronRight,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';
import { MOCK_SUPPLIERS } from '../constants';

interface MatrixProps {
  eventId?: string;
}

const MatrixTable: React.FC<MatrixProps> = ({ eventId }) => {
  const [items] = useState([
    { id: 'i1', description: 'Alma De Aço', quantity: 1, refPrice: 350 },
    { id: 'i2', description: 'Capo', quantity: 1, refPrice: 500 },
    { id: 'i3', description: 'Emblema', quantity: 1, refPrice: 45 },
    { id: 'i4', description: 'Farol Dianteiro Direito', quantity: 1, refPrice: 280 },
    { id: 'i5', description: 'Farol Dianteiro Esquerdo', quantity: 1, refPrice: 280 },
    { id: 'i6', description: 'Guia Do Para-choque', quantity: 1, refPrice: 320 },
  ]);

  const [suppliers] = useState([
    { id: 's1', name: 'TAURO', date: '02/12/2025' },
    { id: 's2', name: 'REA', date: '01/12/2025' }
  ]);

  const [quotes, setQuotes] = useState<Record<string, Record<string, { price: number; selected: boolean }>>>({
    'i1': { 's1': { price: 300, selected: false }, 's2': { price: 300, selected: true } },
    'i2': { 's1': { price: 400, selected: true }, 's2': { price: 490, selected: false } },
    'i3': { 's1': { price: 38, selected: false }, 's2': { price: 30, selected: true } },
    'i4': { 's1': { price: 239.59, selected: false }, 's2': { price: 199.19, selected: true } },
    'i5': { 's1': { price: 249.89, selected: false }, 's2': { price: 178.94, selected: true } },
    'i6': { 's1': { price: 300, selected: false }, 's2': { price: 259, selected: true } },
  });

  const lowestPrices = useMemo(() => {
    const result: Record<string, number> = {};
    items.forEach(item => {
      // Fix: Cast Object.values result to avoid "unknown" type error on price property (Line 62)
      const supplierQuotes = Object.values(quotes[item.id] || {}) as Array<{ price: number; selected: boolean }>;
      const prices = supplierQuotes.map(q => q.price).filter(p => p > 0);
      if (prices.length > 0) result[item.id] = Math.min(...prices);
    });
    return result;
  }, [items, quotes]);

  const stats = useMemo(() => {
    // Fix: Explicitly type the result of Object.values to fix "unknown" type errors on selected and price properties (Line 70)
    const selectedQuotes = Object.values(quotes).flatMap(q => 
      (Object.values(q) as Array<{ price: number; selected: boolean }>).filter(v => v.selected)
    );
    
    const totalGeral = selectedQuotes.reduce((acc, q) => acc + q.price, 0);
    
    // Economia: Média dos preços cotados vs Preço selecionado
    const totalMedia = items.reduce((acc, item) => {
      // Fix: Cast Object.values result to avoid "unknown" type error on price property
      const itemQuotes = Object.values(quotes[item.id] || {}) as Array<{ price: number; selected: boolean }>;
      const q = itemQuotes.map(v => v.price).filter(p => p > 0);
      const media = q.length > 0 ? q.reduce((a,b) => a+b, 0) / q.length : 0;
      return acc + media;
    }, 0);

    return {
      totalGeral,
      economia: totalMedia - totalGeral,
      cobertura: (items.filter(i => {
        // Fix: Cast Object.values result to avoid "unknown" type error on price property
        const itemQuotes = Object.values(quotes[i.id] || {}) as Array<{ price: number; selected: boolean }>;
        return itemQuotes.some(q => q.price > 0);
      }).length / items.length) * 100
    };
  }, [items, quotes]);

  const handleToggleSelection = (itemId: string, supplierId: string) => {
    setQuotes(prev => {
      const current = { ...prev[itemId] };
      Object.keys(current).forEach(sid => {
        current[sid] = { ...current[sid], selected: sid === supplierId ? !current[sid].selected : false };
      });
      return { ...prev, [itemId]: current };
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo Relacionado</p>
          <p className="font-black text-blue-600 text-lg">EVT-2024-001</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa do Veículo</p>
          <p className="font-bold text-slate-800">ABC-1234 (Corolla)</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Economia Estimada</p>
          <p className="font-black text-green-600 flex items-center gap-1.5"><TrendingDown size={18}/> R$ {stats.economia.toFixed(2)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SLA Cotação</p>
          <p className="font-bold text-slate-800 flex items-center gap-1.5"><Clock size={16} className="text-amber-500"/> 2h 45min restando</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-72">Item do Orçamento</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Qnt</th>
                {suppliers.map(s => (
                  <th key={s.id} className="px-6 py-4 border-l border-slate-100">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{s.date}</p>
                      <p className="text-blue-600 font-black">{s.name}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const minPrice = lowestPrices[item.id];
                return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-700 text-sm">{item.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Ref: R$ {item.refPrice.toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-500">{item.quantity}</td>
                    {suppliers.map(s => {
                      const quote = quotes[item.id]?.[s.id];
                      const isMin = quote?.price === minPrice && quote?.price > 0;
                      return (
                        <td key={s.id} className={`px-6 py-4 border-l border-slate-100 transition-all ${quote?.selected ? 'bg-blue-50/40' : ''}`}>
                          <div className="flex items-center justify-end gap-3">
                            <div className="text-right">
                               <p className={`font-black text-sm ${isMin ? 'text-blue-600' : 'text-slate-600'}`}>
                                 R$ {quote?.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                               </p>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={quote?.selected || false}
                              onChange={() => handleToggleSelection(item.id, s.id)}
                              className="w-4 h-4 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
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

      <div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 text-white">
        <div className="flex gap-12">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Itens</p>
            <p className="text-2xl font-black">{items.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cobertura</p>
            <p className="text-2xl font-black text-blue-400">{stats.cobertura.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Compra</p>
            <p className="text-2xl font-black text-green-400">R$ {stats.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        <div className="flex gap-4">
           <button className="px-6 py-3 bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2">
             <Printer size={16}/> Relatório PDF
           </button>
           <button className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 flex items-center gap-2">
             <ShoppingCart size={16}/> Gerar Ordens de Compra
           </button>
        </div>
      </div>
    </div>
  );
};

export default MatrixTable;
