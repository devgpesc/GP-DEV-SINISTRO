
import React, { useState } from 'react';
import { 
  ShoppingCart, Search, Filter, FileText, 
  CheckCircle2, XCircle, Send, Printer, MoreVertical, 
  Clock, DollarSign, UserCheck
} from 'lucide-react';
import { PurchaseOrder } from '../types';

const Purchases: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<PurchaseOrder[]>([
    {
      id: '1',
      code: 'OC-2024-001',
      eventId: '1',
      supplierId: 's1',
      total: 1367.13,
      status: 'Aprovada',
      createdAt: '2024-05-12T10:00:00Z',
      items: [
        { catalogId: 'c1', name: 'Parachoque Corolla', quantity: 1, price: 967.13 },
        { catalogId: 'c2', name: 'Mão de Obra', quantity: 1, price: 400.00 }
      ]
    },
    {
      id: '2',
      code: 'OC-2024-002',
      eventId: '1',
      supplierId: 's2',
      total: 6850.00,
      status: 'Gerada',
      createdAt: '2024-05-14T15:30:00Z',
      items: []
    }
  ]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Aprovada': return 'bg-green-100 text-green-700 border-green-200';
      case 'Gerada': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Enviada': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Ordens de Compra</h2>
          <p className="text-sm text-slate-500 font-medium">Controle e aprovação de pedidos para fornecedores.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
             <DollarSign className="text-green-600" size={20} />
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total do Mês</p>
               <p className="text-sm font-bold text-slate-800">R$ 42.150,00</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por OC ou Fornecedor..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
          <Filter size={18} /> Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.map(order => (
          <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm">
                <ShoppingCart size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-800">{order.code}</h3>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Evento: <span className="text-blue-600">EVT-2024-001</span> • Criado em {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full md:w-auto">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p>
                <p className="text-sm font-bold text-slate-700">TAURO Peças</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                <p className="text-sm font-bold text-green-600">R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Itens</p>
                <p className="text-sm font-bold text-slate-700">{order.items.length || '-'} un</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
              {order.status === 'Gerada' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/10">
                  <UserCheck size={16} /> Aprovar
                </button>
              )}
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Ver PDF"><Printer size={18}/></button>
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Enviar WhatsApp"><Send size={18}/></button>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"><MoreVertical size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Purchases;
