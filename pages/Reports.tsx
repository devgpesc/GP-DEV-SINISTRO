
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
  const [filterDraft, setFilterDraft] = useState({ start: '', end: '', category: 'Todas Categorias' });
  const [filterError, setFilterError] = useState('');
  const todayIso = new Date().toISOString().slice(0, 10);

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
          .select('quotation_item_id, name, unit, quantity, total_price, purchase_orders!inner(id, supplier_id, quotation_id, status, total, created_at)');
        const { data: sups } = await supabase.from('suppliers').select('id, name');
        
        setOrders((pos || []).map((order: any) => ({
          ...order,
          createdAt: order.createdAt || order.created_at,
          total: Number(order.total) || 0,
        })));
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

  const updateStartDate = (value: string) => {
    if (value && value > todayIso) {
      setFilterError('A data inicial não pode estar no futuro.');
      return;
    }

    setFilterError('');
    setFilterDraft(current => ({
      ...current,
      start: value,
      end: current.end && value && current.end < value ? '' : current.end,
    }));
  };

  const updateEndDate = (value: string) => {
    if (value && value > todayIso) {
      setFilterError('A data final não pode estar no futuro.');
      return;
    }

    if (value && filterDraft.start && value < filterDraft.start) {
      setFilterError('A data final deve ser igual ou posterior à data inicial.');
      setFilterDraft(current => ({ ...current, end: '' }));
      return;
    }

    setFilterError('');
    setFilterDraft(current => ({ ...current, end: value }));
  };

  const applyFilters = () => {
    if (filterDraft.start && filterDraft.end && filterDraft.start > filterDraft.end) {
      setFilterError('A data inicial deve ser anterior ou igual à data final.');
      return;
    }
    if (filterDraft.start > todayIso || filterDraft.end > todayIso) {
      setFilterError('O período do relatório não pode conter datas futuras.');
      return;
    }
    setFilterError('');
    setDateRange({ start: filterDraft.start, end: filterDraft.end });
    setCategoryFilter(filterDraft.category);
  };

  const clearFilters = () => {
    const empty = { start: '', end: '', category: 'Todas Categorias' };
    setFilterDraft(empty);
    setFilterError('');
    setDateRange({ start: '', end: '' });
    setCategoryFilter('Todas Categorias');
  };

  // --- CÁLCULOS ESTRATÉGICOS (KPIs) ---
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const rawCreatedAt = o.createdAt || (o as any).created_at;
      const orderDate = rawCreatedAt ? new Date(rawCreatedAt) : null;

      // Filtro de Data Início (Correção de Timezone)
      if (dateRange.start) {
          // Divide a string YYYY-MM-DD para garantir o uso do fuso local
          const [year, month, day] = dateRange.start.split('-').map(Number);
          // Cria data no início do dia (00:00:00) localmente
          // Mês no JS é 0-indexado (Janeiro = 0)
          const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          
          if (!orderDate || Number.isNaN(orderDate.getTime()) || orderDate < startDate) return false;
      }
      
      // Filtro de Data Fim (Correção de Timezone)
      if (dateRange.end) {
          const [year, month, day] = dateRange.end.split('-').map(Number);
          // Cria data no final do dia (23:59:59) localmente
          const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
          
          if (!orderDate || Number.isNaN(orderDate.getTime()) || orderDate > endDate) return false;
      }

      // Filtro de Categoria (Com Normalização para ignorar acentos)
      if (categoryFilter !== 'Todas Categorias' && categoryFilter !== 'Todos') {
          const embeddedItems = Array.isArray(o.items) ? o.items : [];
          const linkedItems = (poItems || []).filter((row: any) => row.purchase_orders?.id === o.id);
          const orderItems = embeddedItems.length > 0 ? embeddedItems : linkedItems;
          const wantsServices = normalizeText(categoryFilter).startsWith('servic');
          const hasCategory = orderItems.some((item: any) => {
              const itemCat = normalizeText(item.category || item.type || '');
              const itemName = normalizeText(item.name || '');
              const unit = normalizeText(item.unit || '');
              const isService = itemCat.includes('servic') || itemName.includes('servic') || unit === 'hl';
              return wantsServices ? isService : !isService;
          });
          
          if (!hasCategory) return false;
      }

      return true;
    });
  }, [orders, poItems, dateRange, categoryFilter]);

  const financialOrders = useMemo(
    () => filteredOrders.filter((order) => order.status !== 'Cancelada' && order.status !== 'Devolvida'),
    [filteredOrders],
  );

  const reversalStats = useMemo(() => {
    const reversedOrders = filteredOrders.filter((order) => order.status === 'Cancelada' || order.status === 'Devolvida');
    return {
      cancelledOrders: reversedOrders.filter((order) => order.status === 'Cancelada').length,
      returnedOrders: reversedOrders.filter((order) => order.status === 'Devolvida').length,
      affectedQuotations: new Set(reversedOrders.map((order) => order.quotation_id || order.quotationId).filter(Boolean)).size,
      reversedValue: reversedOrders.reduce((sum, order) => sum + Number(order.reversed_amount || order.total || 0), 0),
    };
  }, [filteredOrders]);

  const strategicKPIs = useMemo(() => {
    const totalSpent = financialOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const completedOrders = financialOrders.filter(o => o.status === 'Aprovada' || o.status === 'Recebida');
    
    // Estimativa de Economia (Mock lógica de negócio para demonstração)
    const estimatedMarketValue = totalSpent * 1.15; 
    const savings = estimatedMarketValue - totalSpent;
    
    return {
      totalSpent,
      savings,
      roi: totalSpent > 0 ? (savings / totalSpent) * 100 : 0,
      avgTicket: financialOrders.length > 0 ? totalSpent / financialOrders.length : 0,
      volume: financialOrders.length,
      conversionRate: financialOrders.length > 0 ? (completedOrders.length / financialOrders.length) * 100 : 0
    };
  }, [financialOrders]);

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
      if (order.status === 'Cancelada' || order.status === 'Devolvida') return;
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
    financialOrders.forEach(o => {
      const date = new Date(o.createdAt || (o as any).created_at);
      if (Number.isNaN(date.getTime())) return;
      // Formatação PT-BR para o gráfico
      const key = `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear()}`;
      // Chave de ordenação interna
      const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[sortKey]) grouped[sortKey] = { name: key, total: 0, savings: 0, rawDate: date };
      grouped[sortKey].total += o.total;
      grouped[sortKey].savings += (o.total * 0.15); 
    });
    
    return Object.keys(grouped).sort().map(k => grouped[k]);
  }, [financialOrders]);

  const statusData = useMemo(() => {
    const counts: any = {};
    financialOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [financialOrders]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="report-page space-y-5 animate-in fade-in duration-300 pb-12 print:p-0 print:bg-white">
      <header className="report-print-header hidden">
        <div>
          <p className="report-print-kicker">EventsCar · Grupo ESC Sistemas</p>
          <h1>Relatório gerencial de sinistros e compras</h1>
          <p>Período: {dateRange.start ? new Date(`${dateRange.start}T00:00:00`).toLocaleDateString('pt-BR') : 'início da operação'} até {dateRange.end ? new Date(`${dateRange.end}T00:00:00`).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="report-print-meta">
          <strong>Emitido em</strong>
          <span>{new Date().toLocaleString('pt-BR')}</span>
          <strong>Categoria</strong>
          <span>{categoryFilter}</span>
        </div>
      </header>
      
      {/* Header & Actions */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center print:hidden">
        <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Análise gerencial</p>
            <h2 className="text-2xl font-bold text-slate-950">Relatórios operacionais e financeiros</h2>
            <p className="mt-1 text-sm text-slate-500">Indicadores, recompras e desempenho dos fornecedores.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={handleGenerateAnalysis} disabled={analyzing} className="flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-xs font-bold text-indigo-800 hover:bg-indigo-100">
                {analyzing ? <Loader2 className="animate-spin" size={16}/> : <Brain size={16}/>}
                {analyzing ? 'Gerando análise...' : 'Análise assistida'}
            </button>
            <button onClick={handlePrint} className="app-btn-primary gap-2">
                <Printer size={16}/> Imprimir / PDF
            </button>
        </div>
      </div>

      {/* Filters */}
      <div className="report-filters app-toolbar flex-col md:flex-row print:hidden">
         <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest px-2">
            <Filter size={16}/> Filtros
         </div>
         <div className="flex items-center gap-2 flex-1">
            <input 
              type="date" 
              max={filterDraft.end || todayIso}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              value={filterDraft.start}
              onInput={e => updateStartDate((e.currentTarget as HTMLInputElement).value)}
              onChange={e => updateStartDate(e.target.value)}
              aria-label="Data inicial"
            />
            <span className="text-slate-300 font-bold">-</span>
            <input 
              type="date" 
              min={filterDraft.start || undefined}
              max={todayIso}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              value={filterDraft.end}
              onInput={e => updateEndDate((e.currentTarget as HTMLInputElement).value)}
              onChange={e => updateEndDate(e.target.value)}
              aria-label="Data final"
            />
         </div>
         <select aria-label="Categoria" className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer" value={filterDraft.category} onChange={e => setFilterDraft(current => ({...current, category: e.target.value}))}>
            <option>Todas Categorias</option>
            <option>Peças</option>
            <option>Serviços</option>
         </select>
         <span className="whitespace-nowrap text-xs font-semibold text-slate-600">
           {filteredOrders.length} de {orders.length} ordem(ns)
         </span>
         <button type="button" onClick={applyFilters} className="app-btn-primary min-h-9 px-4">Aplicar filtros</button>
         <button type="button" onClick={clearFilters} className="app-icon-button" title="Limpar filtros" aria-label="Limpar filtros"><RefreshCw size={16}/></button>
         {filterError && <p role="alert" className="w-full text-xs font-semibold text-red-700 md:w-auto">{filterError}</p>}
      </div>

      {/* Strategic KPIs */}
      <div className="report-kpi-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="report-kpi app-panel flex flex-col justify-between p-4">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Investimento Total</p>
               <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><DollarSign size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.totalSpent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1"><TrendingUp size={10} className="text-slate-400"/> Volume filtrado</p>
        </div>

        <div className="report-kpi app-panel flex flex-col justify-between p-4">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Economia (Savings)</p>
               <div className="p-2 bg-green-50 text-green-600 rounded-xl"><TrendingDown size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.savings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-green-500 mt-1 flex items-center gap-1"><CheckCircle size={10}/> ROI: {strategicKPIs.roi.toFixed(1)}%</p>
        </div>

        <div className="report-kpi app-panel flex flex-col justify-between p-4">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio</p>
               <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Target size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">R$ {strategicKPIs.avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1">Por ordem de compra</p>
        </div>

        <div className="report-kpi app-panel flex flex-col justify-between p-4">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Conversão</p>
               <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><ShoppingBag size={18}/></div>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mt-2">{strategicKPIs.conversionRate.toFixed(1)}%</h3>
           <p className="text-[10px] font-bold text-slate-400 mt-1">{strategicKPIs.volume} OCs totais</p>
        </div>
      </div>

      <div className="app-panel grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden md:grid-cols-4 md:divide-y-0">
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">OCs canceladas</p><p className="mt-1 text-xl font-black text-red-700">{reversalStats.cancelledOrders}</p></div>
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">OCs devolvidas</p><p className="mt-1 text-xl font-black text-amber-700">{reversalStats.returnedOrders}</p></div>
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">Cotações afetadas</p><p className="mt-1 text-xl font-black text-slate-900">{reversalStats.affectedQuotations}</p></div>
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">Valor estornado / devolvido</p><p className="mt-1 text-xl font-black text-emerald-700">R$ {reversalStats.reversedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Fora do investimento e do ticket médio</p></div>
      </div>

      <div className="report-period app-panel flex items-center justify-between gap-3 p-4">
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

      <section className="report-section app-panel p-5">
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
      </section>

      <section className="report-section app-panel p-5">
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
      </section>

      {/* AI Analysis Block */}
      {aiAnalysis && (
          <section className="report-ai app-panel border-indigo-200 bg-indigo-50 p-5 animate-in slide-in-from-bottom-4 duration-300">
              <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-950"><Brain size={18} className="text-indigo-700"/> Análise assistida</h3>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-indigo-950">
                      {aiAnalysis}
                  </div>
              </div>
          </section>
      )}

      {/* Charts Section */}
      <div className="report-charts grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Financial Trend */}
        <section className="report-chart app-panel flex h-[340px] flex-col p-5">
           <h3 className="mb-4 text-sm font-bold text-slate-900">Tendência de despesas e economia</h3>
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
        </section>

        {/* Operational Efficiency (Status) */}
        <section className="report-chart app-panel flex h-[340px] flex-col p-5">
           <h3 className="mb-4 text-sm font-bold text-slate-900">Eficiência operacional por status</h3>
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
        </section>
      </div>

      <footer className="report-print-footer hidden">
        <span>EventsCar · Relatório gerencial confidencial</span>
        <span>Gerado automaticamente pelo sistema</span>
      </footer>
    </div>
  );
};

export default Reports;
