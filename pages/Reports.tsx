
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, TrendingDown, Target, ShoppingBag, CheckCircle, Download, 
  Printer, AlertTriangle, Calendar, Filter, Brain, RefreshCw, Loader2, DollarSign,
  PieChart as PieChartIcon, TrendingUp
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Delivery } from '../types';
import { aiService } from '../services/aiService';
import { useToast } from '../context/ToastContext';

// Helper para remover acentos e facilitar busca
const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const Reports: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Filtros
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [categoryFilter, setCategoryFilter] = useState('Todas Categorias');

  // Dados Reais
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [suppliersMap, setSuppliersMap] = useState<Record<string, string>>({});
  const [repurchasePeriodDays, setRepurchasePeriodDays] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const { data: pos } = await supabase.from('purchase_orders').select('*');
        const { data: dels } = await supabase.from('deliveries').select('*');
        const { data: evts } = await supabase.from('events').select('*');
        const { data: rels } = await supabase.from('quotation_item_releases').select('*');
        const { data: poi } = await supabase
          .from('purchase_order_items')
          .select('quotation_item_id, purchase_orders!inner(id, supplier_id, created_at)');
        const { data: sups } = await supabase.from('suppliers').select('id, name');
        
        setOrders(pos || []);
        setDeliveries(dels || []);
        setEvents(evts || []);
        setReleases(rels || []);
        setPoItems(poi || []);
        setSuppliersMap(
          Object.fromEntries((sups || []).map((s: any) => [s.id, s.name]))
        );
    } catch (e) {
        console.error("Erro ao carregar dados", e);
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    setAnalyzing(true);
    try {
      const dataSnapshot = {
        kpis: strategicKPIs,
        monthlySpend: chartData,
        pendingDeliveries: deliveries.filter(d => d.status === 'Pendente').length,
        openEvents: events.filter(e => e.status !== 'Concluído').length
      };

      const insight = await aiService.generateStrategicInsight({
        data: dataSnapshot,
        type: 'financial',
        context: 'O gestor precisa de uma análise focada em redução de desperdícios e eficiência de compras em português.'
      });

      setAiAnalysis(insight);
    } catch (e) {
      addToast('error', 'Erro na IA', 'Não foi possível gerar a análise.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- CÁLCULOS ESTRATÉGICOS (KPIs) ---
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.createdAt);

      // Filtro de Data Início (Correção de Timezone)
      if (dateRange.start) {
          // Divide a string YYYY-MM-DD para garantir o uso do fuso local
          const [year, month, day] = dateRange.start.split('-').map(Number);
          // Cria data no início do dia (00:00:00) localmente
          // Mês no JS é 0-indexado (Janeiro = 0)
          const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          
          if (orderDate < startDate) return false;
      }
      
      // Filtro de Data Fim (Correção de Timezone)
      if (dateRange.end) {
          const [year, month, day] = dateRange.end.split('-').map(Number);
          // Cria data no final do dia (23:59:59) localmente
          const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
          
          if (orderDate > endDate) return false;
      }

      // Filtro de Categoria (Com Normalização para ignorar acentos)
      if (categoryFilter !== 'Todas Categorias' && categoryFilter !== 'Todos') {
          if (!o.items || !Array.isArray(o.items)) return false;
          
          const searchCat = normalizeText(categoryFilter).replace(/s$/, ''); // Remove plural simples
          
          const hasCategory = o.items.some((item: any) => {
              const itemCat = normalizeText(item.category || item.type || '');
              const itemName = normalizeText(item.name || '');
              // Busca na categoria ou no nome do item
              return itemCat.includes(searchCat) || itemName.includes(searchCat);
          });
          
          if (!hasCategory) return false;
      }

      return true;
    });
  }, [orders, dateRange, categoryFilter]);

  const strategicKPIs = useMemo(() => {
    const totalSpent = filteredOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const completedOrders = filteredOrders.filter(o => o.status === 'Aprovada' || o.status === 'Recebida');
    
    // Estimativa de Economia (Mock lógica de negócio para demonstração)
    const estimatedMarketValue = totalSpent * 1.15; 
    const savings = estimatedMarketValue - totalSpent;
    
    return {
      totalSpent,
      savings,
      roi: totalSpent > 0 ? (savings / totalSpent) * 100 : 0,
      avgTicket: filteredOrders.length > 0 ? totalSpent / filteredOrders.length : 0,
      volume: filteredOrders.length,
      conversionRate: orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0
    };
  }, [filteredOrders, orders]);

  const repurchaseStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - repurchasePeriodDays);
    const releasesInPeriod = (releases || []).filter((r: any) => {
      if (!r?.created_at) return false;
      return new Date(r.created_at) >= cutoff;
    });

    const total = releasesInPeriod.length;
    const reasonsCount: Record<string, number> = {};
    releasesInPeriod.forEach((r: any) => {
      const reason = (r.reason || 'Sem motivo').trim();
      reasonsCount[reason] = (reasonsCount[reason] || 0) + 1;
    });
    const topReasons = Object.entries(reasonsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));
    return { total, topReasons };
  }, [releases, repurchasePeriodDays]);

  const supplierSwitchStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - repurchasePeriodDays);
    const releasesInPeriod = (releases || []).filter((r: any) => {
      if (!r?.created_at) return false;
      return new Date(r.created_at) >= cutoff;
    });
    const releaseItemIds = new Set(releasesInPeriod.map((r: any) => r.quotation_item_id));
    const itemOrdersMap: Record<string, Array<{ supplier_id: string; created_at: string }>> = {};

    (poItems || []).forEach((row: any) => {
      const itemId = row.quotation_item_id;
      if (!itemId || !releaseItemIds.has(itemId)) return;
      const order = row.purchase_orders;
      if (!order?.supplier_id) return;
      if (!itemOrdersMap[itemId]) itemOrdersMap[itemId] = [];
      itemOrdersMap[itemId].push({ supplier_id: order.supplier_id, created_at: order.created_at });
    });

    const comparisons = Object.entries(itemOrdersMap).map(([itemId, rows]) => {
      const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const original = sorted[0];
      const latest = sorted[sorted.length - 1];
      const changed = original?.supplier_id && latest?.supplier_id && original.supplier_id !== latest.supplier_id;
      return {
        itemId,
        changed: !!changed,
        originalSupplierId: original?.supplier_id || null,
        latestSupplierId: latest?.supplier_id || null,
      };
    });

    const switchedCount = comparisons.filter(c => c.changed).length;
    const sameSupplierCount = comparisons.filter(c => !c.changed).length;
    const examples = comparisons
      .filter(c => c.changed)
      .slice(0, 5)
      .map(c => ({
        itemId: c.itemId,
        originalSupplier: c.originalSupplierId ? (suppliersMap[c.originalSupplierId] || c.originalSupplierId) : 'N/A',
        newSupplier: c.latestSupplierId ? (suppliersMap[c.latestSupplierId] || c.latestSupplierId) : 'N/A',
      }));

    return { switchedCount, sameSupplierCount, analyzedItems: comparisons.length, examples };
  }, [releases, poItems, suppliersMap, repurchasePeriodDays]);

  // --- DADOS DOS GRÁFICOS ---
  const chartData = useMemo(() => {
    const grouped: any = {};
    filteredOrders.forEach(o => {
      const date = new Date(o.createdAt);
      // Formatação PT-BR para o gráfico
      const key = `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear()}`;
      // Chave de ordenação interna
      const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[sortKey]) grouped[sortKey] = { name: key, total: 0, savings: 0, rawDate: date };
      grouped[sortKey].total += o.total;
      grouped[sortKey].savings += (o.total * 0.15); 
    });
    
    return Object.keys(grouped).sort().map(k => grouped[k]);
  }, [filteredOrders]);

  const statusData = useMemo(() => {
    const counts: any = {};
    filteredOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [filteredOrders]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 print:p-0 print:bg-white">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Inteligência de Negócios</h2>
            <p className="text-sm text-slate-500 font-medium">Relatórios estratégicos para tomada de decisão.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={handleGenerateAnalysis} disabled={analyzing} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all hover:scale-105 disabled:opacity-70">
                {analyzing ? <Loader2 className="animate-spin" size={16}/> : <Brain size={16}/>}
                {analyzing ? 'Gerando Insights...' : 'IA Estratégica'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                <Printer size={16}/> PDF
            </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center print:hidden">
         <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest px-2">
            <Filter size={16}/> Filtros
         </div>
         <div className="flex items-center gap-2 flex-1">
            <input 
              type="date" 
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})} 
            />
            <span className="text-slate-300 font-bold">-</span>
            <input 
              type="date" 
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})} 
            />
         </div>
         <select className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option>Todas Categorias</option>
            <option>Peças</option>
            <option>Serviços</option>
         </select>
         <button onClick={() => { setDateRange({start: '', end: ''}); setCategoryFilter('Todas Categorias'); }} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Limpar Filtros"><RefreshCw size={16}/></button>
      </div>

      {/* Strategic KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Investimento Total</p>
               <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><DollarSign size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.totalSpent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1"><TrendingUp size={10} className="text-slate-400"/> Volume filtrado</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Economia (Savings)</p>
               <div className="p-2 bg-green-50 text-green-600 rounded-xl"><TrendingDown size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.savings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-green-500 mt-1 flex items-center gap-1"><CheckCircle size={10}/> ROI: {strategicKPIs.roi.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio</p>
               <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Target size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1">Por ordem de compra</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Conversão</p>
               <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><ShoppingBag size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">{strategicKPIs.conversionRate.toFixed(1)}%</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1">{strategicKPIs.volume} OCs totais</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Janela Gerencial de Recompra</p>
          <p className="text-xs font-medium text-slate-500">Aplicado em recompra/estorno e comparação de troca de fornecedor.</p>
        </div>
        <select
          value={repurchasePeriodDays}
          onChange={(e) => setRepurchasePeriodDays(Number(e.target.value) as 30 | 60 | 90)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600"
        >
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Recompras / Estornos</h3>
          <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-700 text-xs font-black">{repurchaseStats.total} liberações</span>
        </div>
        {repurchaseStats.topReasons.length === 0 ? (
          <p className="text-xs font-medium text-slate-400">Sem registros de recompra até o momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {repurchaseStats.topReasons.map((r, idx) => (
              <div key={`${r.reason}-${idx}`} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Motivo {idx + 1}</p>
                <p className="text-sm font-bold text-slate-700 line-clamp-2">{r.reason}</p>
                <p className="text-xs font-black text-amber-700 mt-2">{r.count} ocorrência(s)</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Fornecedor Original x Recompra</h3>
          <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-700 text-xs font-black">{supplierSwitchStats.analyzedItems} item(ns) analisado(s)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Trocaram fornecedor</p>
            <p className="text-2xl font-black text-amber-700">{supplierSwitchStats.switchedCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Sem troca</p>
            <p className="text-2xl font-black text-slate-700">{supplierSwitchStats.sameSupplierCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Taxa de troca</p>
            <p className="text-2xl font-black text-blue-700">
              {supplierSwitchStats.analyzedItems > 0
                ? `${((supplierSwitchStats.switchedCount / supplierSwitchStats.analyzedItems) * 100).toFixed(0)}%`
                : '0%'}
            </p>
          </div>
        </div>
        {supplierSwitchStats.examples.length > 0 ? (
          <div className="space-y-2">
            {supplierSwitchStats.examples.map((ex, idx) => (
              <div key={`${ex.itemId}-${idx}`} className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500">Item {ex.itemId.slice(0, 8)}...</span>
                <span className="text-xs font-black text-slate-700">{ex.originalSupplier}</span>
                <span className="text-xs font-bold text-slate-400">→</span>
                <span className="text-xs font-black text-blue-700">{ex.newSupplier}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-medium text-slate-400">Sem trocas de fornecedor registradas nas liberações de recompra.</p>
        )}
      </div>

      {/* AI Analysis Block */}
      {aiAnalysis && (
          <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-2xl shadow-indigo-900/20 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6"><Brain className="text-indigo-300"/> Análise Estratégica Visionária</h3>
                  <div className="prose prose-invert prose-sm max-w-none text-indigo-100 leading-relaxed whitespace-pre-wrap font-medium">
                      {aiAnalysis}
                  </div>
              </div>
          </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Financial Trend */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
           <h3 className="text-lg font-black text-slate-800 mb-6">Tendência de Despesas e Economia</h3>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
                    <Legend />
                    <Area type="monotone" dataKey="total" name="Despesa Real" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                    <Area type="monotone" dataKey="savings" name="Economia Gerada" stroke="#10b981" fillOpacity={1} fill="url(#colorSavings)" strokeWidth={3} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Operational Efficiency (Status) */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
           <h3 className="text-lg font-black text-slate-800 mb-6">Eficiência Operacional (Status)</h3>
           <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                        {statusData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
