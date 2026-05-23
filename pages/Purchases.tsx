
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Search, Filter, CheckCircle2, XCircle, Printer, MoreVertical, 
  DollarSign, UserCheck, X, Eye, EyeOff, Loader2, Info, Trash2, ShieldCheck, AlertTriangle, Truck, Calendar, User, Car
} from 'lucide-react';
import { PurchaseOrder } from '../types';
import { supabase } from '../services/supabaseClient';

type PrintOrientation = 'portrait' | 'landscape';

const Purchases: React.FC = () => {
  const [currentUserRole] = useState<'Admin' | 'Gerente' | 'User'>('Admin');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [orders, setOrders] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'info' | 'loading' } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'cancel' | 'delete' | null;
    orderId: string | null;
    orderCode: string | null;
    amount?: number;
  }>({ isOpen: false, type: null, orderId: null, orderCode: null });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
            *,
            suppliers (
                name,
                whatsapp,
                email
            ),
            purchase_order_items (
                quotation_item_id,
                name,
                quantity,
                unit,
                unit_price,
                total_price
            )
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao carregar compras:", error);
        setToast({ show: true, title: 'Erro', message: 'Falha ao buscar OCs.', type: 'info' });
    } else {
        const quoteIds = [...new Set((data || []).map((o: any) => o.quotation_id).filter(Boolean))];
        const directEventIds = [...new Set((data || []).map((o: any) => o.event_id).filter(Boolean))];

        const { data: quoteRows } = quoteIds.length > 0
            ? await supabase.from('quotations').select('id, code, eventRef, eventId, status, created_at').in('id', quoteIds)
            : { data: [] as any[] };

        const quoteById = new Map((quoteRows || []).map((quote: any) => [quote.id, quote]));
        const quoteEventIds = (quoteRows || []).map((quote: any) => quote.eventId).filter(Boolean);
        const eventIds = [...new Set([...directEventIds, ...quoteEventIds])];

        const { data: eventRows } = eventIds.length > 0
            ? await supabase.from('events').select('id, protocol, associateId, vehicleId').in('id', eventIds)
            : { data: [] as any[] };

        const eventById = new Map((eventRows || []).map((event: any) => [event.id, event]));
        const associateIds = [...new Set((eventRows || []).map((event: any) => event.associateId).filter(Boolean))];
        const vehicleIds = [...new Set((eventRows || []).map((event: any) => event.vehicleId).filter(Boolean))];

        const [{ data: associateRows }, { data: vehicleRows }] = await Promise.all([
            associateIds.length > 0
                ? supabase.from('associates').select('id, name, document, type').in('id', associateIds)
                : Promise.resolve({ data: [] as any[] }),
            vehicleIds.length > 0
                ? supabase.from('vehicles').select('id, brand, model, plate, year_fab, year_model').in('id', vehicleIds)
                : Promise.resolve({ data: [] as any[] })
        ]);

        const associateById = new Map((associateRows || []).map((associate: any) => [associate.id, associate]));
        const vehicleById = new Map((vehicleRows || []).map((vehicle: any) => [vehicle.id, vehicle]));

        const quoteReleaseRows = quoteIds.length > 0
            ? await supabase.from('quotation_item_releases').select('quotation_id, quotation_item_id, reason, status, created_at').in('quotation_id', quoteIds)
            : { data: [] as any[] };

        const creatorIds = [...new Set((data || []).map((o: any) => o.created_by).filter(Boolean))];
        const { data: creatorRows } = creatorIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email').in('id', creatorIds)
            : { data: [] as any[] };

        const releaseByQuoteItem = new Map(
          (quoteReleaseRows.data || []).map((row: any) => [`${row.quotation_id}:${row.quotation_item_id}`, row])
        );
        const creatorById = new Map((creatorRows || []).map((profile: any) => [profile.id, profile]));

        const mappedOrders = data?.map((o: any) => {
            const quote = quoteById.get(o.quotation_id);
            const event = eventById.get(o.event_id || quote?.eventId);
            const associate = event?.associateId ? associateById.get(event.associateId) : null;
            const vehicle = event?.vehicleId ? vehicleById.get(event.vehicleId) : null;
            const creator = o.created_by ? creatorById.get(o.created_by) : null;

            return {
            id: o.id,
            code: o.code,
            eventId: o.event_id,
            quotationId: o.quotation_id,
            quotationCode: quote?.code || null,
            quotationStatus: quote?.status || null,
            quotationCreatedAt: quote?.created_at || null,
            eventProtocol: event?.protocol || quote?.eventRef || null,
            customerName: associate?.name || 'Cliente nao vinculado',
            customerDocument: associate?.document || null,
            vehicleLabel: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}${vehicle.plate ? ` - ${vehicle.plate}` : ''}`.trim() : null,
            createdByName: creator?.full_name || creator?.email || 'Colaborador nao identificado',
            supplierId: o.supplier_id,
            supplierName: o.suppliers?.name || 'Fornecedor Desconhecido',
            items: o.purchase_order_items?.map((poi: any) => ({
                quotation_item_id: poi.quotation_item_id,
                name: poi.name,
                quantity: poi.quantity,
                unit: poi.unit,
                price: poi.unit_price,
                total: poi.total_price,
                repurchaseRelease: releaseByQuoteItem.get(`${o.quotation_id}:${poi.quotation_item_id}`) || null
            })) || [],
            total: o.total || 0,
            status: o.status,
            createdAt: o.created_at
            };
        }) || [];
        setOrders(mappedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (toast?.show && toast.type !== 'loading') {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const canApprove = currentUserRole === 'Admin' || currentUserRole === 'Gerente';

  const syncWorkflowStatus = async (orderContext: any, forcedOrderStatus?: PurchaseOrder['status']) => {
    if (!orderContext?.quotationId && !orderContext?.eventId) return;
    try {
      if (orderContext?.quotationId) {
        const { data: relatedOrders } = await supabase
          .from('purchase_orders')
          .select('status')
          .eq('quotation_id', orderContext.quotationId);

        const statuses = (relatedOrders || []).map((row: any) => row.status);
        let quotationStatus = 'Aguardando Aprovação';
        if (statuses.length > 0) {
          const allCanceled = statuses.every((status: string) => status === 'Cancelada');
          const hasPendingApproval = statuses.some((status: string) => status === 'Gerada');
          const hasReceived = statuses.some((status: string) => status === 'Recebida');
          const allApprovedOrReceived = statuses.every((status: string) => status === 'Aprovada' || status === 'Recebida');
          if (allCanceled) quotationStatus = 'Cancelada';
          else if (hasPendingApproval) quotationStatus = 'Aguardando Aprovação';
          else if (hasReceived) quotationStatus = 'Compra Realizada';
          else if (allApprovedOrReceived) quotationStatus = 'Compra Autorizada';
        } else if (forcedOrderStatus === 'Cancelada') {
          quotationStatus = 'Cancelada';
        }

        await supabase.from('quotations').update({ status: quotationStatus }).eq('id', orderContext.quotationId);
        if (orderContext?.eventId) {
          let eventStatus = 'Aguardando Aprovação';
          if (quotationStatus === 'Cancelada') eventStatus = 'Reprovado';
          else if (quotationStatus === 'Compra Realizada') eventStatus = 'Concluído';
          else if (quotationStatus === 'Compra Autorizada') eventStatus = 'Aprovado';
          await supabase.from('events').update({ status: eventStatus }).eq('id', orderContext.eventId);
        }
      } else if (orderContext?.eventId) {
        const mapped = forcedOrderStatus === 'Aprovada' ? 'Aprovado' : forcedOrderStatus === 'Recebida' ? 'Concluído' : forcedOrderStatus === 'Cancelada' ? 'Reprovado' : 'Aguardando Aprovação';
        await supabase.from('events').update({ status: mapped }).eq('id', orderContext.eventId);
      }
    } catch (statusError) {
      console.warn('Falha ao sincronizar status do fluxo:', statusError);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: PurchaseOrder['status'], orderContext?: any) => {
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', id);
    if (!error) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
        await syncWorkflowStatus(orderContext, newStatus);
    } else {
        setToast({ show: true, title: 'Erro', message: 'Falha ao atualizar status.', type: 'info' });
    }
  };

  const handleRequestApprove = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'approve',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  const handleRequestCancel = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  const handleRequestDelete = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  const executeAction = async () => {
    if (confirmModal.orderId && confirmModal.type) {
      if (confirmModal.type === 'approve') {
        const order = orders.find(o => o.id === confirmModal.orderId);
        await updateOrderStatus(confirmModal.orderId, 'Aprovada', order);
        setToast({ show: true, title: 'Sucesso', message: `Ordem ${confirmModal.orderCode} aprovada.`, type: 'success' });
      } else if (confirmModal.type === 'cancel') {
        const order = orders.find(o => o.id === confirmModal.orderId);
        await updateOrderStatus(confirmModal.orderId, 'Cancelada', order);
        setToast({ show: true, title: 'Cancelado', message: `Ordem ${confirmModal.orderCode} foi cancelada.`, type: 'info' });
      } else if (confirmModal.type === 'delete') {
        const order = orders.find(o => o.id === confirmModal.orderId);
        const { error } = await supabase.from('purchase_orders').delete().eq('id', confirmModal.orderId);
        if (!error) {
            setOrders(prev => prev.filter(o => o.id !== confirmModal.orderId));
            await syncWorkflowStatus(order, 'Cancelada');
            setToast({ show: true, title: 'Excluído', message: `Ordem ${confirmModal.orderCode} removida.`, type: 'success' });
        } else {
            setToast({ show: true, title: 'Erro', message: 'Não foi possível excluir.', type: 'info' });
        }
      }
      setConfirmModal({ isOpen: false, type: null, orderId: null, orderCode: null });
    }
  };

  const handlePrint = (order: any) => {
    setToast({ show: true, title: 'Imprimindo', message: 'Gerando visualização...', type: 'loading' });
    
    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity} ${item.unit || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${(item.price || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${(item.total || (item.price * item.quantity)).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    const printContent = `
      <html>
        <head><title>Ordem de Compra ${order.code}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1 style="color: #2563eb;">Ordem de Compra: ${order.code}</h1>
          <p><strong>Cliente:</strong> ${order.customerName || 'Cliente nao vinculado'}</p>
          ${order.customerDocument ? `<p><strong>Documento:</strong> ${order.customerDocument}</p>` : ''}
          ${order.vehicleLabel ? `<p><strong>Veiculo:</strong> ${order.vehicleLabel}</p>` : ''}
          ${order.eventProtocol ? `<p><strong>Sinistro:</strong> ${order.eventProtocol}</p>` : ''}
          <p><strong>Fornecedor:</strong> ${order.supplierName}</p>
          <p><strong>Data:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <hr/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qtd</th>
                <th style="padding: 10px; text-align: right;">Unitário</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <h3 style="text-align: right; margin-top: 30px;">TOTAL: R$ ${order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
        </body>
      </html>
    `;

    const win = window.open('', '', 'width=800,height=600');
    if (win) {
        win.document.write(printContent);
        win.document.close();
        win.print();
        setToast(null);
    }
  };

  const handlePrintEnhanced = (order: any, orientation: PrintOrientation = 'portrait') => {
    setToast({ show: true, title: 'Imprimindo', message: 'Gerando visualização...', type: 'loading' });
    const isLandscape = orientation === 'landscape';

    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} ${item.unit || ''}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">R$ ${(item.total || (item.price * item.quantity)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('') || '';

    const printContent = `
      <html>
        <head>
          <title>Ordem de Compra ${order.code}</title>
          <style>
            @page { size: A4 ${orientation}; margin: ${isLandscape ? '12mm' : '18mm'}; }
            * { box-sizing: border-box; }
            body { font-family: Inter, "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; }
            .topbar { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: ${isLandscape ? '8px' : '14px'}; }
            .title { font-size: ${isLandscape ? '28px' : '34px'}; font-weight: 900; color: #1d4ed8; line-height: 1.05; margin: 8px 0 ${isLandscape ? '10px' : '16px'} 0; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 14px; }
            .meta-grid { display: grid; grid-template-columns: ${isLandscape ? 'repeat(3, 1fr)' : '1fr 1fr'}; gap: 10px; margin-bottom: 16px; }
            .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
            .meta-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .meta-value { font-size: 14px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            thead tr { background: #eff6ff; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: #1e3a8a; padding: 10px 12px; border-bottom: 1px solid #bfdbfe; }
            td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            .right, th.right { text-align: right; }
            .center, th.center { text-align: center; }
            .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
            .total-box { min-width: 240px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px; }
            .total-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px; }
            .total-value { font-size: 28px; font-weight: 900; color: #1e3a8a; text-align: right; line-height: 1; }
            .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="topbar">
            <span>${new Date().toLocaleString('pt-BR')}</span>
            <span>Ordem de Compra ${order.code}</span>
          </div>
          <div class="title">Ordem de Compra ${order.code}</div>
          <div class="subtitle">Documento gerado automaticamente pela matriz de cotações.</div>
          <div class="meta-grid">
            <div class="meta-card"><div class="meta-label">Cliente</div><div class="meta-value">${order.customerName || 'Cliente não vinculado'}</div></div>
            <div class="meta-card"><div class="meta-label">Fornecedor</div><div class="meta-value">${order.supplierName}</div></div>
            <div class="meta-card"><div class="meta-label">Documento</div><div class="meta-value">${order.customerDocument || 'Não informado'}</div></div>
            <div class="meta-card"><div class="meta-label">Data</div><div class="meta-value">${new Date(order.createdAt).toLocaleDateString('pt-BR')}</div></div>
            <div class="meta-card"><div class="meta-label">Veículo</div><div class="meta-value">${order.vehicleLabel || 'Não vinculado'}</div></div>
            <div class="meta-card"><div class="meta-label">Sinistro</div><div class="meta-value">${order.eventProtocol || 'Não vinculado'}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center">Qtd</th>
                <th class="right">Unitário</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div class="total-box">
              <div class="total-label">Total da Ordem</div>
              <div class="total-value">R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div class="footer">
            <span>Status: ${order.status}</span>
            <span>${order.items?.length || 0} item(ns)</span>
          </div>
        </body>
      </html>
    `;

    const win = window.open('', '', isLandscape ? 'width=1200,height=800' : 'width=900,height=700');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
      setToast(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const term = searchTerm.toLowerCase();
      const matchSearch = o.code.toLowerCase().includes(term) ||
                          o.supplierName.toLowerCase().includes(term) ||
                          (o.customerName || '').toLowerCase().includes(term) ||
                          (o.eventProtocol || '').toLowerCase().includes(term);
      const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  const getStatusClass = (status: string) => {
    if (status === 'Aprovada' || status === 'Recebida') return 'bg-green-50 text-green-700 border-green-100';
    if (status === 'Cancelada') return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, any>();
    filteredOrders.forEach(order => {
      const key = `${order.customerName || 'Cliente nao vinculado'}|${order.eventProtocol || order.eventId || 'Sem sinistro'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          customerName: order.customerName || 'Cliente nao vinculado',
          customerDocument: order.customerDocument,
          eventProtocol: order.eventProtocol || 'Sinistro nao vinculado',
          vehicleLabel: order.vehicleLabel,
          orders: [],
          total: 0,
          itemCount: 0,
          statuses: new Set<string>(),
          quotations: new Set<string>(),
          collaborators: new Set<string>(),
          createdAt: order.createdAt
        });
      }
      const group = groups.get(key);
      group.orders.push(order);
      group.total += Number(order.total || 0);
      group.itemCount += order.items?.length || 0;
      group.statuses.add(order.status);
      if (order.quotationCode) group.quotations.add(order.quotationCode);
      if (order.createdByName) group.collaborators.add(order.createdByName);
      if (new Date(order.createdAt).getTime() > new Date(group.createdAt).getTime()) group.createdAt = order.createdAt;
    });
    return Array.from(groups.values());
  }, [filteredOrders]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  if (loading) return <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600" size={32}/></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Toast Overlay */}
      {toast && toast.show && (
        <div className="fixed top-6 right-6 z-[120] animate-in slide-in-from-right-10 duration-300">
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 min-w-[300px]">
                {toast.type === 'loading' ? <Loader2 className="animate-spin"/> : <Info/>}
                <div><p className="font-bold">{toast.title}</p><p className="text-xs">{toast.message}</p></div>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Ordens de Compra</h2>
          <p className="text-sm text-slate-500">Organizadas por associado e sinistro, com as OCs e cotações dentro de cada caso.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none" 
            placeholder="Buscar OC, fornecedor, cliente ou sinistro..."
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto">
            {['Todos', 'Gerada', 'Aprovada', 'Cancelada'].map(st => (
                <button key={st} onClick={() => setFilterStatus(st)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterStatus === st ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{st}</button>
            ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {groupedOrders.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                <ShoppingCart className="mx-auto text-slate-300 mb-2" size={40}/>
                <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhuma compra encontrada</p>
            </div>
        ) : (
            groupedOrders.map(group => (
                <div key={group.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm hover:border-blue-200 transition-all overflow-hidden">
                    <button type="button" onClick={() => toggleGroup(group.id)} className="w-full p-6 text-left">
                        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl font-black bg-blue-50 text-blue-600">
                                <User size={28} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h3 className="text-xl font-black text-slate-800">{group.customerName}</h3>
                                    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{group.orders.length} OC(s)</span>
                                    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600">{group.quotations.size || 1} cotacao(oes)</span>
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs font-bold text-slate-500">
                                    <span className="flex items-center gap-1 text-slate-800"><ShoppingCart size={12} className="text-blue-500"/> {group.eventProtocol}</span>
                                    {group.vehicleLabel && (
                                        <>
                                            <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="flex items-center gap-1 truncate max-w-[320px]"><Car size={12} className="text-slate-400"/> {group.vehicleLabel}</span>
                                        </>
                                    )}
                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(group.createdAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {Array.from(group.collaborators).slice(0, 3).map((name: any) => (
                                        <span key={name} className="px-2 py-1 rounded-lg bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">Colaborador: {name}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="w-full xl:w-auto flex items-center justify-between xl:justify-end gap-5">
                                <div className="text-left xl:text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total do caso</p>
                                    <p className="text-2xl font-black text-slate-800 leading-none">R$ {group.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </div>
                                <div className="text-left xl:text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens</p>
                                    <p className="text-lg font-black text-slate-700">{group.itemCount}</p>
                                </div>
                                <div className="px-4 py-3 rounded-2xl bg-slate-50 text-xs font-black uppercase tracking-widest text-blue-600">
                                    {expandedGroups[group.id] ? 'Fechar' : 'Abrir'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {expandedGroups[group.id] && (
                        <div className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {group.orders.map((order: any) => (
                                <div key={order.id} className="rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-white text-blue-600 border border-slate-100">
                                                {order.status === 'Cancelada' ? <XCircle className="text-red-400"/> : <ShoppingCart/>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="text-base font-black text-slate-800">{order.code}</h4>
                                                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${getStatusClass(order.status)}`}>{order.status}</span>
                                                    {order.quotationCode && <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-white text-blue-600 border-blue-100">{order.quotationCode}</span>}
                                                </div>
                                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs text-slate-500 font-bold">
                                                    <span className="flex items-center gap-1 text-slate-700 truncate max-w-[260px]"><Truck size={12} className="text-blue-400"/> {order.supplierName}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>Feita por {order.createdByName}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>{order.items.length} itens</span>
                                                </div>
                                                {order.quotationStatus && (
                                                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Status da cotacao: {order.quotationStatus}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between lg:justify-end gap-4">
                                            <div className="text-left lg:text-right min-w-[140px]">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valor da OC</p>
                                                <p className="text-xl font-black text-slate-800 leading-none">R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                            </div>

                                            <div className="flex gap-2 flex-shrink-0">
                                                {order.status === 'Gerada' && canApprove && (
                                                    <button onClick={() => handleRequestApprove(order)} className="bg-green-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center gap-2" title="Aprovar OC">
                                                        <ShieldCheck size={16}/>
                                                    </button>
                                                )}
                                                <button onClick={() => setViewOrder(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm" title="Ver Detalhes"><Eye size={18}/></button>
                                                <button onClick={() => handlePrintEnhanced(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm hidden sm:block" title="Imprimir em retrato"><Printer size={18}/></button>
                                                <div className="relative">
                                                    <button onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"><MoreVertical size={18}/></button>
                                                    {openMenuId === order.id && (
                                                        <div className="absolute right-0 bottom-full lg:bottom-auto lg:top-full mb-2 lg:mb-0 lg:mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in duration-200">
                                                            {order.status !== 'Cancelada' && <button onClick={() => handleRequestCancel(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-amber-600 hover:bg-amber-50 border-b border-slate-50">Cancelar OC</button>}
                                                            <button onClick={() => { setOpenMenuId(null); handlePrintEnhanced(order, 'landscape'); }} className="w-full text-left px-4 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 border-b border-slate-50">Imprimir paisagem</button>
                                                            <button onClick={() => handleRequestDelete(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50">Excluir Registro</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      {/* Modal Visualizar Itens */}
      {viewOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewOrder(null)}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800">Itens da Compra ({viewOrder.code})</h3>
                    <button onClick={() => setViewOrder(null)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Cliente</p>
                            <p className="text-sm font-black text-slate-800">{viewOrder.customerName}</p>
                            {viewOrder.customerDocument && <p className="text-xs font-bold text-slate-500 mt-1">{viewOrder.customerDocument}</p>}
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sinistro / Veiculo</p>
                            <p className="text-sm font-black text-slate-800">{viewOrder.eventProtocol || 'Sinistro nao vinculado'}</p>
                            {viewOrder.vehicleLabel && <p className="text-xs font-bold text-slate-500 mt-1">{viewOrder.vehicleLabel}</p>}
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fornecedor / Status</p>
                            <p className="text-sm font-black text-slate-800">{viewOrder.supplierName}</p>
                            <p className="text-xs font-bold text-slate-500 mt-1">{new Date(viewOrder.createdAt).toLocaleDateString('pt-BR')} • {viewOrder.status}</p>
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead><tr><th className="pb-2 text-xs font-black text-slate-400 uppercase">Item</th><th className="pb-2 text-center text-xs font-black text-slate-400 uppercase">Qtd</th><th className="pb-2 text-right text-xs font-black text-slate-400 uppercase">Unit.</th><th className="pb-2 text-right text-xs font-black text-slate-400 uppercase">Total</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewOrder.items?.map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="py-3 text-sm font-bold text-slate-700">
                                      <div className="flex items-center gap-2">
                                        <span>{item.name}</span>
                                        {item.repurchaseRelease && (
                                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                                            Recompra
                                          </span>
                                        )}
                                      </div>
                                      {item.repurchaseRelease?.reason && (
                                        <p className="text-[10px] font-medium text-amber-700 mt-1">Motivo: {item.repurchaseRelease.reason}</p>
                                      )}
                                    </td>
                                    <td className="py-3 text-center text-sm font-medium text-slate-500">{item.quantity} {item.unit || ''}</td>
                                    <td className="py-3 text-right text-sm font-medium text-slate-600">R$ {(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-3 text-right text-sm font-bold text-slate-800">R$ {(item.total || (item.price * item.quantity)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{viewOrder.items?.length || 0} item(ns)</p>
                        <p className="text-xl font-black text-slate-800">R$ {viewOrder.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-end gap-2">
                    <button onClick={() => handlePrintEnhanced(viewOrder)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700">
                        <Printer size={14}/> Imprimir retrato
                    </button>
                    <button onClick={() => handlePrintEnhanced(viewOrder, 'landscape')} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800">
                        <Printer size={14}/> Imprimir paisagem
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Modal Confirmação */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmModal.type === 'approve' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
              {confirmModal.type === 'approve' ? <ShieldCheck size={40} /> : <AlertTriangle size={40} />}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Confirmar Ação?</h3>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Voltar</button>
              <button onClick={executeAction} className={`py-3 text-white rounded-2xl font-black text-xs uppercase ${confirmModal.type === 'approve' ? 'bg-green-600' : 'bg-red-500'}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;


