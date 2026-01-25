
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, MoreVertical, Eye, MessageSquare, FileCheck, X, AlertCircle, 
  Upload, FileText, Image as ImageIcon, Trash2, Download, User as UserIcon, 
  Car as CarIcon, Tag, ChevronRight, History, Settings2, ShieldAlert,
  Hash, Zap, Edit3, Clock, Paperclip, Filter
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_VEHICLES, MOCK_ASSOCIATES } from '../constants';
import { EventStatus, EventType, Priority, Event, Category } from '../types';
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
  const [categories, setCategories] = useState<Category[]>([]);
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
    const savedEvents = mockStorage.get('events') || MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] }));
    setEvents(savedEvents);

    const savedCategories = mockStorage.get('app_categories') || [
      { id: '1', name: 'Funilaria Pesada', color: 'red' },
      { id: '2', name: 'Funilaria Leve', color: 'orange' },
      { id: '3', name: 'Mecânica', color: 'blue' },
      { id: '4', name: 'Elétrica', color: 'yellow' },
      { id: '5', name: 'Periféricos / Vidros', color: 'cyan' },
    ];
    setCategories(savedCategories);
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
      alert("A categoria é obrigatória. Selecione uma opção padronizada.");
      return;
    }

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

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const lowSearch = searchTerm.toLowerCase();
    
    return events.filter(e => {
      // Cruzar dados para filtro avançado
      const associate = MOCK_ASSOCIATES.find(a => a.id === e.associateId);
      const vehicle = MOCK_VEHICLES.find(v => v.id === e.vehicleId);
      
      return (
        e.protocol.toLowerCase().includes(lowSearch) ||
        (associate && associate.name.toLowerCase().includes(lowSearch)) ||
        (vehicle && vehicle.plate.toLowerCase().includes(lowSearch)) ||
        e.category.toLowerCase().includes(lowSearch)
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
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 whitespace-nowrap"
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
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo / Categoria</th>
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{vehicle?.model || '-'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-bold text-slate-700">{evt.type}</p>
                    <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-0.5">{evt.category}</p>
                  </td>
                  <td className="px-8 py-5"><PriorityBadge priority={evt.priority} /></td>
                  <td className="px-8 py-5">
                    <StatusBadge 
                      status={evt.status} 
                      onClick={() => setStatusChange({ eventId: evt.id, current: evt.status, next: EventStatus.QUOTING })} 
                    />
                  </td>
                  <td className="px-8 py-5 text-right">
                     <button onClick={() => setSelectedEvent(evt)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Eye size={20}/></button>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
        {filteredEvents.length === 0 && (
          <div className="py-20 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Search size={32} />
             </div>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum evento encontrado para esta busca</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-600/20"><ShieldAlert size={24} /></div>
                Registro de Sinistro
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                <X size={24}/>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                
                {/* Protocolo Section */}
                <div className="col-span-2 p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Modo de Protocolo</label>
                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, protocolMode: 'auto'})}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.protocolMode === 'auto' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Zap size={14}/> Automático
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, protocolMode: 'manual'})}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.protocolMode === 'manual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Edit3 size={14}/> Manual
                      </button>
                    </div>
                  </div>
                  <div className="flex-[1.5]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Protocolo Gerado</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        disabled={formData.protocolMode === 'auto'}
                        placeholder={formData.protocolMode === 'auto' ? nextAutoProtocol : 'Ex: EVT-001'}
                        className={`w-full pl-12 pr-4 py-3 bg-white border rounded-2xl font-black outline-none transition-all ${formData.protocolMode === 'auto' ? 'border-transparent text-blue-600' : 'border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-800'}`}
                        value={formData.protocolMode === 'auto' ? '' : formData.manualProtocol}
                        onChange={(e) => setFormData({...formData, manualProtocol: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Tipo de Sinistro</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Prioridade</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700" 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value as any})}
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Categoria Padronizada <span className="text-red-500">*</span></label>
                  <div className="relative">
                     <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                     <select 
                        required
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-black text-slate-800"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                     >
                        <option value="">Selecione a Categoria...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </select>
                  </div>
                </div>

                <div className="col-span-2">
                   <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Anexar Documentação</label>
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
                    className="border-2 border-dashed border-slate-100 rounded-3xl p-8 text-center hover:bg-slate-50 hover:border-blue-200 transition-all cursor-pointer group"
                   >
                      <Upload className="mx-auto text-slate-300 mb-2 group-hover:text-blue-400 transition-colors" size={32} />
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Selecionar arquivos de mídia ou documentos</p>
                   </div>
                   
                   {formData.attachments.length > 0 && (
                     <div className="mt-4 grid grid-cols-1 gap-2">
                       {formData.attachments.map((file, index) => (
                         <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-1">
                           <div className="flex items-center gap-3 overflow-hidden">
                             <div className="p-2 bg-white rounded-xl text-blue-500 shadow-sm">
                               {file.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                             </div>
                             <span className="text-xs font-bold text-slate-600 truncate">{file.name}</span>
                             <span className="text-[10px] text-slate-400 whitespace-nowrap">({(file.size / 1024).toFixed(0)} KB)</span>
                           </div>
                           <button 
                            type="button" 
                            onClick={() => removeAttachment(index)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Descrição Operacional</label>
                  <textarea 
                    className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 h-28 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-700 resize-none" 
                    placeholder="Descreva detalhes do ocorrido, danos visíveis e observações técnicas..."
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                   Criar Protocolo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[48px] shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                 <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-lg"><FileText size={32}/></div>
                 <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{selectedEvent.protocol}</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{selectedEvent.category}</p>
                 </div>
               </div>
               <button onClick={() => setSelectedEvent(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><X size={32}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
               <div className="lg:col-span-2 space-y-10">
                  <div className="p-8 bg-slate-50/50 rounded-[40px] border border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Relatório de Sinistro</p>
                    <p className="text-lg text-slate-700 leading-relaxed font-medium italic">"{selectedEvent.description || 'Nenhum detalhe textual registrado.'}"</p>
                  </div>
                  
                  {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentação Anexa ({selectedEvent.attachments.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedEvent.attachments.map((att, idx) => (
                          <div key={idx} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all cursor-pointer group">
                            <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <Paperclip size={20} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-slate-700 truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase">Baixar</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Natureza</p>
                      <p className="text-lg font-black text-slate-800">{selectedEvent.type}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto / Urgência</p>
                      <PriorityBadge priority={selectedEvent.priority} />
                    </div>
                  </div>
               </div>
               <div className="border-l border-slate-100 pl-0 lg:pl-10">
                  <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-3"><History size={20} className="text-slate-300"/> Linha do Tempo</h4>
                  <div className="space-y-8 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                     {selectedEvent.history.length > 0 ? selectedEvent.history.map(h => (
                       <div key={h.id} className="relative pl-8">
                          <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-white border-4 border-blue-500 shadow-sm"></div>
                          <p className="font-black text-[11px] text-blue-600 uppercase tracking-widest">{h.toStatus}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                          <p className="text-sm text-slate-600 mt-3 italic font-medium leading-relaxed">"{h.comment}"</p>
                          <div className="mt-3 flex items-center gap-2">
                             <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[8px] font-black uppercase">{h.user.charAt(0)}</div>
                             <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{h.user}</p>
                          </div>
                       </div>
                     )) : (
                       <div className="text-center py-12 bg-slate-50 rounded-[32px] border border-slate-100">
                         <Clock className="mx-auto mb-3 text-slate-200" size={32} />
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Movimentação</p>
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
