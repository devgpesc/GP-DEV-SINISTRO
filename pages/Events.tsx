
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, MoreVertical, Eye, X, AlertCircle, 
  Upload, FileText, Image as ImageIcon, Trash2, Tag, 
  ShieldAlert, Hash, Zap, Edit3, Clock, Paperclip, History
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_VEHICLES, MOCK_ASSOCIATES } from '../constants';
import { EventStatus, EventType, Priority, Event } from '../types';
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
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusChange, setStatusChange] = useState<{ eventId: string, current: EventStatus, next: EventStatus } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PREDEFINED_CATEGORIES = ['Mecânica', 'Elétrica', 'Funilaria', 'Seguro', 'Outros'];

  const [formData, setFormData] = useState({
    protocolMode: 'auto' as 'auto' | 'manual',
    manualProtocol: '',
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    category: '',
    vehicleId: '',
    associateId: '',
    description: '',
    attachments: [] as { name: string, type: string, size: number, data?: string }[]
  });

  useEffect(() => {
    const savedEvents = mockStorage.get('events') || MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] }));
    setEvents(savedEvents);
  }, []);

  const nextAutoProtocol = useMemo(() => {
    return `EVT-2024-${String(events.length + 1).padStart(4, '0')}`;
  }, [events]);

  const handleEdit = (evt: Event) => {
    setEventToEdit(evt);
    setFormData({
      protocolMode: evt.protocol.startsWith('EVT') ? 'auto' : 'manual',
      manualProtocol: evt.protocol,
      type: evt.type,
      priority: evt.priority,
      category: evt.category,
      vehicleId: evt.vehicleId,
      associateId: evt.associateId,
      description: evt.description,
      attachments: evt.attachments || []
    });
    setIsModalOpen(true);
  };

  const confirmDelete = (evt: Event) => {
    setEventToDelete(evt);
  };

  const handleDelete = () => {
    if (!eventToDelete) return;
    const updated = events.filter(e => e.id !== eventToDelete.id);
    setEvents(updated);
    mockStorage.set('events', updated);
    setEventToDelete(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: File[] = Array.from(e.target.files);
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, {
              name: file.name,
              type: file.type,
              size: file.size,
              data: event.target?.result as string
            }]
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const protocol = formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol;

    const newEvent: Event = {
      id: eventToEdit ? eventToEdit.id : Math.random().toString(36).substr(2, 9),
      protocol: protocol,
      type: formData.type,
      priority: formData.priority,
      status: eventToEdit ? eventToEdit.status : EventStatus.WAITING,
      category: formData.category || 'Não categorizado',
      vehicleId: formData.vehicleId || 'v1',
      associateId: formData.associateId || 'a1',
      createdAt: eventToEdit ? eventToEdit.createdAt : new Date().toISOString(),
      createdBy: eventToEdit ? eventToEdit.createdBy : 'Admin Master',
      description: formData.description,
      attachments: formData.attachments,
      history: eventToEdit ? eventToEdit.history : []
    };

    let updated;
    if (eventToEdit) {
      updated = events.map(evt => evt.id === eventToEdit.id ? newEvent : evt);
    } else {
      updated = [newEvent, ...events];
    }
    
    setEvents(updated);
    mockStorage.set('events', updated);
    setIsModalOpen(false);
    setEventToEdit(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ 
      protocolMode: 'auto', manualProtocol: '', type: EventType.COLLISION, priority: Priority.MEDIUM, 
      category: '', vehicleId: '', associateId: '', description: '', attachments: [] 
    });
  };

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const lowSearch = searchTerm.toLowerCase();
    return events.filter(e => {
      const associate = MOCK_ASSOCIATES.find(a => a.id === e.associateId);
      const vehicle = MOCK_VEHICLES.find(v => v.id === e.vehicleId);
      return (
        e.protocol.toLowerCase().includes(lowSearch) ||
        (associate && associate.name.toLowerCase().includes(lowSearch)) ||
        (vehicle && vehicle.plate.toLowerCase().includes(lowSearch))
      );
    });
  }, [events, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por Protocolo, Nome do Cliente ou Placa..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => { setEventToEdit(null); resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap"
        >
          <Plus size={18} /> Novo Sinistro
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo / Cliente</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa / Veículo</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEvents.map(evt => {
               const associate = MOCK_ASSOCIATES.find(a => a.id === evt.associateId);
               const vehicle = MOCK_VEHICLES.find(v => v.id === evt.vehicleId);
               return (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-800">{evt.protocol}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{associate?.name || 'Não vinculado'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg inline-block text-xs border border-slate-200">{vehicle?.plate || 'SEM PLACA'}</p>
                  </td>
                  <td className="px-8 py-5"><PriorityBadge priority={evt.priority} /></td>
                  <td className="px-8 py-5">
                    <StatusBadge status={evt.status} />
                  </td>
                  <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                     <button onClick={() => setSelectedEvent(evt)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Eye size={18}/></button>
                     <button onClick={() => handleEdit(evt)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={18}/></button>
                     <button onClick={() => confirmDelete(evt)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Exclusão "Caixa Bonita" */}
      {eventToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEventToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Sinistro?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              Você está prestes a remover o protocolo <span className="font-black text-slate-800">{eventToDelete.protocol}</span>. Esta ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setEventToDelete(null)} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleDelete} className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-2xl text-white"><ShieldAlert size={24} /></div>
                {eventToEdit ? 'Editar Sinistro' : 'Registro de Sinistro'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400"><X size={24}/></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Modo</label>
                    <div className="flex bg-white p-1 rounded-xl">
                      <button type="button" onClick={() => setFormData({...formData, protocolMode: 'auto'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Auto</button>
                      <button type="button" onClick={() => setFormData({...formData, protocolMode: 'manual'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Manual</button>
                    </div>
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Protocolo</label>
                    <input disabled={formData.protocolMode === 'auto'} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-black outline-none" value={formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol} onChange={e => setFormData({...formData, manualProtocol: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Tipo</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Categoria</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Selecione...</option>
                    {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Descrição</label>
                  <textarea className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 h-28 outline-none font-medium resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
