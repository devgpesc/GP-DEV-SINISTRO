
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  MessageSquare, 
  FileCheck,
  Calendar
} from 'lucide-react';
import { MOCK_EVENTS, COLORS } from '../constants';
import { EventStatus, Priority } from '../types';

const StatusBadge = ({ status }: { status: EventStatus }) => {
  const styles: any = {
    [EventStatus.WAITING]: 'bg-slate-100 text-slate-600',
    [EventStatus.QUOTING]: 'bg-blue-100 text-blue-600',
    [EventStatus.APPROVED]: 'bg-green-100 text-green-600',
    [EventStatus.COMPLETED]: 'bg-indigo-100 text-indigo-600',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const styles: any = {
    [Priority.LOW]: 'bg-slate-100 text-slate-500',
    [Priority.MEDIUM]: 'bg-blue-50 text-blue-500',
    [Priority.HIGH]: 'bg-amber-100 text-amber-600',
    [Priority.URGENT]: 'bg-red-100 text-red-600 animate-pulse',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${styles[priority].replace('bg-', 'bg-').split(' ')[0]}`}></div>
      <span className="text-xs font-semibold text-slate-600">{priority}</span>
    </div>
  );
};

const Events: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por protocolo, placa ou associado..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Filter size={20} />
          </button>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 w-full md:w-auto justify-center">
          <Plus size={20} />
          Novo Evento
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Protocolo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo / Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Prioridade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Data Abertura</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_EVENTS.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{evt.protocol}</p>
                    <p className="text-xs text-slate-400 font-medium">Veículo: {evt.vehicleId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-700">{evt.type}</p>
                    <p className="text-xs text-slate-500 uppercase">{evt.category}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={evt.status} />
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={evt.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Calendar size={14} />
                      {new Date(evt.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Ver Detalhes">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Mensagens">
                        <MessageSquare size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Cotações">
                        <FileCheck size={18} />
                      </button>
                      <button className="p-2 text-slate-300 hover:text-slate-600 rounded-lg transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500 font-medium">Mostrando 1-10 de 125 eventos</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-400 cursor-not-allowed">Anterior</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 shadow-sm">1</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm">2</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm">3</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 shadow-sm">Próximo</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;
