import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Car, CheckCircle2, ChevronDown, Clock3, Factory, Filter, Loader2, Plus, Save, Search, UserRound, Wrench, CircleDot, ArrowRight, MessageSquareText } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';

const SERVICES = ['Desmontagem','Lanternagem / funilaria','Preparação de pintura','Pintura','Mecânica','Montagem mecânica','Montagem','Alinhamento','Polimento','Lavagem / acabamento','Finalização'];
const STAGES = ['Orçamento pendente','Aguardando autorização / entrada','Em serviço','Finalizado / entregue'];
const STATUSES = ['Pendente','Aguardando cliente','Aguardando peças','Em andamento','Concluído','Cancelado'];
const dateBR = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const VehiclePositioning: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ event_id: '', workshop_name: '', insured_name: '', client_name: '', current_stage: STAGES[0], stage_status: 'Pendente', observation: '', budget_sent_at: '', authorization_at: '', entry_at: '', expected_delivery_at: '' });

  const load = async () => {
    setLoading(true);
    const [positionings, eventRows] = await Promise.all([
      supabase.from('vehicle_positionings').select('*, vehicle_positioning_services(*), events(protocol, description), vehicles(plate, brand, model)').order('updated_at', { ascending: false }),
      supabase.from('events').select('id, protocol, description').order('created_at', { ascending: false }),
    ]);
    if (positionings.error) addToast('info', 'Posicionamento', 'Aplique a migration do módulo antes de utilizar esta tela.');
    setRows(positionings.data || []); setEvents(eventRows.data || []);
    if (!positionings.error && positionings.data?.length) {
      const { data: history } = await supabase.from('vehicle_positioning_timeline').select('*').in('positioning_id', positionings.data.map((item: any) => item.id)).order('created_at', { ascending: false });
      const grouped = (history || []).reduce((acc: Record<string, any[]>, item: any) => { (acc[item.positioning_id] ||= []).push(item); return acc; }, {});
      setTimeline(grouped);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(row => {
    const text = `${row.workshop_name} ${row.insured_name || ''} ${row.client_name || ''} ${row.vehicles?.plate || ''} ${row.events?.protocol || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!stage || row.current_stage === stage);
  }), [rows, query, stage]);

  const updatePosition = async (id: string, patch: Record<string, unknown>) => {
    setSaving(id);
    const { error } = await supabase.from('vehicle_positionings').update(patch).eq('id', id);
    if (error) addToast('error', 'Não foi possível salvar', error.message);
    else {
      setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
      const { data: history } = await supabase.from('vehicle_positioning_timeline').select('*').eq('positioning_id', id).order('created_at', { ascending: false });
      setTimeline(prev => ({ ...prev, [id]: history || [] }));
    }
    setSaving(null);
  };

  const updateService = async (positioningId: string, service: any, patch: Record<string, unknown>) => {
    setSaving(service.id);
    const { error } = await supabase.from('vehicle_positioning_services').update(patch).eq('id', service.id);
    if (!error) {
      setRows(prev => prev.map(row => row.id === positioningId ? { ...row, vehicle_positioning_services: row.vehicle_positioning_services.map((s: any) => s.id === service.id ? { ...s, ...patch } : s) } : row));
      const { data: history } = await supabase.from('vehicle_positioning_timeline').select('*').eq('positioning_id', positioningId).order('created_at', { ascending: false });
      setTimeline(prev => ({ ...prev, [positioningId]: history || [] }));
    } else addToast('error', 'Serviço', error.message);
    setSaving(null);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_id || !form.workshop_name) return addToast('info', 'Campos obrigatórios', 'Informe o sinistro e a oficina.');
    const { data, error } = await supabase.from('vehicle_positionings').insert(form).select('*, events(protocol, description), vehicles(plate, brand, model)').single();
    if (error) return addToast('error', 'Erro ao cadastrar', error.message);
    const { data: services } = await supabase.from('vehicle_positioning_services').insert(SERVICES.map((service_name, service_order) => ({ positioning_id: data.id, service_name, service_order }))).select('*');
    setRows(prev => [{ ...data, vehicle_positioning_services: services || [] }, ...prev]); setModal(false); setForm({ event_id: '', workshop_name: '', insured_name: '', client_name: '', current_stage: STAGES[0], stage_status: 'Pendente', observation: '', budget_sent_at: '', authorization_at: '', entry_at: '', expected_delivery_at: '' });
  };

  return <div className="max-w-[1500px] mx-auto space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Operação de oficina</p><h1 className="text-3xl font-black text-slate-800">Posicionamento do veículo</h1><p className="mt-1 text-sm text-slate-500">Acompanhe oficina, segurado, cliente, prazos e cada serviço do reparo.</p></div><button onClick={() => setModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Plus size={18}/> Novo posicionamento</button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{STAGES.map(item => <div key={item} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item}</p><p className="mt-2 text-2xl font-black text-slate-800">{rows.filter(r => r.current_stage === item).length}</p></div>)}</div>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input className={`${input} pl-10`} placeholder="Buscar placa, protocolo, oficina ou cliente..." value={query} onChange={e => setQuery(e.target.value)}/></div><div className="relative md:w-72"><Filter className="absolute left-3 top-3 text-slate-400" size={17}/><select className={`${input} pl-10`} value={stage} onChange={e => setStage(e.target.value)}><option value="">Todos os posicionamentos</option>{STAGES.map(s => <option key={s}>{s}</option>)}</select></div></div>
    {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600"/></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><Car className="mx-auto mb-3 text-slate-300" size={38}/><p className="font-bold text-slate-500">Nenhum posicionamento cadastrado.</p></div> : <div className="space-y-4">{filtered.map(row => { const services = [...(row.vehicle_positioning_services || [])].sort((a,b) => a.service_order-b.service_order); const done = services.filter(s => s.status === 'Concluído').length; return <div key={row.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center"><div><div className="flex items-center gap-2"><Car size={17} className="text-blue-600"/><strong className="text-lg text-slate-800">{row.vehicles?.plate || 'Veículo não vinculado'}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{row.events?.protocol || 'Sem protocolo'}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{row.vehicles?.brand} {row.vehicles?.model}</p></div><div className="text-sm"><p className="flex items-center gap-2 font-black text-slate-700"><Factory size={15} className="text-slate-400"/>{row.workshop_name}</p><p className="mt-1 text-xs text-slate-500">Oficina</p></div><div className="text-sm"><p className="flex items-center gap-2 font-bold text-slate-700"><UserRound size={15} className="text-slate-400"/>{row.insured_name || 'Não informado'}</p><p className="mt-1 text-xs text-slate-500">Segurado · {row.client_name || 'Cliente não informado'}</p></div><div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">{row.current_stage}</span><p className="mt-2 text-xs font-bold text-slate-500">{done}/{services.length} serviços concluídos · entrega {dateBR(row.expected_delivery_at)}</p></div><button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronDown size={18} className={expanded === row.id ? 'rotate-180' : ''}/></button></div>{expanded === row.id && <div className="border-t border-slate-100 bg-slate-50/60 p-5"><div className="grid gap-4 lg:grid-cols-4"><label className="text-xs font-black text-slate-500">Posicionamento<select className={`${input} mt-1`} value={row.current_stage} onChange={e => updatePosition(row.id, { current_stage: e.target.value })}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></label><label className="text-xs font-black text-slate-500">Status<select className={`${input} mt-1`} value={row.stage_status} onChange={e => updatePosition(row.id, { stage_status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label><label className="text-xs font-black text-slate-500">Previsão de entrega<input type="date" className={`${input} mt-1`} value={row.expected_delivery_at || ''} onChange={e => updatePosition(row.id, { expected_delivery_at: e.target.value || null })}/></label><label className="text-xs font-black text-slate-500">Data de entrega<input type="date" className={`${input} mt-1`} value={row.delivered_at || ''} onChange={e => updatePosition(row.id, { delivered_at: e.target.value || null, current_stage: e.target.value ? 'Finalizado / entregue' : row.current_stage, stage_status: e.target.value ? 'Concluído' : row.stage_status })}/></label></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]"><div><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><Wrench size={17} className="text-blue-600"/> Checklist de serviços</h3><div className="space-y-2">{services.map(service => <div key={service.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><button disabled={saving === service.id} onClick={() => updateService(row.id, service, { status: service.status === 'Concluído' ? 'Pendente' : 'Concluído', finished_at: service.status === 'Concluído' ? null : new Date().toISOString().slice(0,10) })} className={`rounded-lg p-1 ${service.status === 'Concluído' ? 'text-emerald-600' : 'text-slate-300'}`}><CheckCircle2 size={20}/></button><span className={`flex-1 text-xs font-bold ${service.status === 'Concluído' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{service.service_name}</span><select className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold" value={service.status} onChange={e => updateService(row.id, service, { status: e.target.value })}>{['Pendente','Em andamento','Concluído','Bloqueado'].map(s => <option key={s}>{s}</option>)}</select></div>)}</div></div><div><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><Clock3 size={17} className="text-blue-600"/> Timeline do acompanhamento</h3><div className="relative ml-2 border-l-2 border-blue-100 pl-5">{(timeline[row.id] || []).length === 0 ? <p className="text-xs font-semibold text-slate-400">Nenhuma movimentação registrada.</p> : (timeline[row.id] || []).map((item: any) => <div key={item.id} className="relative mb-5 last:mb-0"><span className="absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-slate-50"><CircleDot size={9}/></span><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-slate-700">{item.title}</p>{item.service_name && <p className="mt-0.5 text-[11px] font-bold text-blue-700">{item.service_name}</p>}<p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.description || 'Movimentação registrada no acompanhamento.'}</p>{(item.old_stage !== item.new_stage || item.old_status !== item.new_status) && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-400">{item.old_stage || item.old_status || 'Início'} <ArrowRight size={11}/> {item.new_stage || item.new_status}</p>}</div><time className="whitespace-nowrap text-[10px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div></div>)}</div></div><div><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><CalendarDays size={17} className="text-blue-600"/> Datas e observações</h3><div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-500"><div>Orçamento enviado<p className="mt-1 text-slate-800">{dateBR(row.budget_sent_at)}</p></div><div>Autorização / entrada<p className="mt-1 text-slate-800">{dateBR(row.authorization_at)} · {dateBR(row.entry_at)}</p></div></div><textarea className={`${input} mt-4 min-h-24`} placeholder="Observação do acompanhamento..." defaultValue={row.observation || ''} onBlur={e => updatePosition(row.id, { observation: e.target.value })}/></div></div></div>}</div>})}</div>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={create} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Novo acompanhamento</p><h2 className="text-2xl font-black text-slate-800">Posicionamento do veículo</h2></div><button type="button" onClick={() => setModal(false)} className="text-slate-400">×</button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-500">Sinistro *<select required className={`${input} mt-1`} value={form.event_id} onChange={e => setForm({...form,event_id:e.target.value})}><option value="">Selecione...</option>{events.map(event => <option key={event.id} value={event.id}>{event.protocol} — {event.description?.slice(0,40)}</option>)}</select></label><label className="text-xs font-black text-slate-500">Oficina *<input required className={`${input} mt-1`} value={form.workshop_name} onChange={e => setForm({...form,workshop_name:e.target.value})}/></label><label className="text-xs font-black text-slate-500">Segurado<input className={`${input} mt-1`} value={form.insured_name} onChange={e => setForm({...form,insured_name:e.target.value})}/></label><label className="text-xs font-black text-slate-500">Cliente<input className={`${input} mt-1`} value={form.client_name} onChange={e => setForm({...form,client_name:e.target.value})}/></label><label className="text-xs font-black text-slate-500">Posicionamento<select className={`${input} mt-1`} value={form.current_stage} onChange={e => setForm({...form,current_stage:e.target.value})}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></label><label className="text-xs font-black text-slate-500">Previsão de entrega<input type="date" className={`${input} mt-1`} value={form.expected_delivery_at} onChange={e => setForm({...form,expected_delivery_at:e.target.value})}/></label><label className="text-xs font-black text-slate-500 md:col-span-2">Observação<textarea className={`${input} mt-1 min-h-24`} value={form.observation} onChange={e => setForm({...form,observation:e.target.value})}/></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500">Cancelar</button><button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"><Save size={16}/> Salvar acompanhamento</button></div></form></div>}
  </div>;
};
export default VehiclePositioning;
