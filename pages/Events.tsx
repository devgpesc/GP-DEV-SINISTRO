
import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  MessageSquare, 
  FileCheck,
  Calendar,
  X,
  AlertCircle,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Download,
  ExternalLink,
  User as UserIcon,
  Car as CarIcon,
  Tag,
  ChevronRight,
  History,
  CheckCircle,
  XCircle,
  Settings2
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_VEHICLES, MOCK_ASSOCIATES } from '../constants';
import { EventStatus, EventType, Priority, Event, EventHistoryEntry } from '../types';
import StatusChangeModal from '../components/StatusChangeModal';

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
      <div className={`w-2 h-2 rounded-full ${styles[priority].replace('bg-', 'bg-').split(' ')[0]}`}></div>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{priority}</span>
    </div>
  );
};

const Events: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<EventStatus | 'All'>('All');
  const [filterPriority, setFilterPriority] = useState<Priority | 'All'>('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] })) as Event[]);
  
  // Status Change Logic
  const [statusChange, setStatusChange] = useState<{ eventId: string, current: EventStatus, next: EventStatus } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    category: '',
    vehicleId: '',
    associateId: '',
    description: '',
    attachments: [] as File[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = ["Mecânica", "Elétrica", "Funilaria", "Seguro", "Outros"];

  // Filtros Avançados
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = e.protocol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          getVehiclePlate(e.vehicleId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'All' || e.status === filterStatus;
      const matchPriority = filterPriority === 'All' || e.priority === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [events, searchTerm, filterStatus, filterPriority]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: Event = {
      id: String(events.length + 1),
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
      attachments: formData.attachments.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Admin Master'
      })),
      history: []
    };

    setEvents([newEvent, ...events]);
    setIsModalOpen(false);
    resetForm();
  };

  const handleStatusUpdate = (comment: string) => {
    if (!statusChange) return;

    setEvents(prev => prev.map(evt => {
      if (evt.id === statusChange.eventId) {
        const historyEntry: EventHistoryEntry = {
          id: Math.random().toString(36).substr(2, 9),
          fromStatus: statusChange.current,
          toStatus: statusChange.next,
          comment: comment,
          user: 'Admin Master',
          timestamp: new Date().toISOString()
        };
        return {
          ...evt,
          status: statusChange.next,
          history: [historyEntry, ...evt.history]
        };
      }
      return evt;
    }));

    if (selectedEvent?.id === statusChange.eventId) {
       setSelectedEvent(prev => prev ? ({
         ...prev,
         status: statusChange.next,
         history: [{
           id: Math.random().toString(36).substr(2, 9),
           fromStatus: statusChange.current,
           toStatus: statusChange.next,
           comment: comment,
           user: 'Admin Master',
           timestamp: new Date().toISOString()
         }, ...prev.history]
       }) : null);
    }

    setStatusChange(null);
  };

  const resetForm = () => {
    setFormData({
      type: EventType.COLLISION,
      priority: Priority.MEDIUM,
      category: '',
      vehicleId: '',
      associateId: '',
      description: '',
      attachments: []
    });
    setErrors({});
  };

  const getVehiclePlate = (id: string) => MOCK_VEHICLES.find(v => v.id === id)?.plate || 'N/D';
  const getAssociateName = (id: string) => MOCK_ASSOCIATES.find(a => a.id === id)?.name || 'N/D';

  return (
    <div className="space-y-6">
      {/* Advanced Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Protocolo ou Placa..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="All">Todos os Status</option>
            {Object.values(EventStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
          >
            <option value="All">Todas Prioridades</option>
            {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <button 
            onClick={() => { setSearchTerm(''); setFilterStatus('All'); setFilterPriority('All'); }}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap"
          >
            Limpar Filtros
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
        >
          <Plus size={18} /> Novo Evento
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Listagem de Eventos ({filteredEvents.length})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocolo / Veículo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo / Categoria</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prioridade</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abertura</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 text-sm">{evt.protocol}</p>
                    <p className="text-[11px] text-blue-600 font-bold">{getVehiclePlate(evt.vehicleId)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700">{evt.type}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{evt.category}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge 
                      status={evt.status} 
                      onClick={() => {
                        const nextStatusMap: any = {
                          [EventStatus.WAITING]: EventStatus.QUOTING,
                          [EventStatus.QUOTING]: EventStatus.APPROVED,
                          [EventStatus.APPROVED]: EventStatus.COMPLETED,
                          [EventStatus.COMPLETED]: EventStatus.WAITING,
                        };
                        setStatusChange({ eventId: evt.id, current: evt.status, next: nextStatusMap[evt.status] });
                      }} 
                    />
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={evt.priority} />
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500">
                    {new Date(evt.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelectedEvent(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={16}/></button>
                      <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><MessageSquare size={16}/></button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"><FileCheck size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhe do Evento - Modal Branco Refinado */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[95vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/30">
              <div className="flex items-center gap-6">
                <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                  <FileText size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{selectedEvent.protocol}</h3>
                    <StatusBadge status={selectedEvent.status} />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Evento de <span className="text-slate-800 font-bold">{selectedEvent.type}</span> aberto por {selectedEvent.createdBy}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
              {/* Left Column: Info */}
              <div className="flex-1 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CarIcon size={12}/> Veículo</p>
                    <p className="font-bold text-slate-800">{getVehiclePlate(selectedEvent.vehicleId)}</p>
                    <p className="text-xs text-slate-500 font-medium">Toyota Corolla 2022</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><UserIcon size={12}/> Associado</p>
                    <p className="font-bold text-slate-800">{getAssociateName(selectedEvent.associateId)}</p>
                    <p className="text-xs text-slate-500 font-medium">ID: {selectedEvent.associateId}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Tag size={18} className="text-blue-500"/> Descrição da Ocorrência</h4>
                  <p className="text-slate-600 text-sm leading-relaxed italic border-l-4 border-blue-500 pl-4 py-1">{selectedEvent.description || "Sem descrição adicional."}</p>
                </div>

                {/* Attachments */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 px-1"><Upload size={18} className="text-blue-500"/> Anexos e Documentação</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedEvent.attachments.map(file => (
                      <div key={file.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {file.type.startsWith('image/') ? <ImageIcon size={18}/> : <FileText size={18}/>}
                          </div>
                          <div className="max-w-[150px]">
                            <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400">{new Date(file.uploadedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Download size={16}/></button>
                          <button className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                    {selectedEvent.attachments.length === 0 && (
                      <div className="col-span-2 py-8 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl">
                        <p className="text-xs font-medium text-slate-400">Nenhum anexo para este sinistro.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: History/Audit Timeline */}
              <div className="w-full lg:w-80 border-l border-slate-100 pl-0 lg:pl-8 space-y-6">
                <h4 className="font-bold text-slate-800 flex items-center gap-2"><History size={18} className="text-blue-500"/> Trilha de Auditoria</h4>
                <div className="relative space-y-6">
                  {selectedEvent.history.map((entry, i) => (
                    <div key={entry.id} className="relative pl-6">
                      {i !== selectedEvent.history.length - 1 && <div className="absolute left-1 top-4 w-px h-full bg-slate-100"></div>}
                      <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <span>{entry.user}</span>
                          <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {entry.fromStatus} <ChevronRight size={10} className="text-slate-300"/> {entry.toStatus}
                        </p>
                        <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">"{entry.comment}"</p>
                      </div>
                    </div>
                  ))}
                  {selectedEvent.history.length === 0 && (
                    <div className="py-4 text-center">
                       <p className="text-xs text-slate-400 italic font-medium">Nenhum histórico registrado.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
              <div className="flex gap-4">
                 <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:bg-black transition-all flex items-center gap-2">
                   <Settings2 size={18}/> Opções
                 </button>
              </div>
              <button 
                onClick={() => {
                  const nextStatusMap: any = {
                    [EventStatus.WAITING]: EventStatus.QUOTING,
                    [EventStatus.QUOTING]: EventStatus.APPROVED,
                    [EventStatus.APPROVED]: EventStatus.COMPLETED,
                    [EventStatus.COMPLETED]: EventStatus.WAITING,
                  };
                  setStatusChange({ eventId: selectedEvent.id, current: selectedEvent.status, next: nextStatusMap[selectedEvent.status] });
                }}
                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase tracking-widest"
              >
                Próximo Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cadastro de Evento - Branco Refinado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Novo Registro de Sinistro</h3>
                <p className="text-xs text-slate-500 font-medium">Preencha as informações para iniciar a governança do evento.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800 rounded-full transition-all"><X size={20}/></button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de Ocorrência</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as EventType})}
                  >
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Categoria</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Selecione (Opcional)</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Veículo e Associado</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                    >
                      <option value="">Placa do Veículo</option>
                      {MOCK_VEHICLES.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                    </select>
                    <select 
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      value={formData.associateId}
                      onChange={(e) => setFormData({...formData, associateId: e.target.value})}
                    >
                      <option value="">Associado</option>
                      {MOCK_ASSOCIATES.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Relato do Evento</label>
                  <textarea 
                    rows={4}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
                    placeholder="Descreva brevemente o ocorrido..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors">Descartar</button>
                 <button type="submit" className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">Registrar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Central Modal para Auditoria de Status */}
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
