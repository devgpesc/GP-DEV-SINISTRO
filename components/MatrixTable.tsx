
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
  ChevronRight
} from 'lucide-react';
import { MOCK_SUPPLIERS } from '../constants';

interface MatrixProps {
  eventId?: string;
}

const MatrixTable: React.FC<MatrixProps> = ({ eventId }) => {
  // Dados simulados do modelo KompraX
  const [items, setItems] = useState([
    { id: 'i1', description: 'Alma De Aço', quantity: 1, refPrice: 0 },
    { id: 'i2', description: 'Capo', quantity: 1, refPrice: 0 },
    { id: 'i3', description: 'Emblema', quantity: 1, refPrice: 0 },
    { id: 'i4', description: 'Farol Dianteiro Direito', quantity: 1, refPrice: 0 },
    { id: 'i5', description: 'Farol Dianteiro Esquerdo', quantity: 1, refPrice: 0 },
    { id: 'i6', description: 'Guia Do Para-choque Dianteiro Direito', quantity: 1, refPrice: 0 },
  ]);

  const [suppliers] = useState([
    { id: 's1', name: 'TAURO', date: '02/12/2025' },
    { id: 's2', name: 'REA', date: '01/12/2025' }
  ]);

  // Preços e seleções ( itemId -> supplierId -> { price, selected } )
  const [quotes, setQuotes] = useState<Record<string, Record<string, { price: number; selected: boolean }>>>({
    'i1': { 's1': { price: 300, selected: false }, 's2': { price: 300, selected: true } },
    'i2': { 's1': { price: 400, selected: true }, 's2': { price: 490, selected: false } },
    'i3': { 's1': { price: 38, selected: false }, 's2': { price: 30, selected: true } },
    'i4': { 's1': { price: 239.59, selected: false }, 's2': { price: 199.19, selected: true } },
    'i5': { 's1': { price: 249.89, selected: false }, 's2': { price: 178.94, selected: true } },
    'i6': { 's1': { price: 300, selected: false }, 's2': { price: 259, selected: true } },
  });

  const handlePriceChange = (itemId: string, supplierId: string, value: string) => {
    const price = parseFloat(value.replace(',', '.')) || 0;
    setQuotes(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [supplierId]: { ...prev[itemId]?.[supplierId], price }
      }
    }));
  };

  const handleToggleSelection = (itemId: string, supplierId: string) => {
    setQuotes(prev => {
      const current = prev[itemId] || {};
      const newEntries = { ...current };
      
      // Desmarcar todos os outros fornecedores para este item (evitar compra duplicada)
      Object.keys(newEntries).forEach(sId => {
        newEntries[sId] = { ...newEntries[sId], selected: sId === supplierId ? !newEntries[sId].selected : false };
      });

      return { ...prev, [itemId]: newEntries };
    });
  };

  // Cálculos Inteligentes
  const lowestPrices = useMemo(() => {
    const result: Record<string, number> = {};
    items.forEach(item => {
      // Fix: Cast Object.values to explicit type to avoid 'unknown' property access errors in mapping
      const supplierQuotes = Object.values(quotes[item.id] || {}) as { price: number; selected: boolean }[];
      const prices = supplierQuotes
        .map(q => q.price)
        .filter(p => p > 0);
      if (prices.length > 0) result[item.id] = Math.min(...prices);
    });
    return result;
  }, [items, quotes]);

  const supplierTotals = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {};
    suppliers.forEach(s => totals[s.id] = { amount: 0, count: 0 });

    Object.entries(quotes).forEach(([itemId, supplierQuotes]) => {
      // Fix: Cast Object.entries to explicit type to avoid 'unknown' property access errors
      (Object.entries(supplierQuotes) as [string, { price: number; selected: boolean }][]).forEach(([supplierId, data]) => {
        if (data.selected && data.price > 0) {
          const item = items.find(i => i.id === itemId);
          const qty = item?.quantity || 1;
          totals[supplierId].amount += data.price * qty;
          totals[supplierId].count += 1;
        }
      });
    });
    return totals;
  }, [quotes, items, suppliers]);

  const stats = useMemo(() => {
    const totalItens = items.length;
    const orçamentosRecebidos = suppliers.length;
    const itensCotados = items.filter(i => {
      const q = quotes[i.id];
      // Fix: Cast Object.values to explicit type to avoid 'unknown' property access errors
      return q && (Object.values(q) as { price: number; selected: boolean }[]).some(p => p.price > 0);
    }).length;
    
    // Fix: Cast flattened Object.values results to explicit type to avoid 'unknown' property access errors
    const selectedValues = Object.values(quotes)
      .flatMap(q => Object.values(q) as { price: number; selected: boolean }[])
      .filter(v => v.selected)
      .map(v => v.price);
      
    const totalGeral = selectedValues.reduce((a, b) => a + b, 0);
    const mediaPorItem = totalGeral / (selectedValues.length || 1);

    return {
      totalItens,
      orçamentosRecebidos,
      itensCotados,
      cobertura: (itensCotados / totalItens) * 100,
      mediaPorItem,
      totalGeral
    };
  }, [items, suppliers, quotes]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Dados (Modelo KompraX) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Comprador Resp.:</p>
          <p className="text-sm font-bold text-slate-700">Osmair Fuck</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Veículo:</p>
          <p className="text-sm font-bold text-slate-700 truncate">Montana LS - Chevrolet (2015/2014) - Placa: OOA5J28</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Oficina de Entrega:</p>
          <p className="text-sm font-bold text-slate-700 truncate">LD REPARACOES AUTOMOTIVAS LTDA - Goiânia/GO</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Criação / Itens:</p>
          <p className="text-sm font-bold text-slate-700">01/12/2025 / 6 itens</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input type="text" placeholder="Filtrar Item..." className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="text-xs text-slate-500 font-medium">Mostrando {items.length} de {items.length} itens</div>
        </div>
        <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all">
          <FileSpreadsheet size={14} className="text-green-600" /> Exportar Excel
        </button>
      </div>

      {/* Tabela Matriz */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-3 border-b border-r text-left font-bold text-slate-500 uppercase tracking-wider w-64">Item</th>
                <th className="px-2 py-3 border-b border-r text-center font-bold text-slate-500 w-16">Qnt</th>
                <th className="px-3 py-3 border-b border-r text-center font-bold text-slate-500 w-24">Preço Ref.</th>
                {suppliers.map(s => (
                  <th key={s.id} className="px-4 py-3 border-b text-right font-bold text-slate-700">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 mb-0.5">{s.date}</span>
                      <span className="text-blue-600">{s.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const minPrice = lowestPrices[item.id];
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-2 border-r font-medium text-slate-700">{item.description}</td>
                    <td className="px-2 py-2 border-r text-center text-slate-600">{item.quantity}</td>
                    <td className="px-3 py-2 border-r text-center text-slate-400">-</td>
                    {suppliers.map(s => {
                      const quote = quotes[item.id]?.[s.id];
                      const isMin = quote?.price > 0 && quote?.price === minPrice;
                      
                      return (
                        <td key={s.id} className={`px-4 py-2 text-right transition-all ${quote?.selected ? 'bg-blue-50/50' : ''}`}>
                          <div className="flex items-center justify-end gap-2">
                            <input 
                              type="text" 
                              value={quote?.price > 0 ? quote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                              onChange={(e) => handlePriceChange(item.id, s.id, e.target.value)}
                              className={`w-20 bg-transparent text-right outline-none font-bold ${isMin ? 'text-blue-600' : 'text-slate-700'}`}
                            />
                            <input 
                              type="checkbox" 
                              checked={quote?.selected || false}
                              onChange={() => handleToggleSelection(item.id, s.id)}
                              className="w-3 h-3 rounded text-blue-600 focus:ring-0 cursor-pointer"
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

      {/* Itens Selecionados para Compra */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <TrendingDown size={18} className="text-blue-600" />
          Itens Selecionados para Compra
        </h4>
        <div className="space-y-3">
          {suppliers.map(s => {
            const total = supplierTotals[s.id];
            if (total.count === 0) return null;
            return (
              <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                    <span className="text-xs font-bold text-blue-600">{s.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">{total.count} item(s) selecionado(s)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-green-600">R$ {total.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-slate-100">
          <button 
            onClick={() => setQuotes(prev => {
              const reset = { ...prev };
              Object.keys(reset).forEach(itemId => {
                Object.keys(reset[itemId]).forEach(sId => {
                  reset[itemId][sId].selected = false;
                });
              });
              return reset;
            })}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-all shadow-lg shadow-slate-900/10"
          >
            <Trash2 size={16} /> Limpar Seleção
          </button>
          
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 shadow-sm text-slate-600">
              <Printer size={16} /> Print da Pré Cotação
            </button>
            <button className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 shadow-lg shadow-green-600/20">
              <CheckCircle2 size={16} /> Processar Compras ({items.length} itens - R$ {stats.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </button>
          </div>
        </div>
      </div>

      {/* Resumo Estatístico (Cards de Rodapé) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Total de Itens', value: stats.totalItens },
          { label: 'Orçamentos Recebidos', value: stats.orçamentosRecebidos },
          { label: 'Itens Cotados', value: stats.itensCotados },
          { label: 'Cobertura de Cotação', value: `${stats.cobertura.toFixed(0)}%` },
          { label: 'Valor Médio por Item', value: `R$ ${stats.mediaPorItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatrixTable;
