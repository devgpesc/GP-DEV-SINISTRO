
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, MoreVertical, Eye, MessageSquare, FileCheck, X, AlertCircle, 
  Upload, FileText, Image as ImageIcon, Trash2, Download, User as UserIcon, 
  Car as CarIcon, Tag, ChevronRight, History, Settings2, ShieldAlert
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_VEHICLES, MOCK_ASSOCIATES } from '../constants';
import { EventStatus, EventType, Priority, Event, EventHistoryEntry } from '../types';
import StatusChangeModal from '../components/StatusChangeModal';
import { mockStorage } from '../services/supabaseClient';

const StatusBadge = ({ status, onClick }: { status: EventStatus, onClick?: () => void }) => {
  const styles: any = {
    [EventStatus.WAITING]: 'bg-slate-100 text-slate-600 border-slate-200',
    [EventStatus.QUOTING]: 'bg-blue-50 text-blue-600 border-blue-100',
    [EventStatus.APPROVED]: 'bg-green-50 text-green-600 border-green-100',
    [EventStatus.COMPLETED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <span 
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer hover:shadow-sm transition-all ${styles[status]}`}
    >
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
      <div className={`w-2 h-2 rounded-full ${priority === Priority.URGENT ? 'bg-red-500' : priority === Priority.HIGH ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{priority}</span>
    </div>
  );
};

const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusChange, setStatusChange] = useState<{ eventId: string, current: EventStatus, next: EventStatus } | null>(null);

  const [formData, setFormData] = useState({
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    category: '',
    vehicleId: '',
    associateId: '',
    description: '',
    attachments: [] as any[]
  });

  useEffect(() => {
    const saved = mockStorage.get('events') || MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] }));
    setEvents(saved);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: Event = {
      id: Math.random().toString(36).substr(2, 9),
      protocol: `EVT-2024-${String(events.length + 1).padStart(4, '0')}`,
      type: formData.type,
      priority: formData.priority,
      status: EventStatus.WAITING,
      category: formData.category || 'Outros',
      vehicleId: formData.vehicleId || 'v1',
      associateId: formData.associateId || 'a1',
      createdAt: new Date().toISOString(),
      createdBy: 'Admin Master',
      description: formData.description,
      attachments: formData.attachments,
      history: []
    };

    const updated = [newEvent, ...events];
    setEvents(updated);
    mockStorage.set('events', updated);
    setIsModalOpen(false);
    setFormData({ type: EventType.COLLISION, priority: Priority.MEDIUM, category: '', vehicleId: '', associateId: '', description: '', attachments: [] });
  };

  const handleStatusUpdate = (comment: string) => {
    if (!statusChange) return;
    const updated = events.map(evt => {
      if (evt.id === statusChange.eventId) {
        return {
          ...evt,
          status: statusChange.next,
          history: [{
            id: Math.random().toString(36).substr(2, 9),
            fromStatus: statusChange.current,
            toStatus: statusChange.next,
            comment,
            user: 'Admin Master',
            timestamp: new Date().toISOString()
          }, ...evt.history]
        };
      }
      return evt;
    });
    setEvents(updated);
    mockStorage.set('events', updated);
    setStatusChange(null);
  };

  const filteredEvents = events.filter(e => e.protocol.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por protocolo..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl outline-none border border-slate-100 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Novo Sinistro
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo / Categoria</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEvents.map(evt => (
              <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{evt.protocol}</td>
                <td className="px-6 py-4">
                  <p className="text-xs font-bold text-slate-700">{evt.type}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{evt.category}</p>
                </td>
                <td className="px-6 py-4"><PriorityBadge priority={evt.priority} /></td>
                <td className="px-6 py-4">
                  <StatusBadge 
                    status={evt.status} 
                    onClick={() => setStatusChange({ eventId: evt.id, current: evt.status, next: EventStatus.QUOTING })} 
                  />
                </td>
                <td className="px-6 py-4 text-right">
                   <button onClick={() => setSelectedEvent(evt)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Eye size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between">
              <h3 className="text-xl font-bold">Novo Registro de Sinistro</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Tipo</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Prioridade</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Anexar Imagem/Documento</label>
                   <div className="border-2 border-dashed border-slate-100 rounded-2xl p-6 text-center hover:bg-slate-50 transition-all cursor-pointer">
                      <Upload className="mx-auto text-slate-300 mb-2" size={32} />
                      <p className="text-xs text-slate-400">Clique para selecionar arquivos</p>
                   </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Descrição</label>
                  <textarea className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold">Cancelar</button>
                <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20">Salvar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between">
               <h2 className="text-2xl font-black">{selectedEvent.protocol}</h2>
               <button onClick={() => setSelectedEvent(null)}><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-3 gap-8">
               <div className="col-span-2 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Descrição</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedEvent.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tipo</p>
                      <p className="font-bold">{selectedEvent.type}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Prioridade</p>
                      <PriorityBadge priority={selectedEvent.priority} />
                    </div>
                  </div>
               </div>
               <div className="border-l border-slate-100 pl-8">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18}/> Histórico</h4>
                  <div className="space-y-4">
                     {selectedEvent.history.map(h => (
                       <div key={h.id} className="text-xs border-b border-slate-50 pb-2">
                          <p className="font-bold text-blue-600">{h.toStatus}</p>
                          <p className="text-slate-400 mb-1">{new Date(h.timestamp).toLocaleDateString()}</p>
                          <p className="italic text-slate-500">"{h.comment}"</p>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      <StatusChangeModal 
        isOpen={!!statusChange}
        onClose={() => setStatusChange(null)}
        currentStatus={statusChange?.current || EventStatus.WAITING}
        newStatus={statusChange?.next || EventStatus.WAITING}
        onConfirm={handleStatusUpdate}
      />
    </div>
  );
};

export default Events;
