
import React from 'react';
import { BarChart3, TrendingDown, Target, ShieldCheck, Download, Filter, Calendar, Users, ShoppingCart } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

const dataSavings = [
  { name: 'Jan', economy: 4200, total: 25000 },
  { name: 'Fev', economy: 6800, total: 32000 },
  { name: 'Mar', economy: 5100, total: 28000 },
  { name: 'Abr', economy: 9500, total: 45000 },
  { name: 'Mai', economy: 11200, total: 55000 },
];

const dataCompliance = [
  { name: 'Conforme', value: 85, color: '#22c55e' },
  { name: 'Divergente', value: 15, color: '#ef4444' },
];

const Reports: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Inteligência</h2>
          <p className="text-sm text-slate-500 font-medium">Relatórios analíticos para tomada de decisão estratégica.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
            <Download size={18} /> Exportar Completo
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all">
            <Filter size={18} /> Filtros Avançados
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
               <TrendingDown size={24} />
             </div>
             <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase">+15.2%</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Economia Gerada (YTD)</p>
          <p className="text-3xl font-black text-slate-800 mt-1">R$ 36.850,42</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
               <ShoppingCart size={24} />
             </div>
             <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">Meta 95%</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ticket Médio por OC</p>
          <p className="text-3xl font-black text-slate-800 mt-1">R$ 2.450,00</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
               <Target size={24} />
             </div>
             <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">SLA: 48h</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Taxa de Resposta (Quotes)</p>
          <p className="text-3xl font-black text-slate-800 mt-1">92.4%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
            <TrendingDown size={20} className="text-green-600" />
            Evolução de Custos vs. Economia
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataSavings}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="economy" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            Conformidade das Entregas
          </h3>
          <div className="h-80 flex items-center">
             <div className="flex-1">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataCompliance}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={10}
                      dataKey="value"
                    >
                      {dataCompliance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="w-48 space-y-4">
                {dataCompliance.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.name}</p>
                    <p className="text-lg font-black text-slate-800">{item.value}%</p>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
