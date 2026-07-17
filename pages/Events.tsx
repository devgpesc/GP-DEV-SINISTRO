
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Eye, X, AlertCircle, 
  FileText, Trash2, ShieldAlert, Edit3, User, Link as LinkIcon, Lock, CheckCircle2,
  Filter, Calendar, Paperclip, Image as ImageIcon, Download, File, Loader2, UserPlus
} from 'lucide-react';
import { EventStatus, EventType, Priority, Event, Vehicle, Associate } from '../types';
import { supabase } from '../services/supabaseClient';
import { eventService } from '../services/eventService';
import { useToast } from '../context/ToastContext';
import PremiumModal, { FormSection, FieldLabel, fieldClassName } from '../components/PremiumModal';
import { useEventTypes } from '../hooks/useEventTypes';
import { ATTACHMENT_ACCEPT } from '../utils/defaults';
import { getAttachmentKind } from '../services/attachmentService';
import { quickCreateAssociate, quickCreateVehicle } from '../services/quickRegisterService';
import { lookupService } from '../services/lookupService';
import FileViewerModal from '../components/FileViewerModal';

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
  const { eventTypes } = useEventTypes();
  const [events, setEvents] = useState<Event[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para Filtros Avançados
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    type: '',
    responsible: '',
    startDate: '',
    endDate: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerFile, setViewerFile] = useState<{ name: string; type: string; url: string } | null>(null);

  const [formData, setFormData] = useState({
    protocolMode: 'auto' as 'auto' | 'manual',
    manualProtocol: '',
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    vehicleId: '',
    associateId: '',
    description: '',
    participationQuota: '',
    attachments: [] as any[]
  });
  const [showQuickAssociate, setShowQuickAssociate] = useState(false);
  const [showQuickVehicle, setShowQuickVehicle] = useState(false);
  const [quickAssociate, setQuickAssociate] = useState({ name: '', document: '', type: 'PF' as 'PF' | 'PJ' });
  const [quickVehicle, setQuickVehicle] = useState({ plate: '' });
  const [isQuickSaving, setIsQuickSaving] = useState(false);

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
      vehicleId: evt.vehicleId,
      associateId: evt.associateId,
      description: evt.description,
      participationQuota: evt.participation_quota != null ? String(evt.participation_quota) : '',
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
        vehicleId: '',
        associateId: '',
        description: '',
        participationQuota: '',
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
        type: file.type || getAttachmentKind('', file.name),
        size: (file.size / 1024).toFixed(2) + ' KB',
        url: URL.createObjectURL(file),
        file,
        isNew: true,
        createdAt: new Date().toISOString()
      }));
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAttachment = (att: any) => {
    setViewerFile({ name: att.name, type: att.type, url: att.url });
  };

  const handleQuickAssociateDocLookup = async () => {
    const cleanDoc = quickAssociate.document.replace(/\D/g, '');
    if (quickAssociate.type !== 'PJ' || cleanDoc.length !== 14) return;
    setIsQuickSaving(true);
    try {
      const data = await lookupService.fetchCNPJ(cleanDoc);
      if (data) {
        setQuickAssociate(prev => ({
          ...prev,
          name: data.fantasy || data.name || prev.name,
        }));
        addToast('success', 'CNPJ encontrado', 'Dados preenchidos automaticamente.');
      }
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleQuickAssociateSave = async () => {
    if (!quickAssociate.name.trim()) {
      addToast('warning', 'Nome obrigatório', 'Informe o nome do associado.');
      return;
    }
    setIsQuickSaving(true);
    try {
      const id = await quickCreateAssociate({
        name: quickAssociate.name,
        document: quickAssociate.document,
        type: quickAssociate.type,
      });
      const { data: as } = await supabase.from('associates').select('*');
      setAssociates(as || []);
      setFormData(prev => ({ ...prev, associateId: id, vehicleId: '' }));
      setShowQuickAssociate(false);
      setQuickAssociate({ name: '', document: '', type: 'PF' });
      addToast('success', 'Associado criado', 'Vincule o veículo envolvido.');
    } catch (error: any) {
      addToast('error', 'Erro', error.message || 'Falha no cadastro rápido.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleQuickVehicleSave = async () => {
    if (!formData.associateId) {
      addToast('warning', 'Associado obrigatório', 'Selecione ou cadastre o associado primeiro.');
      return;
    }
    setIsQuickSaving(true);
    try {
      const id = await quickCreateVehicle({ plate: quickVehicle.plate, associateId: formData.associateId });
      const { data: vs } = await supabase.from('vehicles').select('*');
      setVehicles(vs || []);
      setFormData(prev => ({ ...prev, vehicleId: id }));
      setShowQuickVehicle(false);
      setQuickVehicle({ plate: '' });
      addToast('success', 'Veículo criado', 'Veículo vinculado ao sinistro.');
    } catch (error: any) {
      addToast('error', 'Erro', error.message || 'Falha no cadastro rápido.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const removeAttachment = async (att: any) => {
    if (att.id && !att.isNew && eventToEdit) {
      try {
        await eventService.removeAttachment(att.id, att.url);
      } catch {
        addToast('error', 'Erro', 'Não foi possível remover o anexo.');
        return;
      }
    }
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== att.id)
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
            category: formData.type,
            vehicleId: formData.vehicleId,
            associateId: formData.associateId,
            description: formData.description,
            participation_quota: formData.participationQuota ? Number(formData.participationQuota) : null,
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
      if (!eventToDelete || isDeleting) return;
      setIsDeleting(true);
      try {
        await eventService.deleteEvent(eventToDelete.id);
        setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
        setEventToDelete(null);
        addToast('success', 'Excluído', 'Registro removido permanentemente.');
      } catch (e: any) {
        console.error(e);
        addToast('error', 'Erro', e?.message || 'Não foi possível excluir o sinistro.');
      } finally {
        setIsDeleting(false);
      }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      type: '',
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
    if (filters.type && e.type !== filters.type) return false;
    
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
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</label>
               <select className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
                 <option value="">Todos</option>
                 {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
              <button onClick={() => setEventToDelete(null)} disabled={isDeleting} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] disabled:opacity-60 flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 className="animate-spin" size={14} /> : null}
                {isDeleting ? 'Excluindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PremiumModal
        open={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        busy={isSaving}
        title={eventToEdit ? 'Editar Sinistro' : 'Registro de Sinistro'}
        subtitle="Preencha o vínculo, detalhes e evidências do ocorrido."
        icon={ShieldAlert}
        maxWidthClass="max-w-4xl"
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3.5 text-slate-500 font-bold text-sm rounded-2xl hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isFormLocked || isSaving}
              className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <ShieldAlert size={16} />}
              {isSaving ? 'Salvando...' : 'Salvar Sinistro'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {selectedAssociateObj && selectedVehicleObj && (
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white/15 rounded-xl shrink-0"><LinkIcon size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Vínculo confirmado</p>
                  <p className="font-bold text-sm truncate">{selectedAssociateObj.name} • {selectedVehicleObj.plate}</p>
                </div>
              </div>
              <CheckCircle2 size={22} className="text-emerald-200 shrink-0" />
            </div>
          )}

          <FormSection
            step={1}
            title="Vínculo do sinistro"
            description="Selecione associado e veículo envolvido."
            complete={!!formData.associateId && !!formData.vehicleId}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Associado / Terceiro</FieldLabel>
                <select
                  className={fieldClassName}
                  value={formData.associateId}
                  onChange={(e) => setFormData({ ...formData, associateId: e.target.value, vehicleId: '' })}
                  disabled={!!eventToEdit}
                >
                  <option value="">Selecione o associado...</option>
                  {associates.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.document})</option>
                  ))}
                </select>
                {!eventToEdit && (
                  <button
                    type="button"
                    onClick={() => { setShowQuickAssociate(v => !v); setShowQuickVehicle(false); }}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus size={12} /> {showQuickAssociate ? 'Fechar cadastro rápido' : 'Cadastro rápido'}
                  </button>
                )}
                {showQuickAssociate && !eventToEdit && (
                  <div className="mt-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                      <button type="button" onClick={() => setQuickAssociate(p => ({ ...p, type: 'PF' }))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${quickAssociate.type === 'PF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>PF</button>
                      <button type="button" onClick={() => setQuickAssociate(p => ({ ...p, type: 'PJ' }))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${quickAssociate.type === 'PJ' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>PJ</button>
                    </div>
                    <input className={fieldClassName} placeholder="Nome / Razão social *" value={quickAssociate.name} onChange={e => setQuickAssociate(p => ({ ...p, name: e.target.value }))} />
                    <input className={fieldClassName} placeholder={quickAssociate.type === 'PJ' ? 'CNPJ (busca automática)' : 'CPF (opcional)'} value={quickAssociate.document} onChange={e => setQuickAssociate(p => ({ ...p, document: e.target.value }))} onBlur={handleQuickAssociateDocLookup} />
                    <button type="button" disabled={isQuickSaving} onClick={handleQuickAssociateSave} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50">
                      {isQuickSaving ? 'Salvando...' : 'Criar e vincular'}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel required>Veículo envolvido</FieldLabel>
                <select
                  className={fieldClassName}
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  disabled={!formData.associateId || !!eventToEdit}
                >
                  <option value="">
                    {!formData.associateId
                      ? 'Selecione o associado primeiro'
                      : availableVehicles.length > 0
                        ? 'Selecione o veículo...'
                        : 'Nenhum veículo cadastrado'}
                  </option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>
                  ))}
                </select>
                {!eventToEdit && formData.associateId && (
                  <button
                    type="button"
                    onClick={() => { setShowQuickVehicle(v => !v); setShowQuickAssociate(false); }}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus size={12} /> {showQuickVehicle ? 'Fechar cadastro rápido' : 'Cadastro rápido de veículo'}
                  </button>
                )}
                {showQuickVehicle && formData.associateId && !eventToEdit && (
                  <div className="mt-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
                    <input className={`${fieldClassName} uppercase`} placeholder="Placa *" value={quickVehicle.plate} onChange={e => setQuickVehicle({ plate: e.target.value })} maxLength={8} />
                    <button type="button" disabled={isQuickSaving} onClick={handleQuickVehicleSave} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50">
                      {isQuickSaving ? 'Salvando...' : 'Criar e vincular'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Detalhes do evento"
            description="Protocolo, tipo e descrição do ocorrido."
            locked={isFormLocked}
            complete={!isFormLocked && !!formData.description.trim()}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <FieldLabel>Modo protocolo</FieldLabel>
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, protocolMode: 'auto' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'auto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, protocolMode: 'manual' })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Protocolo</FieldLabel>
                  <input
                    disabled={formData.protocolMode === 'auto'}
                    className={fieldClassName}
                    value={formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol}
                    onChange={(e) => setFormData({ ...formData, manualProtocol: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <FieldLabel required>Tipo de sinistro</FieldLabel>
                <select
                  className={fieldClassName}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Cota de participação do veículo</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClassName}
                  value={formData.participationQuota}
                  onChange={(e) => setFormData({ ...formData, participationQuota: e.target.value })}
                  placeholder="R$ 0,00 (opcional)"
                />
              </div>
              <div>
                <FieldLabel>Descrição do ocorrido</FieldLabel>
                <textarea
                  className={`${fieldClassName} min-h-[120px] resize-none`}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o que aconteceu, local, danos visíveis..."
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            step={3}
            title="Documentos e evidências"
            description="Fotos, vídeos, laudos, PDFs e documentos do sinistro."
            locked={isFormLocked}
          >
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar arquivo
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple accept={ATTACHMENT_ACCEPT} />
            </div>
            {formData.attachments.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                <Paperclip size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-400">Nenhum anexo — opcional nesta etapa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formData.attachments.map((att: any) => (
                  <div key={att.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 group">
                    <button type="button" onClick={() => openAttachment(att)} className="w-11 h-11 bg-white rounded-xl flex items-center justify-center border overflow-hidden shrink-0 hover:border-blue-300">
                      {String(att.type).startsWith('image/') || att.type === 'image' ? (
                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                      ) : String(att.type).startsWith('video/') || att.type === 'video' ? (
                        <ImageIcon size={18} className="text-blue-500" />
                      ) : (
                        <File size={18} className="text-slate-400" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                      <p className="text-[10px] text-slate-400">{att.size}</p>
                    </div>
                    <button type="button" onClick={() => openAttachment(att)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Abrir">
                      <Eye size={14} />
                    </button>
                    <button type="button" onClick={() => removeAttachment(att)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </div>
      </PremiumModal>
      <FileViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};

export default Events;
