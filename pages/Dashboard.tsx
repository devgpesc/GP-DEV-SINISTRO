import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Clock, ShieldAlert, ShoppingBag, ArrowUpRight, ArrowDownRight, Database,
  Car, User, Search, Truck, Send, Plus, ChevronRight, FileText,
  RefreshCw, CheckCircle2, AlertTriangle, Info, Activity, RotateCcw, XCircle
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { supabase } from '../services/supabaseClient';
import { PurchaseOrder, Event } from '../types';
import { useAuth } from '../context/AuthContext';
import { auditService } from '../services/auditService';
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

const KPICard = ({ title, value, change, trend, icon: Icon, color }: any) => (
  <div className="app-panel p-4">
    <div className="mb-2 flex items-center justify-between">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
        color === 'green' ? 'bg-emerald-50 text-emerald-700' :
        color === 'amber' ? 'bg-amber-50 text-amber-700' :
        color === 'indigo' ? 'bg-indigo-50 text-indigo-700' :
        'bg-blue-50 text-blue-700'
      }`}>
        <Icon size={17} />
      </div>
      {change && (
        <div className={`flex items-center gap-1 text-sm font-bold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {change}
        </div>
      )}
    </div>
    <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
    <p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p>
  </div>
);

const WorkflowCard = ({ to, icon: Icon, title, desc, accent, stat }: any) => (
  <Link
    to={to}
    className="group flex min-h-[92px] items-center gap-3 border-b border-slate-200 p-4 transition-colors hover:bg-blue-50/50 md:border-r"
  >
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent} text-white`}>
      <Icon size={18} strokeWidth={2.1} />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{desc}</p>
      {stat !== undefined && (
        <span className="mt-1 inline-block text-[11px] font-semibold text-blue-700">{stat}</span>
      )}
    </div>
    <ChevronRight className="shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" size={17} />
  </Link>
);

const Dashboard: React.FC = () => {
  const { profile, access, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExecutive = access.isTenantManager;

  const loadDashboardData = async () => {
    setLoading(true);

    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn('Dashboard loading timeout forced.');
        return false;
      });
    }, 5000);

    try {
      const eventsPromise = supabase
        .from('events')
        .select('id, status, created_at, description, protocol')
        .order('created_at', { ascending: false })
        .limit(200);

      const countsPromise = Promise.all([
        supabase.from('quotations').select('id', { count: 'exact', head: true }),
        supabase.from('deliveries').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("Cancelada","Devolvida")'),
      ]);

      const ordersPromise = isExecutive
        ? supabase
            .from('purchase_orders')
            .select('id, status, total, quotation_id, created_at')
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as any[], error: null });

      const activityPromise = auditService.getLogs();
      const [eventsRes, countsRes, ordersRes, auditRows] = await Promise.all([
        eventsPromise,
        countsPromise,
        ordersPromise,
        activityPromise,
      ]);

      setEvents(((eventsRes.data as unknown) as Event[]) || []);
      const [qRes, dRes, poRes] = countsRes;
      setQuotationsCount(qRes.count || 0);
      setDeliveriesCount(dRes.count || 0);
      setPurchasesCount(poRes.count || 0);
      setRecentActivity((auditRows || []).filter((row: any) => row.action !== 'Navigate').slice(0, 5));

      if (isExecutive) {
        const rows = (ordersRes as any)?.data || [];
        setOrders(
          rows.map((o: any) => ({
            ...o,
            createdAt: o.createdAt || o.created_at,
            total: Number(o.total) || 0,
          })),
        );
      }
    } catch (err: any) {
      console.error('Erro dashboard:', err);
    } finally {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile || user) {
      loadDashboardData();
    } else {
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [profile?.id, profile?.role, user?.id, isExecutive]);

  const dashboardStats = useMemo(() => {
    const waiting = events.filter((event) => /aguardando|análise|analise/i.test(event.status || '')).length;
    const completed = events.filter((event) => /conclu|finaliz|entregue/i.test(event.status || '')).length;
    const inProgress = Math.max(0, events.length - waiting - completed);
    return { total: events.length, waiting, inProgress, completed };
  }, [events]);

  const purchaseReversalStats = useMemo(() => {
    const reversedOrders = orders.filter((order) => order.status === 'Cancelada' || order.status === 'Devolvida');
    return {
      cancelled: reversedOrders.filter((order) => order.status === 'Cancelada').length,
      returned: reversedOrders.filter((order) => order.status === 'Devolvida').length,
      quotations: new Set(reversedOrders.map((order: any) => order.quotation_id).filter(Boolean)).size,
      amount: reversedOrders.reduce((sum, order) => sum + Number(order.reversed_amount || order.total || 0), 0),
    };
  }, [orders]);

  const chartData = useMemo(() => {
    const months: any = {};
    const today = new Date();
    for(let i=5; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
        months[key] = { name: key, sinistros: 0 };
    }
    events.forEach((event) => {
        const rawDate = (event as any).created_at || event.createdAt;
        const d = new Date(rawDate);
        const key = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
        if(months[key]) months[key].sinistros += 1;
    });
    return Object.values(months);
  }, [events]);

  const statusData = useMemo(() => {
    const counts: any = {};
    events.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    const colors: any = { 'Aguardando': '#94a3b8', 'Em Cotação': '#3b82f6', 'Aprovado': '#22c55e', 'Concluído': '#1e293b' };
    return Object.keys(counts).map(status => ({ name: status, value: counts[status], color: colors[status] || '#cbd5e1' }));
  }, [events]);

  const dashboardAlerts = useMemo(() => {
    const alerts: Array<{ tone: string; icon: any; text: string }> = [];
    if (dashboardStats.waiting > 0) alerts.push({ tone: 'amber', icon: AlertTriangle, text: `${dashboardStats.waiting} sinistro(s) aguardando análise ou aprovação.` });
    if (quotationsCount > 0) alerts.push({ tone: 'blue', icon: Info, text: `${quotationsCount} cotação(ões) registradas para acompanhamento.` });
    if (deliveriesCount > 0) alerts.push({ tone: 'green', icon: Truck, text: `${deliveriesCount} entrega(s) no fluxo operacional.` });
    return alerts.slice(0, 3);
  }, [dashboardStats.waiting, quotationsCount, deliveriesCount]);

  if (loading) {
      return (
          <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
            <div className="h-10 w-64 bg-slate-200 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-2xl border border-slate-200" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 h-64 bg-slate-100 rounded-2xl border border-slate-200" />
              <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
            </div>
          </div>
      );
  }

  // --- CENTRAL OPERACIONAL (membros e equipe) ---
  if (!isExecutive) {
      const awaiting = events.filter(e => e.status === 'Aguardando' || e.status === 'Em Cotação').length;
      const inQuotation = events.filter(e => e.status === 'Em Cotação').length;

      return (
        <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in duration-300">
            <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-blue-700">Central operacional</p>
                    <h2 className="text-2xl font-bold text-slate-950">Olá, {profile?.full_name?.split(' ')[0] || 'Colaborador'}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                      Registre sinistros, faça cotações e acompanhe compras e entregas em um único fluxo.
                    </p>
                  </div>
                  <Link
                    to="/eventos"
                    className="app-btn-primary shrink-0 gap-2"
                  >
                    <Plus size={16} /> Novo Sinistro
                  </Link>
            </section>

            <div className="app-kpi-grid app-kpi-grid--compact">
              <div className="app-kpi">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Sinistros ativos</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{events.length}</p>
              </div>
              <div className="app-kpi">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Aguardando ação</p>
                <p className="mt-0.5 text-2xl font-bold text-amber-700">{awaiting}</p>
              </div>
              <div className="app-kpi">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Em cotação</p>
                <p className="mt-0.5 text-2xl font-bold text-blue-700">{inQuotation}</p>
              </div>
              <div className="app-kpi">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Ordens de compra</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{purchasesCount}</p>
              </div>
            </div>

            <section className="app-panel overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900">Fluxo de trabalho</h3>
                <p className="mt-0.5 text-xs text-slate-500">Acesse diretamente a próxima etapa da operação.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2">
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
            </section>

            <Link
              to="/cotacoes"
              className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50/70 p-4 transition-colors hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white"><Send size={17} /></div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Enviar para gestores</p>
                  <p className="text-xs text-slate-600">Finalize cotações pendentes para aprovação da equipe.</p>
                </div>
              </div>
              <ChevronRight className="text-blue-700" size={19} />
            </Link>
        </div>
      );
  }

  // --- DASHBOARD EXECUTIVO (ADMIN/GERENTE) ---
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Total de sinistros" value={dashboardStats.total} icon={FileText} color="blue" />
        <KPICard title="Aguardando análise" value={dashboardStats.waiting} icon={Clock} color="amber" />
        <KPICard title="Em andamento" value={dashboardStats.inProgress} icon={RefreshCw} color="indigo" />
        <KPICard title="Concluídos" value={dashboardStats.completed} icon={CheckCircle2} color="green" />
      </section>

      <Link to="/compras" className="app-panel grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden transition-colors hover:border-blue-200 md:grid-cols-4 md:divide-y-0">
        <div className="p-4"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400"><XCircle size={13} className="text-red-600"/> OCs canceladas</p><p className="mt-1 text-xl font-black text-red-700">{purchaseReversalStats.cancelled}</p></div>
        <div className="p-4"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400"><RotateCcw size={13} className="text-amber-600"/> OCs devolvidas</p><p className="mt-1 text-xl font-black text-amber-700">{purchaseReversalStats.returned}</p></div>
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">Cotações reabertas</p><p className="mt-1 text-xl font-black text-slate-900">{purchaseReversalStats.quotations}</p></div>
        <div className="p-4"><p className="text-[9px] font-black uppercase text-slate-400">Valor fora dos KPIs</p><p className="mt-1 text-xl font-black text-emerald-700">R$ {purchaseReversalStats.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
      </Link>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.7fr)]">
        <div className="app-panel p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Activity size={17} className="text-blue-600" /> Evolução de sinistros</h3>
              <p className="mt-0.5 text-xs text-slate-500">Aberturas registradas nos últimos seis meses</p>
            </div>
            <Link to="/relatorios" className="text-xs font-semibold text-blue-700 hover:underline">Ver relatório</Link>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgba(15,23,42,.08)'}} />
                <Bar name="Sinistros" dataKey="sinistros" fill="#2155d4" radius={[5, 5, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-panel p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Clock size={17} className="text-blue-600" /> Distribuição por status</h3>
          <div className="relative h-48">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={54} outerRadius={72} paddingAngle={4} dataKey="value">
                      {statusData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{events.length}</span>
                  <span className="text-xs text-slate-500">Sinistros</span>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-400"><Database size={28} /><p className="mt-2 text-xs font-semibold">Sem dados</p></div>
            )}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            {statusData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: item.color}} /><span className="truncate text-slate-600">{item.name}</span></div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="app-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div><h3 className="text-sm font-bold text-slate-900">Atividades recentes</h3><p className="text-xs text-slate-500">Movimentações registradas na auditoria</p></div>
            <Link to="/relatorios" className="text-xs font-semibold text-blue-700 hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma atividade recente.</p>
            ) : recentActivity.map((row: any) => {
              const activityName = row.profiles?.full_name || row.profiles?.email || 'Usuário';
              const initials = activityName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();
              return (
                <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800">{initials}</div>
                  <div className="min-w-0 flex-1"><p className="text-xs text-slate-600"><span className="font-bold text-slate-900">{activityName}</span> realizou <span className="font-semibold text-blue-700">{row.action}</span> em {row.entity || 'registro'}.</p><p className="mt-0.5 text-[11px] text-slate-400">{new Date(row.created_at).toLocaleString('pt-BR')}</p></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="app-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div><h3 className="text-sm font-bold text-slate-900">Alertas operacionais</h3><p className="text-xs text-slate-500">Itens que merecem atenção da equipe</p></div>
            <span className="app-status-pill bg-amber-50 text-amber-700">{dashboardAlerts.length} ativo(s)</span>
          </div>
          <div className="space-y-2 p-4">
            {dashboardAlerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} /> Nenhum alerta operacional no momento.</div>
            ) : dashboardAlerts.map((alert, index) => {
              const AlertIcon = alert.icon;
              const toneClass = alert.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : alert.tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800';
              return <div key={`${alert.tone}-${index}`} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${toneClass}`}><AlertIcon size={17} className="mt-0.5 shrink-0" /><span>{alert.text}</span></div>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
