import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Clock, ShieldAlert, DollarSign, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Database, Loader2, Package,
  FileText, Car, User, Search, Truck, Send, Plus, Users, ChevronRight
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Event } from '../types';
import { useAuth } from '../context/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

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

const WorkflowCard = ({ to, icon: Icon, title, desc, accent, stat }: any) => (
  <Link
    to={to}
    className="group bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
  >
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${accent}`} />
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${accent} text-white shadow-lg`}>
      <Icon size={22} strokeWidth={2.2} />
    </div>
    <h3 className="text-lg font-black text-slate-800 mb-1">{title}</h3>
    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">{desc}</p>
    <div className="flex items-center justify-between">
      {stat !== undefined && (
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">{stat}</span>
      )}
      <span className="ml-auto flex items-center gap-1 text-blue-600 font-bold text-xs uppercase tracking-wider group-hover:gap-2 transition-all">
        Abrir <ChevronRight size={16} />
      </span>
    </div>
  </Link>
);

const Dashboard: React.FC = () => {
  const { profile, access } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExecutive = access.isTenantManager;

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
    
    // SAFETY TIMEOUT: Garante que o loading suma após 8 segundos mesmo se o banco travar
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
        setLoading((prev) => {
            if (prev) console.warn("Dashboard loading timeout forced.");
            return false;
        });
    }, 8000);

    try {
        const eventsData = await safeFetch('events');
        setEvents(eventsData);

        const [{ count: qCount }, { count: dCount }, { count: poCount }] = await Promise.all([
          supabase.from('quotations').select('*', { count: 'exact', head: true }),
          supabase.from('deliveries').select('*', { count: 'exact', head: true }),
          supabase.from('purchase_orders').select('*', { count: 'exact', head: true }),
        ]);
        setQuotationsCount(qCount || 0);
        setDeliveriesCount(dCount || 0);
        setPurchasesCount(poCount || 0);

        if (isExecutive) {
            setOrders(await safeFetch('purchase_orders'));
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
    } else {
        // Fallback: Se o perfil não estiver disponível imediatamente, 
        // aguarda um pouco e remove o loading para não travar a tela.
        // O PrivateRoute já garante que há um usuário logado.
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, [profile?.id, profile?.role]); // Dependências primitivas para evitar loop

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

  // --- CENTRAL OPERACIONAL (membros e equipe) ---
  if (!isExecutive) {
      const awaiting = events.filter(e => e.status === 'Aguardando' || e.status === 'Em Cotação').length;
      const inQuotation = events.filter(e => e.status === 'Em Cotação').length;

      return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#4338CA] rounded-[32px] p-6 md:p-10 text-white shadow-2xl shadow-blue-900/25 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_45%)]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-200 mb-2">Central Operacional</p>
                    <h2 className="text-2xl md:text-3xl font-black mb-2">Olá, {profile?.full_name?.split(' ')[0] || 'Colaborador'}!</h2>
                    <p className="text-blue-100/90 font-medium max-w-2xl text-sm md:text-base">
                      Siga o fluxo abaixo: registre o sinistro, cote peças, acompanhe compras e entregas — tudo sem depender de permissões manuais.
                    </p>
                  </div>
                  <Link
                    to="/eventos"
                    className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-colors shrink-0"
                  >
                    <Plus size={16} /> Novo Sinistro
                  </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              <WorkflowCard
                to="/eventos"
                icon={ShieldAlert}
                title="1. Registrar Sinistro"
                desc="Abra o evento, vincule associado e veículo, anexe evidências."
                accent="bg-blue-600"
                stat={`${events.length} ativos`}
              />
              <WorkflowCard
                to="/cotacoes"
                icon={Search}
                title="2. Cotar Peças"
                desc="Monte a matriz de cotação e envie RFQ aos fornecedores."
                accent="bg-indigo-600"
                stat={`${quotationsCount} cotações`}
              />
              <WorkflowCard
                to="/compras"
                icon={ShoppingBag}
                title="3. Ordem de Compra"
                desc="Gere e acompanhe OCs. Gestores aprovam quando necessário."
                accent="bg-violet-600"
                stat={`${purchasesCount} OCs`}
              />
              <WorkflowCard
                to="/entregas"
                icon={Truck}
                title="4. Acompanhar Frete"
                desc="Rastreie entregas e confirme recebimento das peças."
                accent="bg-cyan-600"
                stat={`${deliveriesCount} entregas`}
              />
              <WorkflowCard
                to="/associados"
                icon={User}
                title="Cadastrar Associado"
                desc="Inclua clientes e proprietários para novos sinistros."
                accent="bg-slate-700"
              />
              <WorkflowCard
                to="/veiculos"
                icon={Car}
                title="Cadastrar Veículo"
                desc="Registre placas e modelos vinculados aos associados."
                accent="bg-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sinistros ativos</p>
                <p className="text-3xl font-black text-slate-800">{events.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Aguardando ação</p>
                <p className="text-3xl font-black text-amber-600">{awaiting}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Em cotação</p>
                <p className="text-3xl font-black text-blue-600">{inQuotation}</p>
              </div>
            </div>

            <Link
              to="/cotacoes"
              className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl"><Send size={18} /></div>
                <div>
                  <p className="font-black text-slate-800 text-sm">Enviar para gestores</p>
                  <p className="text-xs text-slate-500 font-medium">Finalize cotações pendentes para aprovação da equipe.</p>
                </div>
              </div>
              <ChevronRight className="text-indigo-600" size={20} />
            </Link>
        </div>
      );
  }

  // --- DASHBOARD EXECUTIVO (ADMIN/GERENTE) ---
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Section - Stack on Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard title="Total Compras" value={`R$ ${kpis?.totalPurchases.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={ShoppingBag} color="blue" />
                <KPICard title="Economia Estimada" value={`R$ ${kpis?.savings.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} trend="up" icon={TrendingDown} color="green" />
                {/* MUDANÇA: 'Sinistros Abertos' */}
                <KPICard title="Sinistros Abertos" value={kpis?.openEvents} trend="down" icon={ShieldAlert} color="amber" />
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
                <div className="h-64 md:h-80">
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
                {/* MUDANÇA: Título mantido como 'Status dos Sinistros' */}
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
                                {/* MUDANÇA: 'Sinistros' */}
                                <span className="text-xs text-slate-500 font-medium">Sinistros</span>
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
