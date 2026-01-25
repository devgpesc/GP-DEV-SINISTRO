
import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldAlert, 
  DollarSign, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
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

const dataPerformance = [
  { name: 'Jan', custo: 45000, economia: 5000 },
  { name: 'Fev', custo: 52000, economia: 8200 },
  { name: 'Mar', custo: 48000, economia: 7100 },
  { name: 'Abr', custo: 61000, economia: 12000 },
  { name: 'Mai', custo: 55000, economia: 9500 },
];

const dataStatus = [
  { name: 'Aguardando', value: 5, color: '#94a3b8' },
  { name: 'Cotação', value: 12, color: '#3b82f6' },
  { name: 'Aprovado', value: 8, color: '#22c55e' },
  { name: 'Concluído', value: 20, color: '#1e293b' },
];

const KPICard = ({ title, value, change, trend, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon size={24} />
      </div>
      <div className={`flex items-center gap-1 text-sm font-bold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {change}
      </div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Compras" value="R$ 261.400" change="+12%" trend="up" icon={ShoppingBag} color="blue" />
        <KPICard title="Economia Gerada" value="R$ 41.800" change="+8.4%" trend="up" icon={TrendingDown} color="green" />
        <KPICard title="Eventos em Aberto" value="25" change="-3" trend="down" icon={ShieldAlert} color="amber" />
        <KPICard title="Ticket Médio" value="R$ 10.450" change="+2.1%" trend="up" icon={DollarSign} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Desempenho de Compras vs Economia
            </h3>
            <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none">
              <option>Últimos 6 meses</option>
              <option>Este ano</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataPerformance}>
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
                />
                <Area type="monotone" dataKey="custo" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCusto)" />
                <Area type="monotone" dataKey="economia" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorEconomia)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Distribuição por Status
          </h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-3xl font-bold text-slate-800">45</span>
                <span className="text-xs text-slate-500 font-medium">Eventos</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {dataStatus.map((item, idx) => (
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
            <button className="text-blue-600 text-sm font-bold hover:underline">Ver todas</button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-blue-600">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">OC-2024-000{i}</p>
                    <p className="text-xs text-slate-500">Fornecedor: Auto Peças Premium</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">R$ 6.850,00</p>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Aguardando Diretor</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6">Análise Rápida de Fornecedores</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
               <div className="flex gap-3">
                 <div className="bg-blue-600 p-2 h-fit rounded-lg text-white">
                   <TrendingDown size={20} />
                 </div>
                 <div>
                   <p className="font-bold text-blue-900 text-sm">Oportunidade de Economia</p>
                   <p className="text-xs text-blue-800 mt-1">O fornecedor <b>"Peças Express"</b> está com preços 15% abaixo da média em itens de funilaria este mês.</p>
                 </div>
               </div>
            </div>
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
               <div className="flex gap-3">
                 <div className="bg-red-500 p-2 h-fit rounded-lg text-white">
                   <ShieldAlert size={20} />
                 </div>
                 <div>
                   <p className="font-bold text-red-900 text-sm">Alerta de SLA</p>
                   <p className="text-xs text-red-800 mt-1">3 entregas do fornecedor <b>"Silva Mecânica"</b> estão com atraso superior a 48h.</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
