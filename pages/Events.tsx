
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, MoreVertical, Eye, MessageSquare, FileCheck, X, AlertCircle, 
  Upload, FileText, Image as ImageIcon, Trash2, Download, User as UserIcon, 
  Car as CarIcon, Tag, ChevronRight, History, Settings2, ShieldAlert,
  Hash, Zap, Edit3, Clock, Paperclip
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    protocolMode: 'auto' as 'auto' | 'manual',
    manualProtocol: '',
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    category: '',
    vehicleId: '',
    associateId: '',
    description: '',
    attachments: [] as File[]
  });

  useEffect(() => {
    const saved = mockStorage.get('events') || MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] }));
    setEvents(saved);
  }, []);

  const nextAutoProtocol = useMemo(() => {
    return `EVT-2024-${String(events.length + 1).padStart(4, '0')}`;
  }, [events]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const protocol = formData.protocolMode === 'auto' ? nextAutoProtocol : formData.manualProtocol;

    if (!protocol) {
      alert("O protocolo é obrigatório.");
      return;
    }

    if (!formData.category) {
      alert("A categoria é obrigatória.");
      return;
    }

    // Convert Files to simple object metadata for mock storage
    const attachmentsMetadata = formData.attachments.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      lastModified: f.lastModified
    }));

    const newEvent: Event = {
      id: Math.random().toString(36).substr(2, 9),
      protocol: protocol,
      type: formData.type,
      priority: formData.priority,
      status: EventStatus.WAITING,
      category: formData.category,
      vehicleId: formData.vehicleId || 'v1',
      associateId: formData.associateId || 'a1',
      createdAt: new Date().toISOString(),
      createdBy: 'Admin Master',
      description: formData.description,
      attachments: attachmentsMetadata,
      history: []
    };

    const updated = [newEvent, ...events];
    setEvents(updated);
    mockStorage.set('events', updated);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ 
      protocolMode: 'auto',
      manualProtocol: '',
      type: EventType.COLLISION, 
      priority: Priority.MEDIUM, 
      category: '', 
      vehicleId: '', 
      associateId: '', 
      description: '', 
      attachments: [] 
    });
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
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="text-blue-600" size={24} />
                Novo Registro de Sinistro
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                <X size={24}/>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                
                {/* Protocolo Section */}
                <div className="col-span-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Modo do Protocolo</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, protocolMode: 'auto'})}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${formData.protocolMode === 'auto' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Zap size={14}/> Automático
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, protocolMode: 'manual'})}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${formData.protocolMode === 'manual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Edit3 size={14}/> Manual
                      </button>
                    </div>
                  </div>
                  <div className="flex-[1.5]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Protocolo</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        disabled={formData.protocolMode === 'auto'}
                        placeholder={formData.protocolMode === 'auto' ? nextAutoProtocol : 'Ex: EVT-001'}
                        className={`w-full pl-10 pr-4 py-2 bg-white border rounded-xl font-bold outline-none transition-all ${formData.protocolMode === 'auto' ? 'border-transparent text-blue-600 opacity-80' : 'border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-800'}`}
                        value={formData.protocolMode === 'auto' ? '' : formData.manualProtocol}
                        onChange={(e) => setFormData({...formData, manualProtocol: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Tipo</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Prioridade</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium" 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value as any})}
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Categoria <span className="text-red-500">*</span></label>
                  <input 
                    required
                    type="text"
                    placeholder="Ex: Funilaria Pesada, Periféricos, etc."
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium" 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div className="col-span-2">
                   <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Anexar Imagem/Documento</label>
                   <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                   />
                   <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-100 rounded-2xl p-6 text-center hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer group"
                   >
                      <Upload className="mx-auto text-slate-300 mb-2 group-hover:text-blue-400 transition-colors" size={32} />
                      <p className="text-xs text-slate-400 font-medium">Clique para selecionar arquivos ou arraste aqui</p>
                   </div>
                   
                   {formData.attachments.length > 0 && (
                     <div className="mt-4 grid grid-cols-1 gap-2">
                       {formData.attachments.map((file, index) => (
                         <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 animate-in slide-in-from-top-1">
                           <div className="flex items-center gap-2 overflow-hidden">
                             <div className="p-1.5 bg-white rounded-md text-blue-500">
                               {file.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                             </div>
                             <span className="text-xs font-medium text-slate-600 truncate">{file.name}</span>
                             <span className="text-[10px] text-slate-400 whitespace-nowrap">({(file.size / 1024).toFixed(0)} KB)</span>
                           </div>
                           <button 
                            type="button" 
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Descrição</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 h-24 outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none" 
                    placeholder="Descreva detalhes do sinistro..."
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                   Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <h2 className="text-2xl font-black text-slate-800">{selectedEvent.protocol}</h2>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedEvent.category}</p>
               </div>
               <button onClick={() => setSelectedEvent(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Descrição do Evento</p>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedEvent.description || 'Nenhuma descrição fornecida.'}</p>
                  </div>
                  
                  {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Anexos ({selectedEvent.attachments.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedEvent.attachments.map((att, idx) => (
                          <div key={idx} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center gap-3 hover:border-blue-200 transition-all cursor-pointer">
                            <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                              <Paperclip size={16} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400">Clique para baixar</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tipo de Evento</p>
                      <p className="font-bold text-slate-800">{selectedEvent.type}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Prioridade</p>
                      <PriorityBadge priority={selectedEvent.priority} />
                    </div>
                  </div>
               </div>
               <div className="border-l border-slate-100 pl-0 lg:pl-8">
                  <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><History size={16}/> Histórico do Evento</h4>
                  <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                     {selectedEvent.history.length > 0 ? selectedEvent.history.map(h => (
                       <div key={h.id} className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-500"></div>
                          <p className="font-black text-[10px] text-blue-600 uppercase tracking-tighter">{h.toStatus}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                          <p className="text-xs text-slate-600 mt-2 italic font-medium">"{h.comment}"</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-1">Por: {h.user}</p>
                       </div>
                     )) : (
                       <div className="text-center py-10 opacity-50">
                         <Clock className="mx-auto mb-2 text-slate-300" size={32} />
                         <p className="text-xs font-bold text-slate-400">Nenhuma movimentação registrada.</p>
                       </div>
                     )}
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
