import React, { useState, useEffect, useMemo } from 'react';
import { Truck, CheckCircle, AlertTriangle, Clock, Archive, BarChart3, PackageCheck, ClipboardList, Route, Search, UserCheck, BriefcaseBusiness, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

type DeliveryStatus = 'Pendente' | 'Em Separacao' | 'Despachado' | 'Conforme' | 'Divergente';

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
  source: 'delivery' | 'purchase_order';
}

const statusStyle: Record<DeliveryStatus, string> = {
  Pendente: 'bg-amber-50 text-amber-700 border-amber-100',
  'Em Separacao': 'bg-blue-50 text-blue-700 border-blue-100',
  Despachado: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Conforme: 'bg-green-50 text-green-700 border-green-100',
  Divergente: 'bg-red-50 text-red-700 border-red-100',
};

const statusLabel: Record<DeliveryStatus, string> = {
  Pendente: 'Aguardando',
  'Em Separacao': 'Em separacao',
  Despachado: 'Despachado',
  Conforme: 'Conforme',
  Divergente: 'Divergente',
};

const Deliveries: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'operacao' | 'gestao' | 'historico'>('operacao');
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    loadDeliveries();
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
          quotations (eventRef)
        `)
        .in('status', ['Aprovada', 'Recebida'])
        .order('created_at', { ascending: false })
    ]);

    const existingByPo = new Map((deliveryRows || []).map((row: any) => [row.po, row]));
    const eventIds = [...new Set((orderRows || []).map((order: any) => order.event_id).filter(Boolean))];
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

    const fromOrders: DeliveryItem[] = (orderRows || []).map((order: any) => {
      const existing = existingByPo.get(order.code);
      const event = eventById.get(order.event_id);
      const associate = event?.associateId ? associateById.get(event.associateId) : null;
      const vehicle = event?.vehicleId ? vehicleById.get(event.vehicleId) : null;
      const fallbackStatus: DeliveryStatus = order.status === 'Recebida' ? 'Conforme' : 'Pendente';

      return {
        id: existing?.id || `po-${order.id}`,
        orderId: order.id,
        quotationId: order.quotation_id,
        po: order.code,
        supplier: order.suppliers?.name || existing?.supplier || 'Fornecedor nao vinculado',
        items: existing?.items || order.purchase_order_items?.length || 0,
        date: existing?.date || order.created_at,
        event: existing?.event || event?.protocol || order.quotations?.eventRef || 'Sem sinistro',
        amount: Number(order.total || 0),
        status: (existing?.status || fallbackStatus) as DeliveryStatus,
        customer: associate?.name,
        vehicle: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}${vehicle.plate ? ` - ${vehicle.plate}` : ''}`.trim() : undefined,
        source: existing ? 'delivery' : 'purchase_order'
      };
    });

    const orphanDeliveries: DeliveryItem[] = (deliveryRows || [])
      .filter((row: any) => !fromOrders.some(delivery => delivery.po === row.po))
      .map((row: any) => ({
        id: row.id,
        po: row.po,
        supplier: row.supplier,
        items: row.items || 0,
        date: row.date,
        event: row.event,
        amount: 0,
        status: (row.status || 'Pendente') as DeliveryStatus,
        source: 'delivery'
      }));

    setDeliveries([...fromOrders, ...orphanDeliveries]);
    setLoading(false);
  };

  const persistDelivery = async (delivery: DeliveryItem, newStatus: DeliveryStatus) => {
    setUpdatingId(delivery.id);

    const payload = {
      po: delivery.po,
      supplier: delivery.supplier,
      items: delivery.items,
      date: delivery.date || new Date().toISOString(),
      event: delivery.event,
      status: newStatus
    };

    const saveDelivery = delivery.source === 'purchase_order'
      ? supabase.from('deliveries').insert([payload]).select().single()
      : supabase.from('deliveries').update({ status: newStatus }).eq('id', delivery.id).select().single();

    const { data, error } = await saveDelivery;
    if (!error && delivery.orderId) {
      await supabase
        .from('purchase_orders')
        .update({ status: newStatus === 'Conforme' ? 'Recebida' : 'Aprovada' })
        .eq('id', delivery.orderId);
      await syncDeliveryWorkflow(delivery, newStatus);
    }

    if (!error) {
      setDeliveries(prev => prev.map(item => item.id === delivery.id ? { ...item, id: data?.id || item.id, status: newStatus, source: 'delivery' } : item));
    } else {
      alert('Erro ao atualizar entrega');
    }

    setUpdatingId(null);
  };

  const syncDeliveryWorkflow = async (delivery: DeliveryItem, newStatus: DeliveryStatus) => {
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
            const eventStatus = quotationStatus === 'Compra Realizada' ? 'Concluído' : newStatus === 'Divergente' ? 'Aguardando Aprovação' : 'Aprovado';
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

  const activeDeliveries = filteredDeliveries.filter(delivery => !['Conforme', 'Divergente'].includes(delivery.status));
  const historyDeliveries = filteredDeliveries.filter(delivery => ['Conforme', 'Divergente'].includes(delivery.status));
  const delayedCount = activeDeliveries.filter(delivery => new Date(delivery.date).getTime() < Date.now() - 24 * 60 * 60 * 1000).length;
  const totalPendingValue = activeDeliveries.reduce((sum, delivery) => sum + delivery.amount, 0);
  const divergentCount = historyDeliveries.filter(delivery => delivery.status === 'Divergente').length;
  const visibleDeliveries = activeTab === 'operacao' ? activeDeliveries : historyDeliveries;

  if (loading) return <div className="text-center py-20 text-slate-400">Carregando entregas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestao de Entregas</h2>
          <p className="text-sm text-slate-500 font-medium">Acompanhe OCs aprovadas, recebimento fisico e divergencias para auditoria.</p>
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
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas / diverg.</p>
          <p className="text-3xl font-black text-red-500 mt-2">{delayedCount + divergentCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concluidas</p>
          <p className="text-3xl font-black text-green-600 mt-2">{historyDeliveries.filter(d => d.status === 'Conforme').length}</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <BarChart3 className="text-blue-600 mb-4" size={24} />
            <h3 className="font-black text-slate-800 mb-2">Prioridade do gestor</h3>
            <p className="text-sm text-slate-500 font-medium">Ataque primeiro pedidos atrasados, divergentes e OCs de maior valor em aberto. Divergente fica no Historico como pendencia de tratativa.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <UserCheck className="text-green-600 mb-4" size={24} />
            <h3 className="font-black text-slate-800 mb-2">Visao do colaborador</h3>
            <p className="text-sm text-slate-500 font-medium">Separar, despachar e confirmar conformidade no recebimento fisico.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <BriefcaseBusiness className="text-indigo-600 mb-4" size={24} />
            <h3 className="font-black text-slate-800 mb-2">Controle financeiro</h3>
            <p className="text-sm text-slate-500 font-medium">A OC so vira recebida quando marcada como Conforme, mantendo rastreio para auditoria.</p>
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
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Itens</th>
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
                        {delivery.status === 'Divergente' ? 'Divergente - tratar' : statusLabel[delivery.status]}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-700">{delivery.supplier}</td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-black text-blue-700">{delivery.event}</p>
                      {delivery.customer && <p className="text-[11px] font-bold text-slate-500 mt-1">{delivery.customer}</p>}
                      {delivery.vehicle && <p className="text-[11px] font-bold text-slate-400 mt-1">{delivery.vehicle}</p>}
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-black text-slate-700">{delivery.items}</td>
                    <td className="px-6 py-5 text-right text-sm font-black text-slate-800">R$ {delivery.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-5">
                      {activeTab === 'operacao' ? (
                        <div className="flex justify-end gap-2">
                          <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Em Separacao')} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase">Separar</button>
                          <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Despachado')} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase">Despachar</button>
                          <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Conforme')} className="px-3 py-2 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase">Conforme</button>
                          <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Divergente')} className="px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-[10px] font-black uppercase">Divergente</button>
                        </div>
                      ) : (
                        <p className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {delivery.status === 'Divergente' ? 'Revisar fornecedor/itens' : 'Recebimento fechado'}
                        </p>
                      )}
                    </td>
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
                          {delivery.status === 'Divergente' ? 'Divergente - tratar' : statusLabel[delivery.status]}
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

                {(delivery.customer || delivery.vehicle) && (
                  <div className="mb-5 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs font-bold text-slate-700">
                    {delivery.customer && <p>Cliente: <span className="text-slate-900">{delivery.customer}</span></p>}
                    {delivery.vehicle && <p className="mt-1">Veiculo: <span className="text-slate-900">{delivery.vehicle}</span></p>}
                  </div>
                )}

                {activeTab === 'operacao' && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Em Separacao')} className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"><ClipboardList size={14} /> Separar</button>
                    <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Despachado')} className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"><Route size={14} /> Despachar</button>
                    <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Conforme')} className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/10"><CheckCircle size={14} /> Conforme</button>
                    <button disabled={updatingId === delivery.id} onClick={() => persistDelivery(delivery, 'Divergente')} className="flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"><AlertTriangle size={14} /> Divergente</button>
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
    </div>
  );
};

export default Deliveries;
