
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Eye, X, AlertCircle, 
  FileText, Trash2, ShieldAlert, Edit3, User, Link as LinkIcon, Lock, CheckCircle2,
  Filter, Calendar, Paperclip, Image as ImageIcon, Download, File, Loader2
} from 'lucide-react';
import { EventStatus, EventType, Priority, Event, Vehicle, Associate } from '../types';
import { supabase } from '../services/supabaseClient';
import { eventService } from '../services/eventService';
import { useToast } from '../context/ToastContext';

const StatusBadge = ({ status }: { status: EventStatus }) => {
  const styles: any = {
    [EventStatus.WAITING]: 'bg-slate-100 text-slate-600 border-slate-200',
    [EventStatus.QUOTING]: 'bg-blue-50 text-blue-600 border-blue-100',
    [EventStatus.APPROVED]: 'bg-green-50 text-green-600 border-green-100',
    [EventStatus.COMPLETED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
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
  const { addToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para Filtros Avançados
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    responsible: '',
    startDate: '',
    endDate: ''
  });

  const PREDEFINED_CATEGORIES = ['Mecânica', 'Elétrica', 'Funilaria', 'Seguro', 'Outros'];
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
    attachments: [] as any[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const eventsData = await eventService.getEvents();
        setEvents(eventsData);
        
        const { data: as } = await supabase.from('associates').select('*');
        setAssociates(as || []);
        
        const { data: vs } = await supabase.from('vehicles').select('*');
        setVehicles(vs || []);
    } catch (e) {
        console.error('Erro ao carregar eventos:', e);
        addToast('error', 'Erro', 'Falha ao carregar dados do servidor.');
    }
  };

  const nextAutoProtocol = useMemo(() => {
    return `EVT-${new Date().getFullYear()}-${String(events.length + 1).padStart(4, '0')}`;
  }, [events]);

  const availableVehicles = useMemo(() => {
    if (!formData.associateId) return [];
    return vehicles.filter(v => v.associate_id === formData.associateId);
  }, [vehicles, formData.associateId]);

  const isFormLocked = !formData.associateId || !formData.vehicleId;

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

  const handleOpenNew = () => {
    setEventToEdit(null);
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
    setIsModalOpen(true);
  };

  // --- Lógica de Anexos ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newAttachments = Array.from(files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(2) + ' KB',
        url: URL.createObjectURL(file), // Simula URL para preview
        createdAt: new Date().toISOString()
      }));
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== id)
    }));
  };
  // -----------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormLocked) {
        addToast('warning', 'Campos Incompletos', 'Selecione um Associado e um Veículo.');
        return;
    }

    setIsSaving(true);
    try {
        const protocol = formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol;
        
        const eventData: Partial<Event> = {
            id: eventToEdit ? eventToEdit.id : undefined,
            protocol,
            type: formData.type,
            priority: formData.priority,
            category: formData.category || 'Não categorizado',
            vehicleId: formData.vehicleId,
            associateId: formData.associateId,
            description: formData.description,
            attachments: formData.attachments,
            status: eventToEdit ? eventToEdit.status : EventStatus.WAITING,
            history: eventToEdit ? eventToEdit.history : []
        };

        if (eventToEdit) {
            // CORREÇÃO: Usa o método seguro do service que remove campos inválidos
            await eventService.updateEvent(eventToEdit.id, eventData);
            addToast('success', 'Sinistro Atualizado', 'As alterações foram salvas com sucesso.');
        } else {
            await eventService.createEvent(eventData);
            addToast('success', 'Sinistro Criado', `Protocolo ${protocol} gerado.`);
        }
        
        loadData();
        setIsModalOpen(false);
        setEventToEdit(null);
    } catch (error: any) {
        console.error(error);
        addToast('error', 'Erro ao Salvar', error.message || 'Ocorreu um erro inesperado.');
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
      if (eventToDelete) {
          try {
            await supabase.from('events').delete().eq('id', eventToDelete.id);
            setEvents(events.filter(e => e.id !== eventToDelete.id));
            setEventToDelete(null);
            addToast('success', 'Excluído', 'Registro removido permanentemente.');
          } catch (e) {
            addToast('error', 'Erro', 'Não foi possível excluir o evento.');
          }
      }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      responsible: '',
      startDate: '',
      endDate: ''
    });
    setSearchTerm('');
  };

  const filteredEvents = events.filter(e => {
    const associate = associates.find(a => a.id === e.associateId);
    const vehicle = vehicles.find(v => v.id === e.vehicleId);
    
    // Filtro de Texto Global
    const lowSearch = searchTerm.toLowerCase();
    const matchesSearch = 
      e.protocol.toLowerCase().includes(lowSearch) ||
      associate?.name.toLowerCase().includes(lowSearch) ||
      vehicle?.plate.toLowerCase().includes(lowSearch);

    if (!matchesSearch) return false;

    // Filtros Específicos
    if (filters.status && e.status !== filters.status) return false;
    if (filters.priority && e.priority !== filters.priority) return false;
    if (filters.category && e.category !== filters.category) return false;
    
    // Filtro de Datas
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      const eventDate = new Date(e.createdAt);
      if (eventDate < start) return false;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59);
      const eventDate = new Date(e.createdAt);
      if (eventDate > end) return false;
    }

    return true;
  });

  const selectedAssociateObj = associates.find(a => a.id === formData.associateId);
  const selectedVehicleObj = vehicles.find(v => v.id === formData.vehicleId);

  return (
    <div className="space-y-6">
      {/* Search & Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1">
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
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-slate-100 border-slate-300 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title="Filtros Avançados"
          >
            <Filter size={20} />
          </button>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap"
        >
          <Plus size={18} /> Novo Sinistro
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
             <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Filter size={14}/> Filtros Avançados</h4>
             <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest">Limpar Filtros</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
               <select className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                 <option value="">Todos</option>
                 {Object.values(EventStatus).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Prioridade</label>
               <select className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})}>
                 <option value="">Todas</option>
                 {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label>
               <select className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
                 <option value="">Todas</option>
                 {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">De (Data)</label>
               <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Até (Data)</label>
               <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
             </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo / Cliente</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa / Veículo</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Prioridade</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEvents.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-8 py-12 text-center text-slate-400">
                    <p className="text-sm font-bold">Nenhum sinistro encontrado com os filtros atuais.</p>
                 </td>
               </tr>
            ) : filteredEvents.map(evt => {
               const associate = associates.find(a => a.id === evt.associateId);
               const vehicle = vehicles.find(v => v.id === evt.vehicleId);
               return (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-800 leading-none mb-1">{evt.protocol}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{associate?.name || '---'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg inline-block text-[11px] border border-slate-200 mb-1">{vehicle?.plate || '---'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase block">{vehicle?.model}</p>
                  </td>
                  <td className="px-8 py-5"><div className="flex justify-center"><PriorityBadge priority={evt.priority} /></div></td>
                  <td className="px-8 py-5 text-center"><StatusBadge status={evt.status} /></td>
                  <td className="px-8 py-5 text-right flex items-center justify-end gap-1">
                     <button onClick={() => handleEdit(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Eye size={18}/></button>
                     <button onClick={() => setEventToDelete(evt)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEventToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert size={40} /></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Sinistro?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Você está prestes a remover o protocolo <span className="font-black text-slate-800">{eventToDelete.protocol}</span>.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setEventToDelete(null)} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={handleDelete} className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px]">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><div className="bg-blue-600 p-2.5 rounded-2xl text-white"><ShieldAlert size={24} /></div>{eventToEdit ? 'Editar Sinistro' : 'Registro de Sinistro'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
              {selectedAssociateObj && selectedVehicleObj && (
                  <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-between animate-in slide-in-from-top-4">
                      <div className="flex items-center gap-4">
                          <div className="p-2 bg-white/20 rounded-xl"><LinkIcon size={20}/></div>
                          <div><p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Vínculo Confirmado</p><p className="font-bold text-sm">{selectedAssociateObj.name} <span className="opacity-50 mx-1">•</span> {selectedVehicleObj.plate} ({selectedVehicleObj.model})</p></div>
                      </div>
                      <CheckCircle2 size={24} className="text-blue-200"/>
                  </div>
              )}
              
              {/* SECTION 1: Vínculo */}
              <section className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><User size={16} className="text-blue-600"/> 1. Definição de Vínculo (Obrigatório)</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Associado / Proprietário</label>
                        <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none" value={formData.associateId} onChange={e => { setFormData({ ...formData, associateId: e.target.value, vehicleId: '' }); }} disabled={!!eventToEdit}>
                            <option value="">Selecione o Associado...</option>
                            {associates.map(a => <option key={a.id} value={a.id}>{a.name} ({a.document})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Veículo Envolvido</label>
                        <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none disabled:opacity-50" value={formData.vehicleId} onChange={e => setFormData({ ...formData, vehicleId: e.target.value })} disabled={!formData.associateId || !!eventToEdit}>
                            <option value="">{formData.associateId ? (availableVehicles.length > 0 ? 'Selecione o Veículo...' : 'Nenhum veículo encontrado') : 'Aguardando Associado...'}</option>
                            {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                        </select>
                    </div>
                 </div>
                 {!formData.associateId && <div className="mt-4 p-3 bg-amber-50 text-amber-600 text-xs font-bold rounded-xl flex items-center gap-2"><AlertCircle size={16}/> Selecione um associado para habilitar a lista de veículos.</div>}
              </section>

              {/* SECTION 2: Detalhes */}
              <section className={`bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm transition-all duration-300 ${isFormLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><FileText size={16} className="text-blue-600"/> 2. Detalhes do Evento {isFormLocked && <Lock size={14} className="text-slate-400"/>}</h4>
                 <div className="space-y-6">
                    <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Modo de Geração</label>
                        <div className="flex bg-white p-1 rounded-xl">
                          <button type="button" onClick={() => setFormData({...formData, protocolMode: 'auto'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.protocolMode === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Auto</button>
                          <button type="button" onClick={() => setFormData({...formData, protocolMode: 'manual'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.protocolMode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Manual</button>
                        </div>
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Protocolo</label>
                        <input disabled={formData.protocolMode === 'auto'} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-black outline-none text-slate-700" value={formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol} onChange={e => setFormData({...formData, manualProtocol: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Tipo</label><select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>{Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Categoria</label><select required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}><option value="">Selecione...</option>{PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    </div>
                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Descrição do Ocorrido</label><textarea className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 h-28 outline-none font-medium resize-none text-slate-700" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                 </div>
              </section>

              {/* SECTION 3: Anexos */}
              <section className={`bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm transition-all duration-300 ${isFormLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Paperclip size={16} className="text-blue-600"/> 3. Documentos e Evidências</h4>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"><Plus size={14}/> Adicionar Arquivo</button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple accept="image/*,application/pdf" />
                 </div>
                 
                 {formData.attachments.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                        <Paperclip size={32} className="mx-auto text-slate-300 mb-2"/>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Nenhum anexo adicionado</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formData.attachments.map((att: any) => (
                            <div key={att.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 relative group">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
                                    {att.type.startsWith('image/') ? (
                                        <img src={att.url} className="w-full h-full object-cover" />
                                    ) : (
                                        <File size={20} className="text-slate-400"/>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(att.createdAt).toLocaleDateString()} • {att.size}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {att.type.startsWith('image/') && (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50"><Eye size={14}/></a>
                                    )}
                                    <a href={att.url} download={att.name} className="p-1.5 bg-white text-green-600 rounded-lg shadow-sm hover:bg-green-50"><Download size={14}/></a>
                                    <button type="button" onClick={() => removeAttachment(att.id)} className="p-1.5 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
              </section>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 z-10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" onClick={handleSave} disabled={isFormLocked || isSaving} className="px-8 md:px-12 py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : (isFormLocked ? <Lock size={14}/> : <ShieldAlert size={16}/>)}
                  {isSaving ? 'Salvando...' : 'Salvar Sinistro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
