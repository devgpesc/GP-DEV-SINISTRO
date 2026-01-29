import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldAlert, 
  DollarSign, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  CheckCircle,
  Loader2,
  Package,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Event } from '../types';

const KPICard = ({ title, value, change, trend, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon size={24} />
      </div>
      {change && (
        <div className={`flex items-center gap-1 text-sm font-bold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {change}
        </div>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  // Real Data State
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Timeout Ref
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper seguro para buscar dados mesmo se a tabela não existir
  const safeFetch = async (table: string) => {
    try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            if (error.code === '42P01') {
                return [];
            }
            console.warn(`Info: Tabela ${table} inacessível ou vazia.`);
            return [];
        }
        return data || [];
    } catch (err) {
        return [];
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    
    // Timeout de segurança: 10 segundos
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
        setLoading((prev) => {
            if (prev) {
                console.warn('Dashboard timeout forced.');
                return false;
            }
            return prev;
        });
    }, 10000);

    try {
        // Busca paralela otimizada sem verificações de conexão redundantes
        const [ordersData, eventsData] = await Promise.all([
            safeFetch('purchase_orders'),
            safeFetch('events')
        ]);

        setOrders(ordersData);
        setEvents(eventsData);

    } catch (err: any) {
        console.error("Erro ao carregar dashboard:", err);
    } finally {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    return () => {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    const totalPurchases = orders
        .filter(o => o.status !== 'Cancelada')
        .reduce((acc, curr) => acc + curr.total, 0);
    
    const savings = totalPurchases * 0.12; // Estimativa baseada em dados reais
    
    const openEvents = events.filter(e => e.status !== 'Concluído' && e.status !== 'Cancelado' as any).length;
    
    const activeOrders = orders.filter(o => o.status !== 'Cancelada').length;
    const avgTicket = activeOrders > 0 ? totalPurchases / activeOrders : 0;

    return { totalPurchases, savings, openEvents, avgTicket };
  }, [orders, events]);

  // --- CHARTS DATA ---
  const chartData = useMemo(() => {
    const months: any = {};
    const today = new Date();
    
    // Initialize last 6 months
    for(let i=5; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short' });
        months[key] = { name: key, custo: 0, economia: 0 };
    }

    orders.forEach(o => {
        if(o.status === 'Cancelada') return;
        const d = new Date(o.createdAt);
        const key = d.toLocaleString('default', { month: 'short' });
        if(months[key]) {
            months[key].custo += o.total;
            months[key].economia += (o.total * 0.12);
        }
    });

    return Object.values(months);
  }, [orders]);

  const statusData = useMemo(() => {
    const counts: any = {};
    events.forEach(e => {
        counts[e.status] = (counts[e.status] || 0) + 1;
    });
    
    const colors: any = { 'Aguardando': '#94a3b8', 'Em Cotação': '#3b82f6', 'Aprovado': '#22c55e', 'Concluído': '#1e293b' };
    
    return Object.keys(counts).map(status => ({
        name: status,
        value: counts[status],
        color: colors[status] || '#cbd5e1'
    }));
  }, [events]);

  const pendingOrders = orders.filter(o => o.status === 'Gerada').slice(0, 5);

  if (loading) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-300">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={48}/>
              <p className="font-bold text-xs uppercase tracking-[0.2em] animate-pulse">Atualizando Indicadores...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Total Compras" value={`R$ ${kpis.totalPurchases.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={ShoppingBag} color="blue" />
                <KPICard title="Economia Estimada" value={`R$ ${kpis.savings.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={TrendingDown} color="green" />
                <KPICard title="Eventos em Aberto" value={kpis.openEvents} trend="down" icon={ShieldAlert} color="amber" />
                <KPICard title="Ticket Médio" value={`R$ ${kpis.avgTicket.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={DollarSign} color="slate" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    Desempenho Financeiro
                    </h3>
                </div>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                        <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorEconomia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`}
                        />
                        <Area type="monotone" name="Custo" dataKey="custo" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCusto)" />
                        <Area type="monotone" name="Economia" dataKey="economia" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorEconomia)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
                </div>

                {/* Status Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-blue-600" />
                    Status dos Sinistros
                </h3>
                <div className="h-64 relative">
                    {statusData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={8}
                                dataKey="value"
                                >
                                {statusData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-3xl font-bold text-slate-800">{events.length}</span>
                                <span className="text-xs text-slate-500 font-medium">Eventos</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300">
                            <Database size={32} className="mb-2"/>
                            <p className="text-xs font-bold uppercase">Sem dados</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 space-y-2">
                    {statusData.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                        <span className="text-slate-600">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-800">{item.value}</span>
                    </div>
                    ))}
                </div>
                </div>
            </div>

            {/* Quick Actions & Pending */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">Aprovações Pendentes (OC)</h3>
                </div>
                <div className="space-y-4">
                    {pendingOrders.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <CheckCircle size={24} className="mx-auto mb-2 text-slate-300"/>
                            <p className="text-xs font-bold uppercase">Nenhuma pendência</p>
                        </div>
                    ) : (
                        pendingOrders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 group">
                            <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-blue-600">
                                <ShoppingBag size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{o.code}</p>
                                <p className="text-xs text-slate-500">Fornecedor ID: {o.supplierId}</p>
                            </div>
                            </div>
                            <div className="text-right">
                            <p className="font-bold text-slate-800">R$ {o.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Aguardando</span>
                            </div>
                        </div>
                        ))
                    )}
                </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6">Análise Rápida de Fornecedores</h3>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-center">
                        <div>
                            <Package size={24} className="mx-auto text-slate-300 mb-2"/>
                            <p className="text-xs text-slate-500">Sem alertas de fornecedores no momento.</p>
                        </div>
                    </div>
                </div>
                </div>
            </div>
    </div>
  );
};

export default Dashboard;