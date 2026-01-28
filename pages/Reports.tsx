
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingDown, Target, ShoppingBag, CheckCircle, Download, Printer, Car } from 'lucide-react';
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
    const { data: pos } = await supabase.from('purchase_orders').select('*');
    const { data: dels } = await supabase.from('deliveries').select('*');
    
    setPurchaseOrders(pos || []);
    setDeliveries(dels || []);
    setLoading(false);
  };

  const financialData = useMemo(() => {
    // Processamento simples para não quebrar gráfico se vazio
    if (purchaseOrders.length === 0) return [];
    return [{ name: 'Atual', total: purchaseOrders.reduce((acc, p) => acc + p.total, 0), economy: 0 }];
  }, [purchaseOrders]);

  const kpis = useMemo(() => {
    const totalSpent = purchaseOrders.reduce((acc, po) => acc + po.total, 0);
    return { totalSavings: totalSpent * 0.15, avgTicket: totalSpent / (purchaseOrders.length || 1), sla: "2.4d" };
  }, [purchaseOrders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Inteligência</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Savings Acumulado</p>
           <h3 className="text-3xl font-black text-slate-800">R$ {kpis.totalSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={financialData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar name="Total Gasto" dataKey="total" fill="#3b82f6" />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
