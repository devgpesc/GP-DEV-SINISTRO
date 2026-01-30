
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Clock, ShieldAlert, DollarSign, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Database, CheckCircle, Loader2, Package,
  WifiOff, RefreshCw, Plus, FileText, Car, User
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Event } from '../types';
import { useAuth } from '../context/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM;

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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificação de Role
  const isExecutive = profile?.role === 'Admin' || profile?.role === 'Gerente' || profile?.role === 'super_admin';

  const safeFetch = async (table: string) => {
    try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) return [];
        return data || [];
    } catch (err) {
        return [];
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
        setLoading((prev) => prev ? false : prev);
    }, 10000);

    try {
        // Se for usuário comum, carregamos menos dados (apenas eventos para contagem)
        const promises = [safeFetch('events')];
        if (isExecutive) {
            promises.push(safeFetch('purchase_orders'));
        }

        const results = await Promise.all(promises);
        setEvents(results[0]);
        if (isExecutive) {
            setOrders(results[1]);
        }
    } catch (err: any) {
        console.error("Erro dashboard:", err);
    } finally {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
        loadDashboardData();
    }
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, [profile?.id, profile?.role]); // Depend on primitives to prevent loops

  // --- KPI CALCULATIONS (Executive Only) ---
  const kpis = useMemo(() => {
    if (!isExecutive) return null;
    const totalPurchases = orders.filter(o => o.status !== 'Cancelada').reduce((acc, curr) => acc + curr.total, 0);
    const savings = totalPurchases * 0.12; 
    const openEvents = events.filter(e => e.status !== 'Concluído').length;
    const activeOrders = orders.filter(o => o.status !== 'Cancelada').length;
    const avgTicket = activeOrders > 0 ? totalPurchases / activeOrders : 0;
    return { totalPurchases, savings, openEvents, avgTicket };
  }, [orders, events, isExecutive]);

  // --- CHARTS DATA (Executive Only) ---
  const chartData = useMemo(() => {
    if (!isExecutive) return [];
    const months: any = {};
    const today = new Date();
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
  }, [orders, isExecutive]);

  const statusData = useMemo(() => {
    const counts: any = {};
    events.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    const colors: any = { 'Aguardando': '#94a3b8', 'Em Cotação': '#3b82f6', 'Aprovado': '#22c55e', 'Concluído': '#1e293b' };
    return Object.keys(counts).map(status => ({ name: status, value: counts[status], color: colors[status] || '#cbd5e1' }));
  }, [events]);

  if (loading) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-300">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={48}/>
              <p className="font-bold text-xs uppercase tracking-[0.2em] animate-pulse">Carregando...</p>
          </div>
      );
  }

  // --- DASHBOARD OPERACIONAL (USUÁRIO COMUM) ---
  if (!isExecutive) {
      return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[32px] p-10 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-black mb-2">Olá, {profile?.full_name?.split(' ')[0] || 'Colaborador'}!</h2>
                    <p className="text-blue-100 font-medium max-w-xl">Bem-vindo ao AutoClaims Pro. Selecione uma ação abaixo para começar seu dia de trabalho.</p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link to="/eventos" className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText size={100} className="text-blue-600"/>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                        <ShieldAlert size={28}/>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Meus Sinistros</h3>
                    <p className="text-sm text-slate-500 font-medium mb-6">Acompanhe o andamento dos processos e registre novos eventos.</p>
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider">
                        Acessar <ArrowUpRight size={18}/>
                    </div>
                </Link>

                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Clock size={20} className="text-blue-600"/> Resumo Rápido</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm font-bold text-slate-600">Eventos Ativos</span>
                                <span className="bg-white px-3 py-1 rounded-lg text-sm font-black text-slate-800 shadow-sm border border-slate-100">{events.length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="text-sm font-bold text-slate-600">Aguardando Ação</span>
                                <span className="bg-amber-100 px-3 py-1 rounded-lg text-sm font-black text-amber-700 border border-amber-200">
                                    {events.filter(e => e.status === 'Aguardando' || e.status === 'Em Cotação').length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- DASHBOARD EXECUTIVO (ADMIN/GERENTE) ---
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Total Compras" value={`R$ ${kpis?.totalPurchases.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={ShoppingBag} color="blue" />
                <KPICard title="Economia Estimada" value={`R$ ${kpis?.savings.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={TrendingDown} color="green" />
                <KPICard title="Eventos em Aberto" value={kpis?.openEvents} trend="down" icon={ShieldAlert} color="amber" />
                <KPICard title="Ticket Médio" value={`R$ ${kpis?.avgTicket.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={DollarSign} color="slate" />
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
    </div>
  );
};

export default Dashboard;
