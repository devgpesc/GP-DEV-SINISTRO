
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
import { useAuth } from '../context/AuthContext';
import PremiumModal, { FormSection, FieldLabel, fieldClassName } from '../components/PremiumModal';
import { useEventTypes } from '../hooks/useEventTypes';
import { ATTACHMENT_ACCEPT } from '../utils/defaults';
import { getAttachmentKind, MAX_EVENT_ATTACHMENTS, validateEventAttachmentFile } from '../services/attachmentService';
import { quickCreateAssociate, quickCreateVehicle } from '../services/quickRegisterService';
import { isValidVehiclePlate, lookupService, normalizeVehiclePlate } from '../services/lookupService';
import FileViewerModal from '../components/FileViewerModal';
import { formatDateTimeBr, formatVehicleModelShort } from '../utils/vehicleLabel';
import SearchableSelect from '../components/SearchableSelect';
import {
  classifyPriorityScore,
  getDeadlineInfo,
  getDeadlineTone,
  getPriorityLabel,
  getPriorityTone,
  normalizePriorityScore,
} from '../utils/eventSla';

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

const prioritySelectClass = (priority: Priority) => {
  const map: Record<Priority, string> = {
    [Priority.LOW]: 'border-slate-200 bg-white text-slate-700 focus:ring-slate-200',
    [Priority.MEDIUM]: 'border-blue-200 bg-white text-blue-700 focus:ring-blue-100',
    [Priority.HIGH]: 'border-amber-200 bg-white text-amber-700 focus:ring-amber-100',
    [Priority.URGENT]: 'border-red-200 bg-white text-red-700 focus:ring-red-100',
  };
  return map[priority] || map[Priority.MEDIUM];
};

const ScheduleStatusBadge = ({ status }: { status?: Event['schedule_status'] }) => {
  const value = status || 'Em andamento';
  const styles: Record<string, string> = {
    'Sem prazo': 'bg-slate-50 text-slate-600 border-slate-200',
    Agendado: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Em andamento': 'bg-blue-50 text-blue-700 border-blue-200',
    'Em atraso': 'bg-red-50 text-red-700 border-red-200',
    Concluído: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase ${styles[value]}`}>{value}</span>;
};

const priorityOptions = [Priority.LOW, Priority.MEDIUM, Priority.URGENT];
const defaultScoreForPriority = (priority: Priority) => {
  if (priority === Priority.LOW) return 2;
  if (priority === Priority.URGENT) return 9;
  return 5;
};
const toDateInput = (value?: string | null) => value ? String(value).slice(0, 10) : '';
const deadlineRequiredTypes = new Set<string>([EventType.COLLISION, EventType.PERIPHERAL, EventType.AGREEMENT]);
const vehicleStageOptions = [
  'Ainda não entrou',
  'Aguardando entrada',
  'Em análise',
  'Em reparo',
  'Aguardando peças',
  'Pronto',
  'Liberado',
  'Entregue',
];

const Events: React.FC = () => {
  const { addToast } = useToast();
  const { currentTenant } = useAuth();
  const { eventTypes } = useEventTypes();
  const [events, setEvents] = useState<Event[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [eventDetail, setEventDetail] = useState<Event | null>(null);
  const [detailTab, setDetailTab] = useState<'resumo' | 'veiculo' | 'fluxo' | 'historico' | 'anexos'>('resumo');
  const [detailFlow, setDetailFlow] = useState<{ quotations: any[]; purchases: any[]; loading: boolean }>({
    quotations: [],
    purchases: [],
    loading: false,
  });
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingPriorityId, setUpdatingPriorityId] = useState<string | null>(null);
  
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
    priorityScore: 5,
    vehicleId: '',
    associateId: '',
    openedAt: toDateInput(new Date().toISOString()),
    deadlineAt: '',
    responsibleName: '',
    responsibleCompany: '',
    vehicleStage: 'Ainda não entrou',
    description: '',
    notes: '',
    participationQuota: '',
    attachments: [] as any[]
  });
  const [showQuickAssociate, setShowQuickAssociate] = useState(false);
  const [showQuickVehicle, setShowQuickVehicle] = useState(false);
  const [quickAssociate, setQuickAssociate] = useState({ name: '', document: '', type: 'PF' as 'PF' | 'PJ' });
  const [quickVehicle, setQuickVehicle] = useState({ plate: '' });
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [isQuickVehicleLookup, setIsQuickVehicleLookup] = useState(false);
  const [quickVehicleData, setQuickVehicleData] = useState<Partial<Vehicle> | null>(null);
  const [quickVehicleLookupError, setQuickVehicleLookupError] = useState<string | null>(null);
  const quickVehicleLookupSequenceRef = useRef(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showQuickVehicle || !formData.associateId || eventToEdit) return;
    const plate = normalizeVehiclePlate(quickVehicle.plate);
    setQuickVehicleData(null);
    setQuickVehicleLookupError(null);
    if (!isValidVehiclePlate(plate)) {
      setIsQuickVehicleLookup(false);
      return;
    }

    const requestSequence = ++quickVehicleLookupSequenceRef.current;
    const timer = window.setTimeout(async () => {
      setIsQuickVehicleLookup(true);
      try {
        const data = await lookupService.fetchPlate(plate);
        if (requestSequence !== quickVehicleLookupSequenceRef.current) return;
        setQuickVehicleData(data);
      } catch (error: any) {
        if (requestSequence !== quickVehicleLookupSequenceRef.current) return;
        setQuickVehicleLookupError(error?.message || 'Não foi possível consultar esta placa.');
      } finally {
        if (requestSequence === quickVehicleLookupSequenceRef.current) setIsQuickVehicleLookup(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [quickVehicle.plate, showQuickVehicle, formData.associateId, eventToEdit]);

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

  const [nextAutoProtocol, setNextAutoProtocol] = useState('EVT-...');

  const refreshNextProtocol = async () => {
    try {
      const protocol = await eventService.getNextProtocol(currentTenant?.id);
      setNextAutoProtocol(protocol);
    } catch {
      setNextAutoProtocol(`EVT-${new Date().getFullYear()}-0001`);
    }
  };

  const availableVehicles = useMemo(() => {
    if (!formData.associateId) return [];
    return vehicles.filter(v => v.associate_id === formData.associateId);
  }, [vehicles, formData.associateId]);

  const associateOptions = useMemo(() => associates.map((associate) => ({
    value: associate.id,
    label: associate.name,
    secondary: associate.document && !/^(0+)$/.test(associate.document)
      ? associate.document
      : 'Documento não informado',
    keywords: `${associate.name} ${associate.document || ''}`,
  })), [associates]);

  const vehicleOptions = useMemo(() => availableVehicles.map((vehicle) => ({
    value: vehicle.id,
    label: vehicle.plate,
    secondary: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Veículo sem descrição',
    keywords: `${vehicle.plate} ${vehicle.brand || ''} ${vehicle.model || ''}`,
  })), [availableVehicles]);

  const isFormLocked = !formData.associateId || !formData.vehicleId;

  const handleEdit = (evt: Event) => {
    setEventDetail(null);
    setEventToEdit(evt);
    setFormData({
      protocolMode: evt.protocol.startsWith('EVT') ? 'auto' : 'manual',
      manualProtocol: evt.protocol,
      type: evt.type,
      priority: getPriorityLabel((evt as any).priority_score, evt.priority),
      priorityScore: normalizePriorityScore((evt as any).priority_score, evt.priority),
      vehicleId: evt.vehicleId,
      associateId: evt.associateId,
      openedAt: toDateInput((evt as any).opened_at || evt.createdAt || (evt as any).created_at),
      deadlineAt: toDateInput((evt as any).deadline_at),
      responsibleName: (evt as any).responsible_name || '',
      responsibleCompany: (evt as any).responsible_company || '',
      vehicleStage: (evt as any).vehicle_stage || 'Ainda não entrou',
      description: evt.description,
      notes: (evt as any).notes || '',
      participationQuota: evt.participation_quota != null ? String(evt.participation_quota) : '',
      attachments: evt.attachments || []
    });
    setIsModalOpen(true);
  };

  const openEventDetail = async (evt: Event) => {
    setEventDetail(evt);
    setDetailTab('resumo');
    setDetailFlow({ quotations: [], purchases: [], loading: true });
    try {
      const { data: quotations } = await supabase
        .from('quotations')
        .select('id, code, status, created_at, deadline, participation_quota')
        .or(`eventId.eq.${evt.id},eventRef.eq.${evt.protocol}`)
        .order('created_at', { ascending: false });

      const quotationIds = (quotations || []).map((quote: any) => quote.id).filter(Boolean);
      const directPurchases = supabase
        .from('purchase_orders')
        .select('id, code, status, total, created_at, supplier_id, quotation_id, suppliers(name)')
        .eq('event_id', evt.id)
        .order('created_at', { ascending: false });

      const quotePurchases = quotationIds.length
        ? supabase
            .from('purchase_orders')
            .select('id, code, status, total, created_at, supplier_id, quotation_id, suppliers(name)')
            .in('quotation_id', quotationIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] });

      const [{ data: purchasesByEvent }, { data: purchasesByQuote }] = await Promise.all([directPurchases, quotePurchases]);
      const purchaseMap = new Map<string, any>();
      [...(purchasesByEvent || []), ...(purchasesByQuote || [])].forEach((purchase: any) => purchaseMap.set(purchase.id, purchase));
      setDetailFlow({
        quotations: quotations || [],
        purchases: Array.from(purchaseMap.values()),
        loading: false,
      });
    } catch (error) {
      console.warn('[Events] Falha ao carregar fluxo do sinistro:', error);
      setDetailFlow({ quotations: [], purchases: [], loading: false });
    }
  };

  const handleOpenNew = async () => {
    setEventToEdit(null);
    await refreshNextProtocol();
    setFormData({
        protocolMode: 'auto',
        manualProtocol: '',
        type: EventType.COLLISION,
        priority: Priority.MEDIUM,
        priorityScore: 5,
        vehicleId: '',
        associateId: '',
        openedAt: toDateInput(new Date().toISOString()),
        deadlineAt: '',
        responsibleName: '',
        responsibleCompany: '',
        vehicleStage: 'Ainda não entrou',
        description: '',
        notes: '',
        participationQuota: '',
        attachments: []
    });
    setShowQuickVehicle(false);
    setQuickVehicle({ plate: '' });
    setQuickVehicleData(null);
    setQuickVehicleLookupError(null);
    setIsModalOpen(true);
  };

  // --- Lógica de Anexos ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (formData.attachments.length + files.length > MAX_EVENT_ATTACHMENTS) {
        addToast('warning', 'Limite de anexos', `Cada sinistro pode ter no máximo ${MAX_EVENT_ATTACHMENTS} anexos.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        await Promise.all(Array.from(files).map(validateEventAttachmentFile));
      } catch (error: any) {
        addToast('error', 'Arquivo não permitido', error?.message || 'Verifique o formato e o tamanho do arquivo.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

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
    if (!att.url) {
      addToast('warning', 'Anexo indisponível', 'Atualize a tela para gerar um novo acesso temporário ao arquivo.');
      return;
    }
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
      const plate = normalizeVehiclePlate(quickVehicle.plate);
      if (!isValidVehiclePlate(plate)) throw new Error('Informe uma placa brasileira válida.');
      const vehicleData = quickVehicleData && normalizeVehiclePlate(String(quickVehicleData.plate || '')) === plate
        ? quickVehicleData
        : await lookupService.fetchPlate(plate);
      const id = await quickCreateVehicle({ plate, associateId: formData.associateId, vehicleData });
      const { data: vs } = await supabase.from('vehicles').select('*');
      setVehicles(vs || []);
      setFormData(prev => ({ ...prev, vehicleId: id }));
      setShowQuickVehicle(false);
      setQuickVehicle({ plate: '' });
      setQuickVehicleData(null);
      setQuickVehicleLookupError(null);
      addToast('success', 'Veículo criado', 'Veículo vinculado ao sinistro.');
    } catch (error: any) {
      setQuickVehicleLookupError(error?.message || 'Falha na consulta da placa.');
      addToast('error', 'Erro', error.message || 'Falha no cadastro rápido.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handlePriorityChange = async (eventId: string, nextPriority: Priority) => {
    const previous = events.find((e) => e.id === eventId)?.priority;
    if (!previous || previous === nextPriority) return;
    const nextScore = defaultScoreForPriority(nextPriority);

    setUpdatingPriorityId(eventId);
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, priority: nextPriority, priority_score: nextScore } : e)),
    );

    try {
      await eventService.updateEvent(eventId, { priority: nextPriority, priority_score: nextScore });
      addToast('success', 'Prioridade', `Atualizada para ${nextPriority}.`);
    } catch (err: any) {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, priority: previous } : e)),
      );
      addToast('error', 'Prioridade', err?.message || 'Nao foi possivel alterar a prioridade.');
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  const removeAttachment = async (att: any) => {
    if (att.id && !att.isNew && eventToEdit) {
      try {
        await eventService.removeAttachment(att.id);
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
    if (deadlineRequiredTypes.has(formData.type) && !formData.deadlineAt) {
        addToast('warning', 'Prazo obrigatório', 'Informe a data limite para este tipo de sinistro.');
        return;
    }
    if (formData.openedAt && formData.deadlineAt && formData.deadlineAt < formData.openedAt) {
        addToast('warning', 'Período inválido', 'A data limite não pode ser anterior à data de início.');
        return;
    }

    setIsSaving(true);
    try {
        const protocol = formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol;
        const normalizedScore = normalizePriorityScore(formData.priorityScore, formData.priority);
        const priority = classifyPriorityScore(normalizedScore);
        
        const eventData: Partial<Event> = {
            id: eventToEdit ? eventToEdit.id : undefined,
            protocol,
            type: formData.type,
            priority,
            priority_score: normalizedScore,
            category: formData.type,
            vehicleId: formData.vehicleId,
            associateId: formData.associateId,
            opened_at: formData.openedAt ? new Date(`${formData.openedAt}T00:00:00`).toISOString() : undefined,
            deadline_at: formData.deadlineAt || null,
            responsible_name: formData.responsibleName || null,
            responsible_company: formData.responsibleCompany || null,
            vehicle_stage: formData.vehicleStage || null,
            description: formData.description,
            notes: formData.notes || null,
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
            const created = await eventService.createEvent(eventData, { tenantId: currentTenant?.id });
            addToast('success', 'Sinistro Criado', `Protocolo ${created?.protocol || protocol} gerado.`);
        }
        
        await loadData();
        setIsModalOpen(false);
        setEventToEdit(null);
    } catch (error: any) {
        console.error(error);
        await loadData();
        await refreshNextProtocol();
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
    if (filters.priority && getPriorityLabel((e as any).priority_score, e.priority) !== filters.priority) return false;
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
  const detailAssociate = eventDetail ? associates.find(a => a.id === eventDetail.associateId) : null;
  const detailVehicle = eventDetail ? vehicles.find(v => v.id === eventDetail.vehicleId) : null;
  const detailDeadline = eventDetail ? getDeadlineInfo({
    openedAt: (eventDetail as any).opened_at || eventDetail.createdAt || (eventDetail as any).created_at,
    deadlineAt: (eventDetail as any).deadline_at,
    status: eventDetail.status,
  }) : null;
  const detailPriority = eventDetail ? getPriorityLabel((eventDetail as any).priority_score, eventDetail.priority) : Priority.MEDIUM;
  const detailPriorityScore = eventDetail ? normalizePriorityScore((eventDetail as any).priority_score, eventDetail.priority) : 5;
  const detailTabs = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'veiculo', label: 'Veiculo' },
    { id: 'fluxo', label: 'Cotacoes e compras' },
    { id: 'historico', label: 'Historico' },
    { id: 'anexos', label: 'Anexos' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Search & Action Bar */}
      <div className="app-toolbar flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por Protocolo, Nome do Cliente ou Placa..."
              className="w-full pl-11 pr-4 py-3 bg-white outline-none border border-slate-200 text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`app-icon-button ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
            title="Filtros Avançados"
          >
            <Filter size={20} />
          </button>
        </div>
        <button 
          onClick={handleOpenNew}
          className="app-btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={18} /> Novo Sinistro
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="app-panel p-5 animate-in slide-in-from-top-2">
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
                 {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
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
      <div className="app-table-wrap">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo / Cliente</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa / Veículo</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Prioridade</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fluxo / calendário</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Abertura</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEvents.length === 0 ? (
               <tr>
                 <td colSpan={7} className="app-empty-cell px-8 py-12 text-center text-slate-400">
                    <p className="app-empty-message text-sm font-bold">Nenhum sinistro encontrado com os filtros atuais.</p>
                 </td>
               </tr>
            ) : filteredEvents.map(evt => {
               const associate = associates.find(a => a.id === evt.associateId);
               const vehicle = vehicles.find(v => v.id === evt.vehicleId);
               const priority = getPriorityLabel((evt as any).priority_score, evt.priority);
               const priorityScore = normalizePriorityScore((evt as any).priority_score, evt.priority);
               const deadline = getDeadlineInfo({
                 openedAt: (evt as any).opened_at || evt.createdAt || (evt as any).created_at,
                 deadlineAt: (evt as any).deadline_at,
                 status: evt.status,
               });
               return (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <p className="font-black text-slate-800 leading-none mb-1">{evt.protocol}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{associate?.name || '---'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg inline-block text-[11px] border border-slate-200 mb-1">{vehicle?.plate || '---'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase block">{formatVehicleModelShort(vehicle)}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <select
                        value={priority}
                        disabled={updatingPriorityId === evt.id}
                        onChange={(e) => handlePriorityChange(evt.id, e.target.value as Priority)}
                        title="Alterar prioridade"
                        aria-label="Alterar prioridade"
                        className={`min-w-[130px] appearance-none rounded-xl border px-3 py-2 pr-8 text-[11px] font-bold outline-none shadow-sm transition focus:ring-2 disabled:opacity-60 cursor-pointer ${prioritySelectClass(priority)}`}
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%9464748b' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                        }}
                      >
                        {priorityOptions.map((p) => (
                          <option key={p} value={p}>{p} ({defaultScoreForPriority(p)})</option>
                        ))}
                      </select>
                      <span className={`ml-2 px-2 py-1 rounded-lg border text-[10px] font-black ${getPriorityTone(priority)}`}>
                        {priorityScore}/10
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <StatusBadge status={evt.status} />
                      <ScheduleStatusBadge status={(evt as any).schedule_status} />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getDeadlineTone(deadline.state)}`}>
                      {deadline.state}
                    </span>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      {deadline.daysRemaining === null ? 'Sem data limite' : `${deadline.daysRemaining} dia(s) restantes`}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-700">{formatDateTimeBr((evt as any).opened_at || (evt as any).createdAt || (evt as any).created_at)}</p>
                    {(evt as any).responsible_name && <p className="text-[10px] font-bold text-slate-400 mt-1">{(evt as any).responsible_name}</p>}
                  </td>
                  <td className="px-6 py-5 text-right flex items-center justify-end gap-1">
                     <button onClick={() => openEventDetail(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Ver detalhes"><Eye size={18}/></button>
                     <button onClick={() => handleEdit(evt)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Editar"><Edit3 size={18}/></button>
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

      {eventDetail && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setEventDetail(null)}></div>
          <div className="relative bg-white w-full max-w-6xl rounded-t-[28px] md:rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200">
            <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-white">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold uppercase">{eventDetail.protocol}</span>
                    <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${getPriorityTone(detailPriority)}`}>{detailPriority} · {detailPriorityScore}/10</span>
                    <ScheduleStatusBadge status={(eventDetail as any).schedule_status} />
                    {detailDeadline && (
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${getDeadlineTone(detailDeadline.state)}`}>{detailDeadline.state}</span>
                    )}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-950 tracking-tight">Detalhe do sinistro</h3>
                  <p className="text-sm font-medium text-slate-500 mt-1 truncate">
                    {detailAssociate?.name || 'Cliente nao vinculado'} · {detailVehicle?.plate || 'Placa nao vinculada'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(eventDetail)} className="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-2 hover:bg-indigo-100">
                    <Edit3 size={15} /> Editar
                  </button>
                  <button onClick={() => setEventDetail(null)} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${detailTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/70 custom-scrollbar">
              {detailTab === 'resumo' && detailDeadline && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Descricao do ocorrido</p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">{eventDetail.description || 'Sem descricao registrada.'}</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Observacoes</p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">{(eventDetail as any).notes || 'Sem observacoes operacionais.'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Controle de prazo</p>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full ${detailDeadline.isOverdue ? 'bg-red-500' : detailDeadline.isNear ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${detailDeadline.usedPercent}%` }} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-extrabold text-slate-900">{detailDeadline.daysElapsed}</p><p className="text-[10px] font-bold text-slate-400">usados</p></div>
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-extrabold text-slate-900">{detailDeadline.daysRemaining ?? '-'}</p><p className="text-[10px] font-bold text-slate-400">restantes</p></div>
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-extrabold text-slate-900">{detailDeadline.usedPercent}%</p><p className="text-[10px] font-bold text-slate-400">consumido</p></div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                      {[
                        ['Tipo', eventDetail.type],
                        ['Responsavel', (eventDetail as any).responsible_name || 'Nao informado'],
                        ['Empresa', (eventDetail as any).responsible_company || 'Nao informada'],
                        ['Abertura', formatDateTimeBr((eventDetail as any).opened_at || (eventDetail as any).created_at)],
                        ['Data limite', (eventDetail as any).deadline_at ? new Date(`${(eventDetail as any).deadline_at}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 text-sm">
                          <span className="font-bold text-slate-400">{label}</span>
                          <span className="font-bold text-slate-800 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'veiculo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Veiculo vinculado</p>
                    <h4 className="text-xl font-extrabold text-slate-900">{detailVehicle?.plate || 'Sem placa'}</h4>
                    <p className="text-sm font-semibold text-slate-500 mt-1">{formatVehicleModelShort(detailVehicle)}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Marca</p><p className="font-bold text-slate-800">{detailVehicle?.brand || '-'}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Modelo</p><p className="font-bold text-slate-800">{detailVehicle?.model || '-'}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">KM</p><p className="font-bold text-slate-800">{detailVehicle?.km || '-'}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Status</p><p className="font-bold text-slate-800">{detailVehicle?.status || '-'}</p></div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Acompanhamento</p>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs font-bold text-blue-500 uppercase">Etapa atual</p>
                      <p className="text-lg font-extrabold text-blue-900 mt-1">{(eventDetail as any).vehicle_stage || 'Ainda nao entrou'}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-500 leading-relaxed mt-4">
                      A proxima fase vai transformar esta area em linha do tempo de entrada, reparo, liberacao e entrega do veiculo.
                    </p>
                  </div>
                </div>
              )}

              {detailTab === 'fluxo' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Cotacoes</p>
                    {detailFlow.loading ? <Loader2 className="animate-spin text-blue-600" /> : detailFlow.quotations.length === 0 ? (
                      <p className="text-sm font-semibold text-slate-400">Nenhuma cotacao vinculada.</p>
                    ) : detailFlow.quotations.map((quote) => (
                      <div key={quote.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between gap-4">
                        <div><p className="font-bold text-slate-800">{quote.code}</p><p className="text-xs font-semibold text-slate-400">{formatDateTimeBr(quote.created_at)}</p></div>
                        <span className="text-xs font-bold text-blue-700">{quote.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Compras</p>
                    {detailFlow.loading ? <Loader2 className="animate-spin text-blue-600" /> : detailFlow.purchases.length === 0 ? (
                      <p className="text-sm font-semibold text-slate-400">Nenhuma compra vinculada.</p>
                    ) : detailFlow.purchases.map((purchase) => (
                      <div key={purchase.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between gap-4">
                        <div><p className="font-bold text-slate-800">{purchase.code}</p><p className="text-xs font-semibold text-slate-400">{purchase.suppliers?.name || 'Fornecedor nao informado'}</p></div>
                        <div className="text-right"><p className="text-xs font-bold text-slate-600">{purchase.status}</p><p className="text-sm font-extrabold text-slate-900">R$ {Number(purchase.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'historico' && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  {eventDetail.history?.length ? (
                    <div className="space-y-4">
                      {eventDetail.history.map((entry: any) => (
                        <div key={entry.id || `${entry.created_at}-${entry.comment}`} className="pl-4 border-l-2 border-blue-100">
                          <p className="text-xs font-bold uppercase text-blue-700">{entry.from_status || 'Evento'} → {entry.to_status || 'Atualizacao'}</p>
                          <p className="text-sm font-semibold text-slate-700 mt-1">{entry.comment || 'Sem comentario.'}</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-1">{formatDateTimeBr(entry.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm font-semibold text-slate-400">Nenhum historico registrado.</p>}
                </div>
              )}

              {detailTab === 'anexos' && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  {eventDetail.attachments?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {eventDetail.attachments.map((att: any) => (
                        <button key={att.id || att.url} onClick={() => openAttachment(att)} className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-left flex items-center gap-3 hover:border-blue-200 hover:bg-blue-50">
                          <Paperclip size={18} className="text-blue-600" />
                          <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{att.name || att.file_name || 'Anexo'}</p><p className="text-xs font-semibold text-slate-400">{att.size || att.type || 'Documento'}</p></div>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-sm font-semibold text-slate-400">Nenhum anexo registrado.</p>}
                </div>
              )}
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
              className="flex items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-sm disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100 disabled:shadow-none"
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
                <SearchableSelect
                  value={formData.associateId}
                  onChange={(associateId) => setFormData({ ...formData, associateId, vehicleId: '' })}
                  options={associateOptions}
                  placeholder="Selecione o associado..."
                  searchPlaceholder="Pesquisar por nome ou documento..."
                  emptyMessage="Nenhum associado encontrado."
                  disabled={!!eventToEdit}
                  required
                />
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
                <SearchableSelect
                  value={formData.vehicleId}
                  onChange={(vehicleId) => setFormData({ ...formData, vehicleId })}
                  options={vehicleOptions}
                  placeholder={!formData.associateId
                    ? 'Selecione o associado primeiro'
                    : availableVehicles.length > 0
                      ? 'Selecione o veículo...'
                      : 'Nenhum veículo vinculado'}
                  searchPlaceholder="Pesquisar por placa, marca ou modelo..."
                  emptyMessage="Nenhum veículo vinculado a este associado."
                  disabled={!formData.associateId || !!eventToEdit}
                  required
                />
                {!eventToEdit && formData.associateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickVehicle(v => !v);
                      setShowQuickAssociate(false);
                      setQuickVehicle({ plate: '' });
                      setQuickVehicleData(null);
                      setQuickVehicleLookupError(null);
                    }}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus size={12} /> {showQuickVehicle ? 'Fechar cadastro rápido' : 'Cadastro rápido de veículo'}
                  </button>
                )}
                {showQuickVehicle && formData.associateId && !eventToEdit && (
                  <div className="mt-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
                    <div className="relative">
                      <input
                        className={`${fieldClassName} uppercase pr-11`}
                        placeholder="Digite somente a placa *"
                        value={quickVehicle.plate}
                        onChange={e => {
                          quickVehicleLookupSequenceRef.current += 1;
                          setQuickVehicle({ plate: normalizeVehiclePlate(e.target.value).slice(0, 7) });
                        }}
                        maxLength={7}
                      />
                      {isQuickVehicleLookup && <Loader2 size={17} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-600" />}
                    </div>
                    {quickVehicleLookupError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{quickVehicleLookupError}</span>
                      </div>
                    )}
                    {quickVehicleData && (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-[10px] font-black uppercase text-emerald-700">Veículo confirmado</p>
                          <p className="text-sm font-black text-slate-900">{quickVehicleData.brand} {quickVehicleData.model}</p>
                          <p className="text-xs text-slate-600">{[quickVehicleData.year_model || quickVehicleData.year_fab, quickVehicleData.color].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    )}
                    <button type="button" disabled={isQuickSaving || isQuickVehicleLookup || !quickVehicleData} onClick={handleQuickVehicleSave} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
                      {isQuickSaving ? 'Salvando...' : isQuickVehicleLookup ? 'Consultando placa...' : 'Criar e vincular'}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel required>Data de início</FieldLabel>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={formData.openedAt}
                    onChange={(e) => setFormData({ ...formData, openedAt: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel required={deadlineRequiredTypes.has(formData.type)}>Data limite</FieldLabel>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={formData.deadlineAt}
                    min={formData.openedAt || undefined}
                    onChange={(e) => setFormData({ ...formData, deadlineAt: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Status do veículo</FieldLabel>
                  <select
                    className={fieldClassName}
                    value={formData.vehicleStage}
                    onChange={(e) => setFormData({ ...formData, vehicleStage: e.target.value })}
                  >
                    {vehicleStageOptions.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel>Classificação</FieldLabel>
                  <select
                    className={fieldClassName}
                    value={formData.priority}
                    onChange={(e) => {
                      const priority = e.target.value as Priority;
                      setFormData({ ...formData, priority, priorityScore: defaultScoreForPriority(priority) });
                    }}
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Nota de prioridade</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className={fieldClassName}
                    value={formData.priorityScore}
                    onChange={(e) => {
                      const score = normalizePriorityScore(Number(e.target.value), formData.priority);
                      setFormData({ ...formData, priorityScore: score, priority: classifyPriorityScore(score) });
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <div className={`w-full rounded-2xl border px-4 py-3 ${getPriorityTone(formData.priority)}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">Prioridade calculada</p>
                    <p className="text-sm font-black">{formData.priority} · {formData.priorityScore}/10</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Responsável pelo atendimento</FieldLabel>
                  <input
                    className={fieldClassName}
                    value={formData.responsibleName}
                    onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                    placeholder="Nome do colaborador responsável"
                  />
                </div>
                <div>
                  <FieldLabel>Empresa responsável</FieldLabel>
                  <input
                    className={fieldClassName}
                    value={formData.responsibleCompany}
                    onChange={(e) => setFormData({ ...formData, responsibleCompany: e.target.value })}
                    placeholder="Oficina, filial ou empresa responsável"
                  />
                </div>
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
              <div>
                <FieldLabel>Observações operacionais</FieldLabel>
                <textarea
                  className={`${fieldClassName} min-h-[90px] resize-none`}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Pontos de atenção, contatos, restrições ou próximos passos..."
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
