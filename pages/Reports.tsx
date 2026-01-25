
import React, { useState } from 'react';
import { BarChart3, TrendingDown, Target, ShieldCheck, Download, Filter, Calendar, Users, ShoppingBag, CheckCircle, AlertTriangle } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  const handleExport = (type: string) => {
    setLoading(true);
    // Simulação de delay de exportação
    setTimeout(() => {
      setLoading(false);
      alert(`Relatório exportado em formato ${type.toUpperCase()} com sucesso!`);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Inteligência</h2>
          <p className="text-sm text-slate-500 font-medium">Relatórios analíticos para governança estratégica.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
              <Download size={18} /> Exportar
            </button>
            <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl hidden group-hover:block z-10 overflow-hidden">
               <button onClick={() => handleExport('pdf')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50">PDF Executivo</button>
               <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50">Planilha (XLSX)</button>
            </div>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20">
            <Filter size={18} /> Período
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div>
              <div className="flex justify-between mb-4">
                 <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><TrendingDown size={24}/></div>
                 <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded-full">+12.4%</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Savings Acumulado</p>
              <h3 className="text-3xl font-black text-slate-800">R$ 48.920</h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div>
              <div className="flex justify-between mb-4">
                 <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><ShoppingBag size={24}/></div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Médio OC</p>
              <h3 className="text-3xl font-black text-slate-800">R$ 3.840</h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div>
              <div className="flex justify-between mb-4">
                 <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Target size={24}/></div>
                 <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-full">SLA: 2.1d</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa Resposta Cotações</p>
              <h3 className="text-3xl font-black text-slate-800">92%</h3>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600"/> Evolução de Compras vs. Economia</h3>
           <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dataSavings}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    <Bar dataKey="economy" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2"><CheckCircle size={18} className="text-green-600"/> Conformidade de Entregas</h3>
           <div className="h-80 flex items-center">
              <div className="flex-1">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={dataCompliance} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={10} dataKey="value">
                          {dataCompliance.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                       </Pie>
                       <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="w-48 space-y-4">
                 <div className="p-3 bg-green-50 border border-green-100 rounded-2xl">
                    <p className="text-[10px] font-black text-green-700 uppercase">No Prazo</p>
                    <p className="text-xl font-black text-green-800">85%</p>
                 </div>
                 <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-[10px] font-black text-red-700 uppercase">Divergentes</p>
                    <p className="text-xl font-black text-red-800">15%</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
