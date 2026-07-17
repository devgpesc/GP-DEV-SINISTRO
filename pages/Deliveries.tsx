import React, { useState, useEffect, useMemo } from 'react';
import { Truck, CheckCircle, Clock, Archive, BarChart3, PackageCheck, Search, UserCheck, BriefcaseBusiness, LayoutGrid, List, History, Edit3, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ActionModal from '../components/ActionModal';

type DeliveryStatus = 'Pendente' | 'Entregue';

interface MovementEntry {
  at: string;
  action: string;
  user?: string;
  note?: string;
}

interface DeliveryItem {
  id: string;
  orderId?: string;
  quotationId?: string;
  po: string;
  supplier: string;
  items: number;
  date: string;
  event: string;
  amount: number;
  status: DeliveryStatus;
  customer?: string;
  vehicle?: string;
  deliveredBy?: string;
  observation?: string;
  movementHistory: MovementEntry[];
  source: 'delivery' | 'purchase_order';
}

const statusStyle: Record<DeliveryStatus, string> = {
  Pendente: 'bg-amber-50 text-amber-700 border-amber-100',
  Entregue: 'bg-green-50 text-green-700 border-green-100',
};

const statusLabel: Record<DeliveryStatus, string> = {
  Pendente: 'Aguardando',
  Entregue: 'Entregue',
};

const normalizeStatus = (status?: string): DeliveryStatus => {
  if (status === 'Entregue' || status === 'Conforme' || status === 'Recebida') return 'Entregue';
  return 'Pendente';
};

const Deliveries: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'operacao' | 'gestao' | 'historico'>('operacao');
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [deliverModal, setDeliverModal] = useState<DeliveryItem | null>(null);
  const [deliverForm, setDeliverForm] = useState({ responsible: '', observation: '' });
  const [editModal, setEditModal] = useState<DeliveryItem | null>(null);
  const [editForm, setEditForm] = useState({ supplier: '', customer: '', vehicle: '', event: '', items: 0, observation: '' });
  const [deleteTarget, setDeleteTarget] = useState<DeliveryItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    loadDeliveries();
    const channel = supabase
      .channel('deliveries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => loadDeliveries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => loadDeliveries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadDeliveries = async () => {
    setLoading(true);

    const [{ data: deliveryRows }, { data: orderRows }] = await Promise.all([
      supabase.from('deliveries').select('*'),
      supabase
        .from('purchase_orders')
        .select(`
          id,
          code,
          status,
          total,
          created_at,
          event_id,
          quotation_id,
          suppliers (name),
          purchase_order_items (id, name, quantity),
          quotations (eventRef, eventId)
        `)
        .in('status', ['Aprovada', 'Recebida'])
        .order('created_at', { ascending: false })
    ]);

    const existingByPo = new Map((deliveryRows || []).map((row: any) => [row.po, row]));

    const quoteEventIds = (orderRows || [])
      .map((order: any) => order.quotations?.eventId)
      .filter(Boolean);
    const directEventIds = (orderRows || []).map((order: any) => order.event_id).filter(Boolean);
    const eventIds = [...new Set([...directEventIds, ...quoteEventIds])];

    const { data: eventRows } = eventIds.length
      ? await supabase.from('events').select('id, protocol, associateId, vehicleId').in('id', eventIds)
      : { data: [] as any[] };

    const associateIds = [...new Set((eventRows || []).map((event: any) => event.associateId).filter(Boolean))];
    const vehicleIds = [...new Set((eventRows || []).map((event: any) => event.vehicleId).filter(Boolean))];
    const [{ data: associateRows }, { data: vehicleRows }] = await Promise.all([
      associateIds.length ? supabase.from('associates').select('id, name').in('id', associateIds) : Promise.resolve({ data: [] as any[] }),
      vehicleIds.length ? supabase.from('vehicles').select('id, brand, model, plate').in('id', vehicleIds) : Promise.resolve({ data: [] as any[] })
    ]);

    const eventById = new Map((eventRows || []).map((event: any) => [event.id, event]));
    const associateById = new Map((associateRows || []).map((associate: any) => [associate.id, associate]));
    const vehicleById = new Map((vehicleRows || []).map((vehicle: any) => [vehicle.id, vehicle]));

    const resolveEventContext = (order: any) => {
      const eventId = order.event_id || order.quotations?.eventId;
      const event = eventId ? eventById.get(eventId) : null;
      const associate = event?.associateId ? associateById.get(event.associateId) : null;
      const vehicle = event?.vehicleId ? vehicleById.get(event.vehicleId) : null;
      return {
        event,
        customer: associate?.name,
        vehicle: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}${vehicle.plate ? ` - ${vehicle.plate}` : ''}`.trim() : undefined,
        eventLabel: event?.protocol || order.quotations?.eventRef || 'Sem sinistro'
      };
    };

    const fromOrders: DeliveryItem[] = (orderRows || []).map((order: any) => {
      const existing = existingByPo.get(order.code);
      const ctx = resolveEventContext(order);
      const history = Array.isArray(existing?.movement_history) ? existing.movement_history : [];

      return {
        id: existing?.id || `po-${order.id}`,
        orderId: order.id,
        quotationId: order.quotation_id,
        po: order.code,
        supplier: order.suppliers?.name || existing?.supplier || 'Fornecedor nao vinculado',
        items: existing?.items || order.purchase_order_items?.length || 0,
        date: existing?.date || order.created_at,
        event: existing?.event || ctx.eventLabel,
        amount: Number(order.total || 0),
        status: normalizeStatus(existing?.status || (order.status === 'Recebida' ? 'Entregue' : 'Pendente')),
        customer: ctx.customer || existing?.customer,
        vehicle: ctx.vehicle || existing?.vehicle,
        deliveredBy: existing?.delivered_by,
        observation: existing?.observation,
        movementHistory: history,
        source: existing ? 'delivery' : 'purchase_order'
      };
    });

    const orphanDeliveries: DeliveryItem[] = await Promise.all(
      (deliveryRows || [])
        .filter((row: any) => !fromOrders.some(delivery => delivery.po === row.po))
        .map(async (row: any) => {
          let customer = row.customer;
          let vehicle = row.vehicle;
          let eventLabel = row.event;

          if ((!customer || !vehicle) && row.po) {
            const { data: linkedOrder } = await supabase
              .from('purchase_orders')
              .select('event_id, quotation_id, quotations(eventId, eventRef)')
              .eq('code', row.po)
              .maybeSingle();

            if (linkedOrder) {
              const ctx = resolveEventContext(linkedOrder);
              customer = customer || ctx.customer;
              vehicle = vehicle || ctx.vehicle;
              eventLabel = eventLabel || ctx.eventLabel;
            }
          }

          return {
            id: row.id,
            orderId: row.order_id,
            po: row.po,
            supplier: row.supplier,
            items: row.items || 0,
            date: row.date,
            event: eventLabel,
            amount: 0,
            status: normalizeStatus(row.status),
            customer,
            vehicle,
            deliveredBy: row.delivered_by,
            observation: row.observation,
            movementHistory: Array.isArray(row.movement_history) ? row.movement_history : [],
            source: 'delivery' as const
          };
        })
    );

    setDeliveries([...fromOrders, ...orphanDeliveries]);
    setLoading(false);
  };

  const markAsDelivered = async () => {
    if (!deliverModal) return;
    if (!deliverForm.responsible.trim()) {
      addToast('warning', 'Campo obrigatório', 'Informe o responsável pela entrega.');
      return;
    }

    setUpdatingId(deliverModal.id);
    const now = new Date().toISOString();
    const entry: MovementEntry = {
      at: now,
      action: 'Entregue',
      user: deliverForm.responsible.trim(),
      note: deliverForm.observation.trim() || undefined
    };
    const history = [...deliverModal.movementHistory, entry];

    const payload = {
      po: deliverModal.po,
      supplier: deliverModal.supplier,
      items: deliverModal.items,
      date: deliverModal.date || now,
      event: deliverModal.event,
      customer: deliverModal.customer,
      vehicle: deliverModal.vehicle,
      status: 'Entregue',
      delivered_by: deliverForm.responsible.trim(),
      observation: deliverForm.observation.trim(),
      movement_history: history,
      order_id: deliverModal.orderId || null
    };

    const saveDelivery = deliverModal.source === 'purchase_order'
      ? supabase.from('deliveries').insert([payload]).select().single()
      : supabase.from('deliveries').update(payload).eq('id', deliverModal.id).select().single();

    const { data, error } = await saveDelivery;

    if (!error && deliverModal.orderId) {
      await supabase.from('purchase_orders').update({ status: 'Recebida' }).eq('id', deliverModal.orderId);
      await syncDeliveryWorkflow(deliverModal);
    }

    if (!error) {
      setDeliveries(prev => prev.map(item =>
        item.id === deliverModal.id
          ? {
              ...item,
              id: data?.id || item.id,
              status: 'Entregue',
              deliveredBy: deliverForm.responsible.trim(),
              observation: deliverForm.observation.trim(),
              movementHistory: history,
              source: 'delivery'
            }
          : item
      ));
      setDeliverModal(null);
      setDeliverForm({ responsible: profile?.full_name || '', observation: '' });
    } else {
      addToast('error', 'Erro', 'Erro ao registrar entrega.');
    }

    setUpdatingId(null);
  };

  const syncDeliveryWorkflow = async (delivery: DeliveryItem) => {
    try {
      if (delivery.quotationId) {
        const { data: relatedOrders } = await supabase
          .from('purchase_orders')
          .select('status')
          .eq('quotation_id', delivery.quotationId);

        const statuses = (relatedOrders || []).map((row: any) => row.status);
        const allReceived = statuses.length > 0 && statuses.every((status: string) => status === 'Recebida');
        const allApprovedOrReceived = statuses.length > 0 && statuses.every((status: string) => status === 'Aprovada' || status === 'Recebida');
        const quotationStatus = allReceived ? 'Compra Realizada' : allApprovedOrReceived ? 'Compra Autorizada' : 'Aguardando Aprovação';

        await supabase.from('quotations').update({ status: quotationStatus }).eq('id', delivery.quotationId);

        if (delivery.orderId) {
          const { data: order } = await supabase
            .from('purchase_orders')
            .select('event_id')
            .eq('id', delivery.orderId)
            .maybeSingle();

          if (order?.event_id) {
            const eventStatus = quotationStatus === 'Compra Realizada' ? 'Concluído' : 'Aprovado';
            await supabase.from('events').update({ status: eventStatus }).eq('id', order.event_id);
          }
        }
      }
    } catch (workflowError) {
      console.warn('Falha ao sincronizar fluxo de entrega:', workflowError);
    }
  };

  const filteredDeliveries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return deliveries.filter(delivery =>
      delivery.po?.toLowerCase().includes(term) ||
      delivery.supplier?.toLowerCase().includes(term) ||
      delivery.event?.toLowerCase().includes(term) ||
      delivery.customer?.toLowerCase().includes(term)
    );
  }, [deliveries, searchTerm]);

  const activeDeliveries = filteredDeliveries.filter(delivery => delivery.status === 'Pendente');
  const historyDeliveries = filteredDeliveries.filter(delivery => delivery.status === 'Entregue');
  const allMovements = useMemo(() => {
    return historyDeliveries
      .flatMap(delivery => delivery.movementHistory.map(entry => ({ ...entry, po: delivery.po, supplier: delivery.supplier })))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [historyDeliveries]);

  const totalPendingValue = activeDeliveries.reduce((sum, delivery) => sum + delivery.amount, 0);
  const visibleDeliveries = activeTab === 'operacao' ? activeDeliveries : activeTab === 'historico' ? historyDeliveries : [];

  const openEditModal = (delivery: DeliveryItem) => {
    setEditModal(delivery);
    setEditForm({
      supplier: delivery.supplier,
      customer: delivery.customer || '',
      vehicle: delivery.vehicle || '',
      event: delivery.event,
      items: delivery.items,
      observation: delivery.observation || '',
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    if (!editForm.supplier.trim()) {
      addToast('warning', 'Campo obrigatório', 'Informe o fornecedor.');
      return;
    }
    setIsSavingEdit(true);
    const payload = {
      po: editModal.po,
      supplier: editForm.supplier.trim(),
      items: editForm.items,
      date: editModal.date,
      event: editForm.event.trim(),
      customer: editForm.customer.trim() || null,
      vehicle: editForm.vehicle.trim() || null,
      observation: editForm.observation.trim(),
      status: editModal.status,
      order_id: editModal.orderId || null,
    };

    const { data, error } = editModal.source === 'delivery'
      ? await supabase.from('deliveries').update(payload).eq('id', editModal.id).select().single()
      : await supabase.from('deliveries').insert([payload]).select().single();

    if (!error) {
      setDeliveries(prev => prev.map(item =>
        item.id === editModal.id
          ? {
              ...item,
              id: data?.id || item.id,
              supplier: editForm.supplier.trim(),
              customer: editForm.customer.trim() || undefined,
              vehicle: editForm.vehicle.trim() || undefined,
              event: editForm.event.trim(),
              items: editForm.items,
              observation: editForm.observation.trim(),
              source: 'delivery' as const,
            }
          : item
      ));
      setEditModal(null);
      addToast('success', 'Atualizado', 'Entrega editada com sucesso.');
    } else {
      addToast('error', 'Erro', 'Não foi possível salvar as alterações.');
    }
    setIsSavingEdit(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.source !== 'delivery') {
      addToast('warning', 'Indisponível', 'Esta entrega ainda não possui registro para exclusão.');
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from('deliveries').delete().eq('id', deleteTarget.id);
    if (!error) {
      await loadDeliveries();
      addToast('success', 'Excluída', 'Entrega removida com sucesso.');
    } else {
      addToast('error', 'Erro', 'Não foi possível excluir a entrega.');
    }
    setDeleteTarget(null);
  };

  const renderActions = (delivery: DeliveryItem) => (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {activeTab === 'operacao' && (
        <>
          <button
            type="button"
            onClick={() => openEditModal(delivery)}
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            title="Editar"
          >
            <Edit3 size={16} />
          </button>
          {delivery.source === 'delivery' && (
            <button
              type="button"
              onClick={() => setDeleteTarget(delivery)}
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            disabled={updatingId === delivery.id}
            onClick={() => openDeliverModal(delivery)}
            className="px-4 py-2 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase"
          >
            Marcar entregue
          </button>
        </>
      )}
      {activeTab === 'historico' && (
        <div className="text-[10px] font-bold text-slate-500 text-right">
          {delivery.deliveredBy && <p>Resp.: {delivery.deliveredBy}</p>}
          {delivery.observation && <p className="mt-1">{delivery.observation}</p>}
        </div>
      )}
    </div>
  );

  const openDeliverModal = (delivery: DeliveryItem) => {
    setDeliverModal(delivery);
    setDeliverForm({ responsible: profile?.full_name || '', observation: '' });
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Carregando entregas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestao de Entregas</h2>
          <p className="text-sm text-slate-500 font-medium">Registre entregas com responsável e acompanhe o histórico completo.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 self-start">
          <button onClick={() => setActiveTab('operacao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'operacao' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}>Operacao ({activeDeliveries.length})</button>
          <button onClick={() => setActiveTab('gestao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'gestao' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}>Gestao</button>
          <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'historico' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}>Historico ({historyDeliveries.length})</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fila ativa</p>
          <p className="text-3xl font-black text-slate-800 mt-2">{activeDeliveries.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor em aberto</p>
          <p className="text-2xl font-black text-slate-800 mt-2">R$ {totalPendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movimentações</p>
          <p className="text-3xl font-black text-blue-600 mt-2">{allMovements.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entregues</p>
          <p className="text-3xl font-black text-green-600 mt-2">{historyDeliveries.length}</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col lg:flex-row gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Search className="text-slate-400" size={20} />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full outline-none bg-transparent text-sm font-bold text-slate-700" placeholder="Buscar por OC, fornecedor, sinistro ou cliente..." />
        </div>
        {activeTab !== 'gestao' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl self-start">
            <button onClick={() => setViewMode('cards')} className={`p-3 rounded-xl transition-all ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Ver em cards"><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Ver em lista"><List size={18} /></button>
          </div>
        )}
      </div>

      {activeTab === 'gestao' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <BarChart3 className="text-blue-600 mb-4" size={24} />
            <h3 className="font-black text-slate-800 mb-2">Operação</h3>
            <p className="text-sm text-slate-500 font-medium">Somente entregas pendentes ficam em Operação. Ao marcar como Entregue, informe responsável e observação.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <History className="text-green-600 mb-4" size={24} />
            <h3 className="font-black text-slate-800 mb-2">Histórico</h3>
            <p className="text-sm text-slate-500 font-medium">Todas as entregas concluídas e movimentações ficam registradas na aba Histórico.</p>
          </div>
        </div>
      )}

      {activeTab === 'historico' && allMovements.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Movimentações recentes</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {allMovements.map((entry, idx) => (
              <div key={`${entry.po}-${entry.at}-${idx}`} className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-800">{entry.po} — {entry.action}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{entry.supplier}</p>
                  {entry.note && <p className="text-xs text-slate-600 mt-2">{entry.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{new Date(entry.at).toLocaleString('pt-BR')}</p>
                  {entry.user && <p className="text-xs font-bold text-blue-700 mt-1">{entry.user}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab !== 'gestao' && (
        viewMode === 'list' && visibleDeliveries.length > 0 ? (
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OC / Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinistro / Cliente</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleDeliveries.map(delivery => (
                  <tr key={delivery.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-800 text-sm">{delivery.po}</p>
                      <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusStyle[delivery.status]}`}>
                        {statusLabel[delivery.status]}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-700">{delivery.supplier}</td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-black text-blue-700">{delivery.event}</p>
                      <p className="text-[11px] font-bold text-slate-500 mt-1">{delivery.customer || 'Cliente não informado'}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">{delivery.vehicle || 'Veículo não informado'}</p>
                    </td>
                    <td className="px-6 py-5 text-right text-sm font-black text-slate-800">R$ {delivery.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-5 text-right">{renderActions(delivery)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 animate-in fade-in duration-300">
          {visibleDeliveries.length > 0 ? (
            visibleDeliveries.map(delivery => (
              <div key={delivery.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all">
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-5">
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-blue-600">
                      <Truck size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-800">{delivery.po}</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle[delivery.status]}`}>
                          {statusLabel[delivery.status]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-bold mt-1">{delivery.supplier}</p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia</p>
                    <p className="text-xs font-bold text-slate-700 flex md:justify-end items-center gap-1.5"><Clock size={12}/> {new Date(delivery.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sinistro</p>
                    <p className="text-sm text-blue-700 font-black mt-1">{delivery.event}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Volume</p>
                    <p className="text-sm text-slate-800 font-black mt-1">{delivery.items} item(ns)</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Valor</p>
                    <p className="text-sm text-slate-800 font-black mt-1">R$ {delivery.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="mb-5 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs font-bold text-slate-700">
                  <p>Cliente: <span className="text-slate-900">{delivery.customer || 'Não informado'}</span></p>
                  <p className="mt-1">Veiculo: <span className="text-slate-900">{delivery.vehicle || 'Não informado'}</span></p>
                  {delivery.status === 'Entregue' && delivery.deliveredBy && (
                    <p className="mt-2 text-green-700">Entregue por: {delivery.deliveredBy}</p>
                  )}
                  {delivery.observation && <p className="mt-1 text-slate-600">Obs.: {delivery.observation}</p>}
                </div>

                {activeTab === 'operacao' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(delivery)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase"
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                    {delivery.source === 'delivery' && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(delivery)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      disabled={updatingId === delivery.id}
                      onClick={() => openDeliverModal(delivery)}
                      className="flex-[2] flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/10"
                    >
                      <CheckCircle size={14} /> Marcar como entregue
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="xl:col-span-2 py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
              {activeTab === 'operacao' ? <PackageCheck size={36} className="mx-auto text-slate-300 mb-4" /> : <Archive size={36} className="mx-auto text-slate-300 mb-4" />}
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">{activeTab === 'operacao' ? 'Nenhuma entrega pendente' : 'Historico vazio'}</p>
            </div>
          )}
        </div>
        )
      )}

      {editModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEditModal(null)} />
          <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-800 mb-2">Editar entrega</h3>
            <p className="text-sm text-slate-500 mb-6">{editModal.po}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fornecedor *</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={editForm.supplier} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sinistro / Evento</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={editForm.event} onChange={e => setEditForm({ ...editForm, event: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cliente</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={editForm.customer} onChange={e => setEditForm({ ...editForm, customer: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Veículo</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={editForm.vehicle} onChange={e => setEditForm({ ...editForm, vehicle: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Itens</label>
                <input type="number" min={0} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={editForm.items} onChange={e => setEditForm({ ...editForm, items: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Observação</label>
                <textarea className="w-full min-h-[80px] p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none resize-none" value={editForm.observation} onChange={e => setEditForm({ ...editForm, observation: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => setEditModal(null)} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Cancelar</button>
              <button disabled={isSavingEdit} onClick={saveEdit} className="py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase disabled:opacity-50">{isSavingEdit ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir entrega?"
        description={`Tem certeza que deseja remover a entrega ${deleteTarget?.po}? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
      />

      {deliverModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDeliverModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8">
            <h3 className="text-xl font-black text-slate-800 mb-2">Registrar entrega</h3>
            <p className="text-sm text-slate-500 mb-6">{deliverModal.po} — {deliverModal.supplier}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Responsável *</label>
                <input
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                  value={deliverForm.responsible}
                  onChange={e => setDeliverForm({ ...deliverForm, responsible: e.target.value })}
                  placeholder="Nome de quem recebeu/entregou"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Observação</label>
                <textarea
                  className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-slate-700 outline-none resize-none"
                  value={deliverForm.observation}
                  onChange={e => setDeliverForm({ ...deliverForm, observation: e.target.value })}
                  placeholder="Detalhes da entrega, divergências, local..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => setDeliverModal(null)} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Cancelar</button>
              <button onClick={markAsDelivered} className="py-3 bg-green-600 text-white rounded-2xl font-black text-xs uppercase">Confirmar entrega</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deliveries;
