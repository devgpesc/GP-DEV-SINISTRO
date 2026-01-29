
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, TrendingDown, Clock, ShoppingCart, Trophy, Truck, DollarSign, ArrowRight, Package, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface MatrixProps {
  eventId?: string; // ID do evento (UUID válido)
}

const MatrixTable: React.FC<MatrixProps> = ({ eventId }) => {
  const navigate = useNavigate();
  
  // Mock Data (Simulando resposta dos fornecedores na Matrix)
  // Em produção real, isso viria de uma tabela 'quotation_responses'
  const [items] = useState([
    { id: 'i1', name: 'Parachoque Dianteiro', quantity: 1 },
    { id: 'i2', name: 'Farol LED Direito', quantity: 1 },
    { id: 'i3', name: 'Grade Frontal', quantity: 1 },
  ]);

  const [suppliers] = useState([
    { id: 's1', name: 'TAURO Peças', rating: 4.8 },
    { id: 's2', name: 'REA Distribuidora', rating: 4.2 },
    { id: 's3', name: 'AutoZone Pro', rating: 4.5 }
  ]);

  // Preços Mockados (Simulação de respostas)
  // Estrutura: { [itemId]: { [supplierId]: price } }
  const [prices] = useState<any>({
    'i1': { 's1': 450.00, 's2': 480.00, 's3': 440.00 }, // s3 vence
    'i2': { 's1': 1200.00, 's2': 1150.00, 's3': 1250.00 }, // s2 vence
    'i3': { 's1': 300.00, 's2': 320.00, 's3': 310.00 }, // s1 vence
  });

  // Estado das seleções: { [itemId]: supplierId }
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-selecionar menores preços ao carregar
  useEffect(() => {
      const initialSelections: any = {};
      items.forEach(item => {
          let bestPrice = Infinity;
          let bestSupplier = '';
          suppliers.forEach(sup => {
              const price = prices[item.id]?.[sup.id];
              if (price && price < bestPrice) {
                  bestPrice = price;
                  bestSupplier = sup.id;
              }
          });
          if (bestSupplier) initialSelections[item.id] = bestSupplier;
      });
      setSelections(initialSelections);
  }, []);

  const totalCost = Object.keys(selections).reduce((acc, itemId) => {
      const supplierId = selections[itemId];
      return acc + (prices[itemId]?.[supplierId] || 0);
  }, 0);

  const handleSelection = (itemId: string, supplierId: string) => {
      setSelections(prev => ({ ...prev, [itemId]: supplierId }));
  };

  const handleEmitOCs = async () => {
    setIsSubmitting(true);
    
    // Agrupa itens por fornecedor vencedor
    const ordersBySupplier: Record<string, any> = {};

    Object.keys(selections).forEach(itemId => {
        const supplierId = selections[itemId];
        const itemData = items.find(i => i.id === itemId);
        const price = prices[itemId][supplierId];

        if (!ordersBySupplier[supplierId]) {
            ordersBySupplier[supplierId] = {
                supplierId,
                total: 0,
                items: []
            };
        }
        
        ordersBySupplier[supplierId].items.push({
            catalogId: itemId, // Mock ID
            name: itemData?.name,
            quantity: itemData?.quantity,
            price: price
        });
        ordersBySupplier[supplierId].total += price;
    });

    try {
        const promises = Object.values(ordersBySupplier).map(async (orderData: any) => {
            // CORREÇÃO CRÍTICA: Se eventId não for fornecido ou inválido, usa NULL ou busca um evento genérico válido no banco.
            // Para evitar erro 500, garantimos que o eventId seja um UUID válido se fornecido.
            
            const payload = {
                code: `OC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                eventId: eventId && eventId.length > 10 ? eventId : null, // Só envia se parecer UUID
                supplierId: null, // Em produção, vincularia ao UUID do fornecedor real
                total: orderData.total,
                items: orderData.items, // JSONB
                status: 'Gerada',
                createdAt: new Date().toISOString()
            };

            return supabase.from('purchase_orders').insert([payload]);
        });

        await Promise.all(promises);
        navigate('/compras');
        
    } catch (error: any) {
        alert('Erro ao processar OCs: ' + error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Resumo do Pedido */}
      <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
         <div>
             <h3 className="text-2xl font-black mb-1">Matriz de Decisão</h3>
             <p className="text-slate-400 font-medium text-sm">Selecione os vencedores clicando nas células de preço.</p>
         </div>
         <div className="text-right bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 min-w-[200px]">
             <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Selecionado</p>
             <p className="text-3xl font-black text-green-400">R$ {totalCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
         </div>
      </div>

      {/* Tabela Cruzada (Matrix) */}
      <div className="overflow-x-auto rounded-[32px] border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest min-w-[200px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Item Solicitado</th>
                      {suppliers.map(sup => (
                          <th key={sup.id} className="p-6 text-center min-w-[150px]">
                              <div className="flex flex-col items-center">
                                  <span className="font-bold text-slate-800">{sup.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1"><Trophy size={10} className="text-amber-500"/> {sup.rating}</span>
                              </div>
                          </th>
                      ))}
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 sticky left-0 bg-white border-r border-slate-100 z-10 font-bold text-slate-700">
                              {item.name}
                              <span className="block text-[10px] text-slate-400 font-black uppercase mt-1">Qtd: {item.quantity}</span>
                          </td>
                          {suppliers.map(sup => {
                              const price = prices[item.id]?.[sup.id];
                              const isSelected = selections[item.id] === sup.id;
                              const isBestPrice = Math.min(...suppliers.map(s => prices[item.id]?.[s.id] || Infinity)) === price;

                              return (
                                  <td key={sup.id} className="p-4 text-center">
                                      <button 
                                        onClick={() => handleSelection(item.id, sup.id)}
                                        className={`w-full py-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${
                                            isSelected 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                                            : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'
                                        }`}
                                      >
                                          {isBestPrice && !isSelected && (
                                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase border border-green-200 whitespace-nowrap shadow-sm">
                                                  Melhor Preço
                                              </div>
                                          )}
                                          <span className="text-sm font-black">R$ {price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                          {isSelected && <CheckCircle2 size={16} className="absolute top-2 right-2 text-blue-300"/>}
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
      <div className="flex justify-end pt-6">
          <button 
            onClick={handleEmitOCs} 
            disabled={isSubmitting}
            className="px-12 py-5 bg-green-600 text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-600/30 flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-70"
          >
              {isSubmitting ? 'Processando...' : 'Aprovar e Emitir OCs'} <ArrowRight size={20}/>
          </button>
      </div>
    </div>
  );
};

export default MatrixTable;
