import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Columns3,
  Eye,
  Factory,
  File as FileIcon,
  FileImage,
  FileText,
  Filter,
  Grid2X2,
  LayoutList,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
  Video,
  Wrench,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import PremiumModal, { FieldLabel } from '../components/PremiumModal';
import FileViewerModal from '../components/FileViewerModal';
import { ATTACHMENT_ACCEPT } from '../utils/defaults';
import { getAttachmentKind, validateEventAttachmentFile } from '../services/attachmentService';
import { getUserFacingError } from '../utils/userFacingError';
import {
  deletePositioningAttachment,
  MAX_POSITIONING_ATTACHMENTS,
  PositioningAttachment,
  resolvePositioningAttachmentUrls,
  uploadPositioningAttachments,
} from '../services/positioningAttachmentService';

const SERVICES = [
  'Desmontagem',
  'Lanternagem / funilaria',
  'Preparação de pintura',
  'Pintura',
  'Mecânica',
  'Montagem mecânica',
  'Montagem',
  'Alinhamento',
  'Polimento',
  'Lavagem / acabamento',
  'Finalização',
];
const STAGES = ['Orçamento pendente', 'Aguardando autorização / entrada', 'Em serviço', 'Finalizado / entregue'];
const STATUSES = ['Pendente', 'Aguardando cliente', 'Aguardando peças', 'Em andamento', 'Concluído', 'Cancelado'];
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500';

type ViewMode = 'list' | 'board' | 'cards';

type PositioningForm = {
  event_id: string;
  vehicle_id: string;
  workshop_name: string;
  party_name: string;
  useEventAssociate: boolean;
  current_stage: string;
  stage_status: string;
  observation: string;
  budget_sent_at: string;
  authorization_at: string;
  entry_at: string;
  expected_delivery_at: string;
  attachments: PositioningAttachment[];
};

const emptyForm = (): PositioningForm => ({
  event_id: '',
  vehicle_id: '',
  workshop_name: '',
  party_name: '',
  useEventAssociate: true,
  current_stage: STAGES[0],
  stage_status: 'Pendente',
  observation: '',
  budget_sent_at: '',
  authorization_at: '',
  entry_at: '',
  expected_delivery_at: '',
  attachments: [],
});

const dateBR = (value?: string | null) => value
  ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
  : 'Não definida';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const stageTone = (stage: string) => {
  if (stage === 'Finalizado / entregue') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (stage === 'Em serviço') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (stage === 'Aguardando autorização / entrada') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
};

const statusTone = (status: string) => {
  if (status === 'Concluído') return 'text-emerald-700';
  if (status === 'Cancelado') return 'text-red-700';
  if (status === 'Aguardando peças' || status === 'Aguardando cliente') return 'text-amber-700';
  if (status === 'Em andamento') return 'text-blue-700';
  return 'text-slate-600';
};

const dueLabel = (row: any) => {
  if (row.delivered_at) return { text: `Entregue em ${dateBR(row.delivered_at)}`, tone: 'text-emerald-700' };
  if (!row.expected_delivery_at) return { text: 'Sem previsão', tone: 'text-slate-500' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${row.expected_delivery_at}T12:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)} dia(s) em atraso`, tone: 'text-red-700' };
  if (days === 0) return { text: 'Entrega hoje', tone: 'text-amber-700' };
  return { text: `${days} dia(s) para entrega`, tone: days <= 2 ? 'text-amber-700' : 'text-slate-600' };
};

const attachmentIcon = (attachment: PositioningAttachment) => {
  const kind = getAttachmentKind(attachment.type || '', attachment.name || '');
  if (kind === 'image') return <FileImage size={17} />;
  if (kind === 'video') return <Video size={17} />;
  if (kind === 'pdf' || kind === 'word') return <FileText size={17} />;
  return <FileIcon size={17} />;
};

const ViewSwitch: React.FC<{ value: ViewMode; onChange: (mode: ViewMode) => void }> = ({ value, onChange }) => (
  <div className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-slate-100 p-1" aria-label="Modo de visualização">
    {[
      { value: 'list' as ViewMode, label: 'Lista', icon: LayoutList },
      { value: 'board' as ViewMode, label: 'Quadro', icon: Columns3 },
      { value: 'cards' as ViewMode, label: 'Cartões', icon: Grid2X2 },
    ].map((option) => {
      const Icon = option.icon;
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={active}
          className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Icon size={15} />
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      );
    })}
  </div>
);

type DetailsProps = {
  row: any;
  timeline: any[];
  saving: string | null;
  uploading: string | null;
  onUpdatePosition: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onUpdateService: (positioningId: string, service: any, patch: Record<string, unknown>) => Promise<void>;
  onFiles: (row: any, files: FileList | null) => Promise<void>;
  onOpenAttachment: (attachment: PositioningAttachment) => Promise<void>;
  onDeleteAttachment: (attachment: PositioningAttachment) => Promise<void>;
};

const PositioningDetails: React.FC<DetailsProps> = ({
  row,
  timeline,
  saving,
  uploading,
  onUpdatePosition,
  onUpdateService,
  onFiles,
  onOpenAttachment,
  onDeleteAttachment,
}) => {
  const services = [...(row.vehicle_positioning_services || [])].sort((a, b) => a.service_order - b.service_order);
  const attachments: PositioningAttachment[] = row.vehicle_positioning_attachments || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">
          Posicionamento
          <select className={`${inputClass} mt-1`} value={row.current_stage} onChange={(event) => onUpdatePosition(row.id, { current_stage: event.target.value })}>
            {STAGES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Status
          <select className={`${inputClass} mt-1`} value={row.stage_status} onChange={(event) => onUpdatePosition(row.id, { stage_status: event.target.value })}>
            {STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Previsão de entrega
          <input type="date" className={`${inputClass} mt-1`} value={row.expected_delivery_at || ''} onChange={(event) => onUpdatePosition(row.id, { expected_delivery_at: event.target.value || null })} />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Data de entrega
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={row.delivered_at || ''}
            onChange={(event) => onUpdatePosition(row.id, {
              delivered_at: event.target.value || null,
              current_stage: event.target.value ? 'Finalizado / entregue' : row.current_stage,
              stage_status: event.target.value ? 'Concluído' : row.stage_status,
            })}
          />
        </label>
      </div>

      <div className="grid gap-7 xl:grid-cols-[1fr_1.15fr_1fr]">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Wrench size={17} className="text-blue-600" /> Serviços</h3>
          <div className="divide-y divide-slate-100 border-y border-slate-200">
            {services.map((service) => (
              <div key={service.id} className="flex min-h-12 items-center gap-3 py-2">
                <button
                  type="button"
                  disabled={saving === service.id}
                  onClick={() => onUpdateService(row.id, service, {
                    status: service.status === 'Concluído' ? 'Pendente' : 'Concluído',
                    finished_at: service.status === 'Concluído' ? null : new Date().toISOString().slice(0, 10),
                  })}
                  className={service.status === 'Concluído' ? 'text-emerald-600' : 'text-slate-300 hover:text-blue-600'}
                  title={service.status === 'Concluído' ? 'Reabrir serviço' : 'Concluir serviço'}
                >
                  <CheckCircle2 size={20} />
                </button>
                <span className={`min-w-0 flex-1 text-xs font-semibold ${service.status === 'Concluído' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{service.service_name}</span>
                <select className="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold" value={service.status} onChange={(event) => onUpdateService(row.id, service, { status: event.target.value })}>
                  {['Pendente', 'Em andamento', 'Concluído', 'Bloqueado'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><CircleDot size={17} className="text-blue-600" /> Histórico</h3>
          <div className="relative ml-2 border-l-2 border-blue-100 pl-5">
            {timeline.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400">Nenhuma movimentação registrada.</p>
            ) : timeline.slice(0, 12).map((item) => (
              <div key={item.id} className="relative mb-5 last:mb-0">
                <span className="absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-white"><CircleDot size={9} /></span>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">{item.title}</p>
                    {item.service_name && <p className="mt-0.5 text-xs font-semibold text-blue-700">{item.service_name}</p>}
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description || 'Movimentação registrada no acompanhamento.'}</p>
                    {(item.old_stage !== item.new_stage || item.old_status !== item.new_status) && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
                        {item.old_stage || item.old_status || 'Início'} <ArrowRight size={11} /> {item.new_stage || item.new_status}
                      </p>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-slate-400">{new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays size={17} className="text-blue-600" /> Datas e observações</h3>
          <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4 text-xs">
            <div><dt className="font-semibold text-slate-500">Orçamento enviado</dt><dd className="mt-1 font-bold text-slate-800">{dateBR(row.budget_sent_at)}</dd></div>
            <div><dt className="font-semibold text-slate-500">Autorização</dt><dd className="mt-1 font-bold text-slate-800">{dateBR(row.authorization_at)}</dd></div>
            <div><dt className="font-semibold text-slate-500">Entrada</dt><dd className="mt-1 font-bold text-slate-800">{dateBR(row.entry_at)}</dd></div>
            <div><dt className="font-semibold text-slate-500">Previsão</dt><dd className="mt-1 font-bold text-slate-800">{dateBR(row.expected_delivery_at)}</dd></div>
          </dl>
          <textarea className={`${inputClass} mt-4 min-h-28 resize-y`} placeholder="Observação do acompanhamento..." defaultValue={row.observation || ''} onBlur={(event) => onUpdatePosition(row.id, { observation: event.target.value })} />
        </section>
      </div>

      <section className="border-t border-slate-200 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Paperclip size={17} className="text-blue-600" /> Fotos, vídeos e documentos</h3>
            <p className="mt-1 text-xs text-slate-500">{attachments.length} de {MAX_POSITIONING_ATTACHMENTS} arquivos</p>
          </div>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 ${uploading === row.id ? 'pointer-events-none opacity-60' : ''}`}>
            {uploading === row.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading === row.id ? 'Enviando...' : 'Adicionar anexos'}
            <input className="hidden" type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={(event) => onFiles(row, event.target.files)} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <div className="border-y border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">Nenhum anexo neste acompanhamento.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {attachments.map((attachment) => (
              <div key={attachment.id || attachment.file_path} className="flex min-h-14 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <button type="button" onClick={() => onOpenAttachment(attachment)} className="text-blue-600" title="Visualizar anexo">{attachmentIcon(attachment)}</button>
                <button type="button" onClick={() => onOpenAttachment(attachment)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-bold text-slate-700">{attachment.name}</span>
                  <span className="text-xs text-slate-400">{getAttachmentKind(attachment.type || '', attachment.name)}</span>
                </button>
                <button type="button" onClick={() => onDeleteAttachment(attachment)} className="p-2 text-slate-400 hover:text-red-600" title="Excluir anexo" aria-label={`Excluir ${attachment.name}`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const VehiclePositioning: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PositioningForm>(emptyForm);
  const [viewerFile, setViewerFile] = useState<{ name: string; type: string; url: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('vehicle-positioning-view');
    return saved === 'board' || saved === 'cards' ? saved : 'list';
  });

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [positionings, eventRows, associateRows, vehicleRows] = await Promise.all([
      supabase
        .from('vehicle_positionings')
        .select('*, vehicle_positioning_services(*), vehicle_positioning_attachments(*)')
        .order('updated_at', { ascending: false }),
      supabase.from('events').select('id, protocol, description, vehicleId, associateId').order('created_at', { ascending: false }),
      supabase.from('associates').select('id, name, document, type'),
      supabase.from('vehicles').select('id, plate, brand, model, associate_id'),
    ]);

    if (positionings.error) {
      addToast('error', 'Posicionamento indisponível', 'Não foi possível carregar os acompanhamentos.');
      setRows([]);
      setLoading(false);
      return;
    }

    const associates = new Map((associateRows.data || []).map((item: any) => [item.id, item]));
    const vehicles = new Map((vehicleRows.data || []).map((item: any) => [item.id, item]));
    const enrichedEvents = (eventRows.data || []).map((item: any) => ({
      ...item,
      associate: associates.get(item.associateId) || null,
      vehicle: vehicles.get(item.vehicleId) || null,
    }));
    const eventMap = new Map(enrichedEvents.map((item: any) => [item.id, item]));
    const enrichedRows = await Promise.all((positionings.data || []).map(async (item: any) => {
      const linkedEvent: any = eventMap.get(item.event_id) || null;
      return {
        ...item,
        events: linkedEvent,
        vehicles: vehicles.get(item.vehicle_id || linkedEvent?.vehicleId) || linkedEvent?.vehicle || null,
        vehicle_positioning_attachments: await resolvePositioningAttachmentUrls(item.vehicle_positioning_attachments || []),
      };
    }));

    setEvents(enrichedEvents);
    setRows(enrichedRows);

    if (enrichedRows.length) {
      const { data: history } = await supabase
        .from('vehicle_positioning_timeline')
        .select('*')
        .in('positioning_id', enrichedRows.map((item: any) => item.id))
        .order('created_at', { ascending: false });
      const grouped = (history || []).reduce((acc: Record<string, any[]>, item: any) => {
        (acc[item.positioning_id] ||= []).push(item);
        return acc;
      }, {});
      setTimeline(grouped);
    } else {
      setTimeline({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const text = [
      row.workshop_name,
      row.insured_name,
      row.client_name,
      row.events?.associate?.name,
      row.vehicles?.plate,
      row.vehicles?.brand,
      row.vehicles?.model,
      row.events?.protocol,
    ].filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!stage || row.current_stage === stage);
  }), [rows, query, stage]);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('vehicle-positioning-view', mode);
  };

  const selectEvent = (eventId: string) => {
    const linkedEvent = events.find((item) => item.id === eventId);
    const associateName = linkedEvent?.associate?.name || '';
    setForm((current) => ({
      ...current,
      event_id: eventId,
      vehicle_id: linkedEvent?.vehicleId || '',
      party_name: associateName,
      useEventAssociate: Boolean(associateName),
    }));
  };

  const prepareFiles = async (files: FileList | null, currentCount: number): Promise<PositioningAttachment[]> => {
    if (!files?.length) return [];
    if (currentCount + files.length > MAX_POSITIONING_ATTACHMENTS) {
      throw new Error(`O limite é de ${MAX_POSITIONING_ATTACHMENTS} anexos por posicionamento.`);
    }
    const prepared: PositioningAttachment[] = [];
    for (const file of Array.from(files)) {
      const { mimeType } = await validateEventAttachmentFile(file);
      prepared.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: mimeType,
        url: URL.createObjectURL(file),
        size: formatBytes(file.size),
        file,
        isNew: true,
      });
    }
    return prepared;
  };

  const updatePosition = async (id: string, patch: Record<string, unknown>) => {
    setSaving(id);
    const { error } = await supabase.from('vehicle_positionings').update(patch).eq('id', id);
    if (error) addToast('error', 'Não foi possível salvar', getUserFacingError(error));
    else await load(false);
    setSaving(null);
  };

  const updateService = async (positioningId: string, service: any, patch: Record<string, unknown>) => {
    setSaving(service.id);
    const { error } = await supabase.from('vehicle_positioning_services').update(patch).eq('id', service.id);
    if (error) addToast('error', 'Serviço não atualizado', getUserFacingError(error));
    else await load(false);
    setSaving(null);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.event_id || !form.workshop_name.trim() || !form.party_name.trim()) {
      addToast('info', 'Campos obrigatórios', 'Informe o sinistro, a oficina e o segurado/cliente.');
      return;
    }
    setSubmitting(true);
    const payload = {
      event_id: form.event_id,
      vehicle_id: form.vehicle_id || null,
      workshop_name: form.workshop_name.trim(),
      insured_name: form.party_name.trim(),
      client_name: form.party_name.trim(),
      current_stage: form.current_stage,
      stage_status: form.stage_status,
      observation: form.observation.trim() || null,
      budget_sent_at: form.budget_sent_at || null,
      authorization_at: form.authorization_at || null,
      entry_at: form.entry_at || null,
      expected_delivery_at: form.expected_delivery_at || null,
    };

    const { data, error } = await supabase.from('vehicle_positionings').insert(payload).select('id, event_id').single();
    if (error) {
      console.error('Erro ao cadastrar posicionamento:', error);
      addToast('error', 'Erro ao cadastrar', getUserFacingError(error));
      setSubmitting(false);
      return;
    }

    const { error: servicesError } = await supabase.from('vehicle_positioning_services').insert(
      SERVICES.map((service_name, service_order) => ({ positioning_id: data.id, service_name, service_order })),
    );
    if (servicesError) addToast('warning', 'Checklist incompleto', 'O acompanhamento foi salvo, mas o checklist não pôde ser criado.');

    if (form.attachments.length) {
      try {
        await uploadPositioningAttachments(data.id, data.event_id, form.attachments);
      } catch (attachmentError: any) {
        addToast('warning', 'Acompanhamento salvo sem anexos', attachmentError.message || 'Abra o acompanhamento e tente enviar os arquivos novamente.');
      }
    }

    addToast('success', 'Posicionamento criado', 'O associado e o veículo foram vinculados a partir do sinistro.');
    setModal(false);
    setForm(emptyForm());
    await load(false);
    setSubmitting(false);
  };

  const addFilesToForm = async (files: FileList | null) => {
    try {
      const prepared = await prepareFiles(files, form.attachments.length);
      setForm((current) => ({ ...current, attachments: [...current.attachments, ...prepared] }));
    } catch (error: any) {
      addToast('error', 'Arquivo não aceito', getUserFacingError(error, 'Verifique o formato e o tamanho do arquivo.'));
    }
  };

  const addFilesToPositioning = async (row: any, files: FileList | null) => {
    setUploading(row.id);
    try {
      const prepared = await prepareFiles(files, row.vehicle_positioning_attachments?.length || 0);
      if (prepared.length) {
        await uploadPositioningAttachments(row.id, row.event_id, prepared);
        addToast('success', 'Anexos enviados', `${prepared.length} arquivo(s) adicionado(s) ao acompanhamento.`);
        await load(false);
      }
    } catch (error: any) {
      console.error('Falha no envio de anexos:', error);
      addToast('error', 'Falha no envio', getUserFacingError(error, 'Não foi possível enviar os anexos.'));
    } finally {
      setUploading(null);
    }
  };

  const openAttachment = async (attachment: PositioningAttachment) => {
    if (attachment.url) {
      setViewerFile({ name: attachment.name, type: attachment.type, url: attachment.url });
      return;
    }
    const [resolved] = await resolvePositioningAttachmentUrls([attachment]);
    if (!resolved?.url) {
      addToast('warning', 'Anexo indisponível', 'Atualize a lista e tente novamente.');
      return;
    }
    setViewerFile({ name: resolved.name, type: resolved.type, url: resolved.url });
  };

  const removeAttachment = async (attachment: PositioningAttachment) => {
    if (!attachment.id || !window.confirm(`Excluir o anexo "${attachment.name}"?`)) return;
    try {
      await deletePositioningAttachment(attachment.id);
      addToast('success', 'Anexo excluído', 'O arquivo foi removido do acompanhamento.');
      await load(false);
    } catch (error: any) {
      console.error('Erro ao excluir anexo:', error);
      addToast('error', 'Não foi possível excluir', getUserFacingError(error));
    }
  };

  const detailsProps = (row: any): DetailsProps => ({
    row,
    timeline: timeline[row.id] || [],
    saving,
    uploading,
    onUpdatePosition: updatePosition,
    onUpdateService: updateService,
    onFiles: addFilesToPositioning,
    onOpenAttachment: openAttachment,
    onDeleteAttachment: removeAttachment,
  });

  const renderList = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden min-h-11 grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(150px,.9fr)_minmax(210px,1.2fr)_minmax(170px,.9fr)_48px] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold uppercase text-slate-500 lg:grid">
        <span>Sinistro / veículo</span><span>Segurado / cliente</span><span>Oficina</span><span>Etapa</span><span>Execução / prazo</span><span />
      </div>
      <div className="divide-y divide-slate-200">
        {filtered.map((row) => {
          const services = row.vehicle_positioning_services || [];
          const done = services.filter((item: any) => item.status === 'Concluído').length;
          const progress = services.length ? Math.round((done / services.length) * 100) : 0;
          const due = dueLabel(row);
          const partyName = row.events?.associate?.name || row.client_name || row.insured_name || 'Não informado';
          const isOpen = expanded === row.id;
          return (
            <div key={row.id}>
              <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(150px,.9fr)_minmax(210px,1.2fr)_minmax(170px,.9fr)_48px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Car size={17} className="shrink-0 text-blue-600" /><strong className="truncate text-base text-slate-900">{row.vehicles?.plate || 'Veículo não vinculado'}</strong></div>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{row.events?.protocol || 'Sem protocolo'} · {[row.vehicles?.brand, row.vehicles?.model].filter(Boolean).join(' ') || 'Veículo sem descrição'}</p>
                </div>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{partyName}</p><p className="mt-1 truncate text-xs text-slate-500">Associado do sinistro</p></div>
                <div className="min-w-0"><p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-700"><Factory size={15} className="shrink-0 text-slate-400" />{row.workshop_name}</p></div>
                <div><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${stageTone(row.current_stage)}`}>{row.current_stage}</span><p className={`mt-1.5 text-xs font-semibold ${statusTone(row.stage_status)}`}>{row.stage_status}</p></div>
                <div>
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{done}/{services.length} serviços</span><span className="font-bold text-slate-800">{progress}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
                  <p className={`mt-2 text-xs font-semibold ${due.tone}`}>{due.text} · {row.vehicle_positioning_attachments?.length || 0} anexo(s)</p>
                </div>
                <button type="button" onClick={() => setExpanded(isOpen ? null : row.id)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-700" title={isOpen ? 'Fechar detalhes' : 'Abrir detalhes'} aria-label={isOpen ? 'Fechar detalhes' : 'Abrir detalhes'}><ChevronDown size={18} className={`transition ${isOpen ? 'rotate-180' : ''}`} /></button>
              </div>
              {isOpen && <div className="border-t border-slate-200 bg-slate-50/50 p-5"><PositioningDetails {...detailsProps(row)} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCards = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((row) => {
        const services = row.vehicle_positioning_services || [];
        const done = services.filter((item: any) => item.status === 'Concluído').length;
        const due = dueLabel(row);
        return (
          <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-blue-700">{row.events?.protocol || 'Sem protocolo'}</p><h2 className="mt-1 truncate text-lg font-bold text-slate-900">{row.vehicles?.plate || 'Veículo não vinculado'}</h2><p className="truncate text-xs text-slate-500">{[row.vehicles?.brand, row.vehicles?.model].filter(Boolean).join(' ')}</p></div><span className={`rounded-md border px-2 py-1 text-xs font-bold ${stageTone(row.current_stage)}`}>{row.current_stage}</span></div>
            <dl className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Segurado / cliente</dt><dd className="truncate font-bold text-slate-800">{row.events?.associate?.name || row.client_name || row.insured_name}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Oficina</dt><dd className="truncate font-semibold text-slate-700">{row.workshop_name}</dd></div><div className="flex items-center justify-between"><dt className="text-slate-500">Execução</dt><dd className="font-bold text-slate-800">{done}/{services.length}</dd></div><div className="flex items-center justify-between"><dt className="text-slate-500">Anexos</dt><dd className="font-bold text-slate-800">{row.vehicle_positioning_attachments?.length || 0}</dd></div></dl>
            <div className="mt-4 flex items-center justify-between gap-3"><p className={`text-xs font-semibold ${due.tone}`}>{due.text}</p><button type="button" onClick={() => setDetailId(row.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><Eye size={15} /> Detalhes</button></div>
          </article>
        );
      })}
    </div>
  );

  const renderBoard = () => (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1180px] grid-cols-4 gap-4">
        {STAGES.map((stageName) => {
          const stageRows = filtered.filter((row) => row.current_stage === stageName);
          return (
            <section key={stageName} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <header className="mb-3 flex items-center justify-between gap-3 px-1"><h2 className="text-sm font-bold text-slate-800">{stageName}</h2><span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white px-1.5 text-xs font-bold text-slate-600">{stageRows.length}</span></header>
              <div className="space-y-3">
                {stageRows.length === 0 ? <p className="border-y border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">Nenhum veículo</p> : stageRows.map((row) => {
                  const services = row.vehicle_positioning_services || [];
                  const done = services.filter((item: any) => item.status === 'Concluído').length;
                  const due = dueLabel(row);
                  return (
                    <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-blue-700">{row.events?.protocol}</p><h3 className="mt-1 text-base font-bold text-slate-900">{row.vehicles?.plate || 'Sem veículo'}</h3></div><span className={`text-xs font-bold ${statusTone(row.stage_status)}`}>{row.stage_status}</span></div>
                      <p className="mt-3 truncate text-sm font-semibold text-slate-700">{row.events?.associate?.name || row.client_name || row.insured_name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{row.workshop_name}</p>
                      <div className="mt-4 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{done}/{services.length} serviços</span><span className="font-semibold text-slate-500">{row.vehicle_positioning_attachments?.length || 0} anexo(s)</span></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${services.length ? (done / services.length) * 100 : 0}%` }} /></div>
                      <div className="mt-4 flex items-center justify-between gap-2"><span className={`text-xs font-semibold ${due.tone}`}>{due.text}</span><button type="button" onClick={() => setDetailId(row.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50" title="Abrir detalhes" aria-label="Abrir detalhes"><Eye size={16} /></button></div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  const selectedEvent = events.find((item) => item.id === form.event_id);
  const detailRow = rows.find((item) => item.id === detailId) || null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-bold uppercase text-blue-700">Operação de oficina</p><h1 className="text-3xl font-bold text-slate-900">Posicionamento do veículo</h1><p className="mt-1 text-sm text-slate-500">Acompanhe cada veículo, responsável, prazo, serviço e evidência do reparo.</p></div>
        <button type="button" onClick={() => setModal(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={18} /> Novo posicionamento</button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAGES.map((item) => <button type="button" key={item} onClick={() => setStage(stage === item ? '' : item)} className={`min-h-24 rounded-lg border bg-white p-4 text-left transition ${stage === item ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}><p className="text-xs font-bold text-slate-500">{item}</p><p className="mt-2 text-2xl font-bold text-slate-900">{rows.filter((row) => row.current_stage === item).length}</p></button>)}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className={`${inputClass} pl-10`} placeholder="Buscar placa, protocolo, oficina ou associado..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="relative md:w-72"><Filter className="absolute left-3 top-3 text-slate-400" size={17} /><select className={`${inputClass} pl-10`} value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Todas as etapas</option>{STAGES.map((item) => <option key={item}>{item}</option>)}</select></div>
        <ViewSwitch value={viewMode} onChange={changeView} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-20 text-center"><Car className="mx-auto mb-3 text-slate-300" size={38} /><p className="font-bold text-slate-500">Nenhum posicionamento encontrado.</p></div>
      ) : viewMode === 'list' ? renderList() : viewMode === 'board' ? renderBoard() : renderCards()}

      <PremiumModal
        open={modal}
        onClose={() => !submitting && setModal(false)}
        busy={submitting}
        title="Novo posicionamento"
        subtitle="Vincule o sinistro, a oficina, os prazos e as evidências iniciais."
        icon={Car}
        maxWidthClass="max-w-4xl"
        footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModal(false)} className="rounded-lg px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button><button type="submit" form="positioning-form" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {submitting ? 'Salvando...' : 'Salvar acompanhamento'}</button></div>}
      >
        <form id="positioning-form" onSubmit={create} className="space-y-6">
          <section className="space-y-4">
            <div><h3 className="text-sm font-bold text-slate-900">Vínculo do caso</h3><p className="mt-1 text-xs text-slate-500">O associado e o veículo são carregados do cadastro do sinistro.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><FieldLabel required>Sinistro</FieldLabel><select required className={inputClass} value={form.event_id} onChange={(event) => selectEvent(event.target.value)}><option value="">Selecione o sinistro...</option>{events.map((item) => <option key={item.id} value={item.id}>{item.protocol} · {item.associate?.name || 'Sem associado'} · {item.vehicle?.plate || 'Sem veículo'}</option>)}</select></div>
              <div><FieldLabel required>Oficina responsável</FieldLabel><input required className={inputClass} value={form.workshop_name} onChange={(event) => setForm({ ...form, workshop_name: event.target.value })} placeholder="Nome da oficina" /></div>
            </div>
            {selectedEvent && (
              <div className="grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 md:grid-cols-2">
                <div className="flex items-center gap-3"><UserRound size={20} className="text-blue-600" /><div><p className="text-xs font-semibold text-blue-700">Associado do sinistro</p><p className="font-bold text-slate-900">{selectedEvent.associate?.name || 'Não vinculado'}</p><p className="text-xs text-slate-500">{selectedEvent.associate?.document || 'Documento não informado'}</p></div></div>
                <div className="flex items-center gap-3"><Car size={20} className="text-blue-600" /><div><p className="text-xs font-semibold text-blue-700">Veículo envolvido</p><p className="font-bold text-slate-900">{selectedEvent.vehicle?.plate || 'Não vinculado'}</p><p className="text-xs text-slate-500">{[selectedEvent.vehicle?.brand, selectedEvent.vehicle?.model].filter(Boolean).join(' ') || 'Descrição não informada'}</p></div></div>
              </div>
            )}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.useEventAssociate} disabled={!selectedEvent?.associate?.name} onChange={(event) => setForm({ ...form, useEventAssociate: event.target.checked, party_name: event.target.checked ? selectedEvent?.associate?.name || '' : '' })} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Usar o associado do sinistro como segurado / cliente</label>
              <FieldLabel required>Segurado / cliente</FieldLabel><input required disabled={form.useEventAssociate} className={inputClass} value={form.party_name} onChange={(event) => setForm({ ...form, party_name: event.target.value })} placeholder="Nome do segurado ou cliente" />
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5"><h3 className="mb-4 text-sm font-bold text-slate-900">Etapa e prazos</h3><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div><FieldLabel>Posicionamento</FieldLabel><select className={inputClass} value={form.current_stage} onChange={(event) => setForm({ ...form, current_stage: event.target.value })}>{STAGES.map((item) => <option key={item}>{item}</option>)}</select></div><div><FieldLabel>Status</FieldLabel><select className={inputClass} value={form.stage_status} onChange={(event) => setForm({ ...form, stage_status: event.target.value })}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div><div><FieldLabel>Entrada na oficina</FieldLabel><input type="date" className={inputClass} value={form.entry_at} onChange={(event) => setForm({ ...form, entry_at: event.target.value })} /></div><div><FieldLabel>Previsão de entrega</FieldLabel><input type="date" className={inputClass} value={form.expected_delivery_at} onChange={(event) => setForm({ ...form, expected_delivery_at: event.target.value })} /></div></div><div className="mt-4"><FieldLabel>Observação</FieldLabel><textarea className={`${inputClass} min-h-24 resize-y`} value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} placeholder="Situação atual, restrições e próximos passos" /></div></section>

          <section className="border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Fotos, vídeos e documentos</h3><p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, PDF, MP4, MOV, DOC ou DOCX.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><Upload size={15} /> Selecionar arquivos<input className="hidden" type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={(event) => addFilesToForm(event.target.files)} /></label></div>
            {form.attachments.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{form.attachments.map((attachment) => <div key={attachment.id} className="flex min-h-14 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"><span className="text-blue-600">{attachmentIcon(attachment)}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{attachment.name}</p><p className="text-xs text-slate-400">{attachment.size}</p></div><button type="button" onClick={() => setForm({ ...form, attachments: form.attachments.filter((item) => item.id !== attachment.id) })} className="p-2 text-slate-400 hover:text-red-600" title="Remover arquivo"><Trash2 size={15} /></button></div>)}</div>}
          </section>
        </form>
      </PremiumModal>

      <PremiumModal open={Boolean(detailRow)} onClose={() => setDetailId(null)} title={detailRow ? `${detailRow.vehicles?.plate || 'Veículo'} · ${detailRow.events?.protocol || 'Acompanhamento'}` : 'Acompanhamento'} subtitle={detailRow ? `${detailRow.events?.associate?.name || detailRow.client_name || detailRow.insured_name} · ${detailRow.workshop_name}` : ''} icon={Car} maxWidthClass="max-w-6xl">
        {detailRow && <PositioningDetails {...detailsProps(detailRow)} />}
      </PremiumModal>

      <FileViewerModal file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
};

export default VehiclePositioning;
