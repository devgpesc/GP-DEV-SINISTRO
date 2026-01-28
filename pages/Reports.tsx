
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingDown, Target, ShoppingBag, CheckCircle, Download, Printer, Car, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Delivery } from '../types';

const Reports: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    setLoading(true);
    try {
        const { data: pos } = await supabase.from('purchase_orders').select('*');
        const { data: dels } = await supabase.from('deliveries').select('*');
        
        setPurchaseOrders(pos || []);
        setDeliveries(dels || []);
    } catch (e) {
        console.error("Erro ao carregar relatórios", e);
    } finally {
        setLoading(false);
    }
  };

  const financialData = useMemo(() => {
    if (purchaseOrders.length === 0) {
        return [
            { name: 'Jan', total: 0 }, { name: 'Fev', total: 0 }, { name: 'Mar', total: 0 }
        ];
    }
    // Agrupamento simples (exemplo)
    return [{ name: 'Atual', total: purchaseOrders.reduce((acc, p) => acc + (p.total || 0), 0) }];
  }, [purchaseOrders]);

  const kpis = useMemo(() => {
    const totalSpent = purchaseOrders.reduce((acc, po) => acc + (po.total || 0), 0);
    const count = purchaseOrders.length || 1;
    return { 
        totalSavings: totalSpent * 0.15, 
        avgTicket: count > 0 ? totalSpent / count : 0, 
        sla: "2.4d" 
    };
  }, [purchaseOrders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Inteligência</h2>
            <p className="text-sm text-slate-500">Análise de performance e custos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-green-50 text-green-600 rounded-xl"><TrendingDown size={20}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Savings Estimado</p>
           </div>
           <h3 className="text-3xl font-black text-slate-800">R$ {kpis.totalSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Target size={20}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio</p>
           </div>
           <h3 className="text-3xl font-black text-slate-800">R$ {kpis.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><ShoppingBag size={20}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume OCs</p>
           </div>
           <h3 className="text-3xl font-black text-slate-800">{purchaseOrders.length}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
           <h3 className="text-lg font-black text-slate-800 mb-6">Gastos Totais</h3>
           <div className="flex-1 min-h-[300px]">
              {purchaseOrders.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={financialData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar name="Total Gasto" dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                     </BarChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <BarChart3 size={48} className="mb-2"/>
                      <p className="text-xs font-bold uppercase">Sem dados financeiros</p>
                  </div>
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-6">Status de Entregas</h3>
            <div className="flex-1 min-h-[300px] flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="text-center text-slate-400">
                    <p className="text-xs font-bold uppercase tracking-widest">Aguardando mais dados</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
