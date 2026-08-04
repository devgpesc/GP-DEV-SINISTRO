
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Search, Filter, CheckCircle2, XCircle, Printer, MoreVertical, 
  DollarSign, UserCheck, X, Eye, EyeOff, Loader2, Info, Trash2, ShieldCheck, AlertTriangle, Truck, Calendar, User, Car, History, ClipboardList, ChevronRight, Scale, RotateCcw
} from 'lucide-react';
import { PurchaseOrder } from '../types';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { openPurchaseOrderPreview, PrintOrientation } from '../utils/purchaseOrderPrint';
import { purchaseOrderService, getActionLabel, PurchaseOrderHistoryEntry } from '../services/purchaseOrderService';
import { auditService } from '../services/auditService';
import { formatVehicleLabel } from '../utils/vehicleLabel';
import ViewModeSwitch, { ViewMode } from '../components/ViewModeSwitch';
import { getOfferRecommendation } from '../utils/offerRecommendation';

const Purchases: React.FC = () => {
  const { access } = useAuth();
  const canApprove = access.canApprovePurchases;
  const canCancel = access.canCancelPurchases;
  const canDelete = access.canDeleteRecords;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [orders, setOrders] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = window.localStorage.getItem('eventscar:purchases-view');
    return saved === 'cards' || saved === 'panel' ? saved : 'list';
  });
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'info' | 'loading' } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'cancel' | 'return' | 'delete' | null;
    orderId: string | null;
    orderCode: string | null;
    amount?: number;
    approvalNote?: string;
  }>({ isOpen: false, type: null, orderId: null, orderCode: null, approvalNote: '' });

  const [historyModal, setHistoryModal] = useState<{ order: any | null; entries: PurchaseOrderHistoryEntry[]; loading: boolean }>({
    order: null,
    entries: [],
    loading: false,
  });

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('purchases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => loadOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotations' }, () => loadOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const deriveQuotationStatus = (statuses: string[], fallback?: string | null, hasReleasedItems = false) => {
    if (statuses.length === 0) return fallback || 'Aguardando Aprovação';
    const allReversed = statuses.every(status => status === 'Cancelada' || status === 'Devolvida');
    const hasPendingApproval = statuses.some(status => status === 'Gerada');
    const allReceived = statuses.every(status => status === 'Recebida');
    const allApprovedOrReceived = statuses.every(status => status === 'Aprovada' || status === 'Recebida');

    if (allReversed && hasReleasedItems) return 'Compra Autorizada';
    if (allReversed) return 'Cancelada';
    if (hasPendingApproval) return 'Aguardando Aprovação';
    if (allReceived) return 'Compra Realizada';
    if (allApprovedOrReceived) return 'Compra Autorizada';
    return fallback || 'Aguardando Aprovação';
  };

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

        const quotationItemIds = [...new Set(
          (data || []).flatMap((order: any) =>
            (order.purchase_order_items || []).map((item: any) => item.quotation_item_id).filter(Boolean)
          )
        )];
        const { data: comparisonPriceRows } = quotationItemIds.length > 0
          ? await supabase
              .from('quotation_supplier_prices')
              .select('quotation_item_id, supplier_id, price, delivery_days, availability, is_winner')
              .in('quotation_item_id', quotationItemIds)
          : { data: [] as any[] };
        const comparisonSupplierIds = [...new Set((comparisonPriceRows || []).map((price: any) => price.supplier_id).filter(Boolean))];
        const { data: comparisonSupplierRows } = comparisonSupplierIds.length > 0
          ? await supabase.from('suppliers').select('id, name, city, rating').in('id', comparisonSupplierIds)
          : { data: [] as any[] };

        const creatorIds = [...new Set((data || []).map((o: any) => o.created_by).filter(Boolean))];
        const { data: creatorRows } = creatorIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email').in('id', creatorIds)
            : { data: [] as any[] };

        const orderCodes = [...new Set((data || []).map((o: any) => o.code).filter(Boolean))];
        const { data: deliveryRows } = orderCodes.length > 0
            ? await supabase.from('deliveries').select('po, status').in('po', orderCodes)
            : { data: [] as any[] };

        const releaseByQuoteItem = new Map(
          (quoteReleaseRows.data || []).map((row: any) => [`${row.quotation_id}:${row.quotation_item_id}`, row])
        );
        const comparisonSupplierById = new Map((comparisonSupplierRows || []).map((supplier: any) => [supplier.id, supplier]));
        const comparisonsByItemId = new Map<string, any[]>();
        (comparisonPriceRows || []).forEach((row: any) => {
          const supplier = comparisonSupplierById.get(row.supplier_id);
          const current = comparisonsByItemId.get(row.quotation_item_id) || [];
          current.push({
            supplierId: row.supplier_id,
            supplierName: supplier?.name || 'Fornecedor não identificado',
            supplierCity: supplier?.city || '',
            supplierRating: supplier?.rating ?? null,
            price: Number(row.price || 0),
            deliveryDays: row.delivery_days ?? null,
            availability: row.availability !== false,
            isWinner: row.is_winner === true,
          });
          comparisonsByItemId.set(row.quotation_item_id, current);
        });
        const releasedQuotationIds = new Set(
          (quoteReleaseRows.data || [])
            .filter((row: any) => row.status === 'released')
            .map((row: any) => row.quotation_id)
        );
        const creatorById = new Map((creatorRows || []).map((profile: any) => [profile.id, profile]));
        const deliveryByPo = new Map((deliveryRows || []).map((delivery: any) => [delivery.po, delivery.status]));
        const statusesByQuoteId = new Map<string, string[]>();
        (data || []).forEach((order: any) => {
          if (!order.quotation_id) return;
          const current = statusesByQuoteId.get(order.quotation_id) || [];
          current.push(order.status);
          statusesByQuoteId.set(order.quotation_id, current);
        });

        const mappedOrders = data?.map((o: any) => {
            const quote = quoteById.get(o.quotation_id);
            const event = eventById.get(o.event_id || quote?.eventId);
            const associate = event?.associateId ? associateById.get(event.associateId) : null;
            const vehicle = event?.vehicleId ? vehicleById.get(event.vehicleId) : null;
            const creator = o.created_by ? creatorById.get(o.created_by) : null;
            const derivedQuotationStatus = o.quotation_id
              ? deriveQuotationStatus(statusesByQuoteId.get(o.quotation_id) || [], quote?.status, releasedQuotationIds.has(o.quotation_id))
              : quote?.status || null;

            return {
            id: o.id,
            code: o.code,
            eventId: o.event_id,
            quotationId: o.quotation_id,
            quotationCode: quote?.code || null,
            quotationStatus: derivedQuotationStatus,
            storedQuotationStatus: quote?.status || null,
            quotationCreatedAt: quote?.created_at || null,
            eventProtocol: event?.protocol || quote?.eventRef || null,
            customerName: associate?.name || 'Cliente não vinculado',
            customerDocument: associate?.document || null,
            vehicleLabel: vehicle ? formatVehicleLabel(vehicle) : null,
            createdByName: creator?.full_name || creator?.email || 'Colaborador não identificado',
            supplierId: o.supplier_id,
            supplierName: o.suppliers?.name || 'Fornecedor Desconhecido',
            items: o.purchase_order_items?.map((poi: any) => ({
                quotation_item_id: poi.quotation_item_id,
                name: poi.name,
                quantity: poi.quantity,
                unit: poi.unit,
                price: poi.unit_price,
                total: poi.total_price,
                repurchaseRelease: releaseByQuoteItem.get(`${o.quotation_id}:${poi.quotation_item_id}`) || null,
                comparisons: comparisonsByItemId.get(poi.quotation_item_id) || [],
            })) || [],
            total: o.total || 0,
            status: o.status,
            deliveryStatus: deliveryByPo.get(o.code) || null,
            reversedAmount: Number(o.reversed_amount || 0),
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

  useEffect(() => {
    if (!viewOrder || viewMode === 'panel') return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewOrder(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [viewOrder, viewMode]);

  const patchQuotationStatusLocally = (quotationId: string | null | undefined, quotationStatus: string) => {
    if (!quotationId) return;
    setOrders(prev => prev.map(order =>
      order.quotationId === quotationId ? { ...order, quotationStatus } : order
    ));
  };

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
          const allReversed = statuses.every((status: string) => status === 'Cancelada' || status === 'Devolvida');
          const hasPendingApproval = statuses.some((status: string) => status === 'Gerada');
          const allReceived = statuses.every((status: string) => status === 'Recebida');
          const allApprovedOrReceived = statuses.every((status: string) => status === 'Aprovada' || status === 'Recebida');
          if (allReversed) quotationStatus = 'Cancelada';
          else if (hasPendingApproval) quotationStatus = 'Aguardando Aprovação';
          else if (allReceived) quotationStatus = 'Compra Realizada';
          else if (allApprovedOrReceived) quotationStatus = 'Compra Autorizada';
        } else if (forcedOrderStatus === 'Cancelada' || forcedOrderStatus === 'Devolvida') {
          quotationStatus = 'Cancelada';
        }

        await supabase.from('quotations').update({ status: quotationStatus }).eq('id', orderContext.quotationId);
        patchQuotationStatusLocally(orderContext.quotationId, quotationStatus);
        if (orderContext?.eventId) {
          let eventStatus = 'Aguardando Aprovação';
          if (quotationStatus === 'Cancelada') eventStatus = 'Reprovado';
          else if (quotationStatus === 'Compra Realizada') eventStatus = 'Concluído';
          else if (quotationStatus === 'Compra Autorizada') eventStatus = 'Aprovado';
          await supabase.from('events').update({ status: eventStatus }).eq('id', orderContext.eventId);
        }
      } else if (orderContext?.eventId) {
        const mapped = forcedOrderStatus === 'Aprovada' ? 'Aprovado' : forcedOrderStatus === 'Recebida' ? 'Concluído' : forcedOrderStatus === 'Cancelada' || forcedOrderStatus === 'Devolvida' ? 'Reprovado' : 'Aguardando Aprovação';
        await supabase.from('events').update({ status: mapped }).eq('id', orderContext.eventId);
      }
    } catch (statusError) {
      console.warn('Falha ao sincronizar status do fluxo:', statusError);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: PurchaseOrder['status'], orderContext?: any, extra?: Record<string, unknown>) => {
    const previous = orders.find(o => o.id === id);
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus, ...extra }).eq('id', id);
    if (!error) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, ...extra } : o));
        await syncWorkflowStatus(orderContext, newStatus);
        auditService.log('Update Status', 'PurchaseOrder', id, {
          code: orderContext?.code || previous?.code,
          from_status: previous?.status,
          to_status: newStatus,
          ...extra,
        });
    } else {
        setToast({ show: true, title: 'Erro', message: error.message || 'Falha ao atualizar status.', type: 'info' });
    }
  };

  const openHistory = async (order: any) => {
    setHistoryModal({ order, entries: [], loading: true });
    const entries = await purchaseOrderService.getHistory(order.id);
    setHistoryModal({ order, entries, loading: false });
    setOpenMenuId(null);
  };

  const handleRequestApprove = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'approve',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total,
      approvalNote: ''
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

  const handleRequestReturn = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'return',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total,
      approvalNote: '',
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

  const handleResolveDivergence = async (order: any) => {
    setToast({ show: true, title: 'Reabrindo entrega', message: `Enviando ${order.code} para tratativa operacional.`, type: 'loading' });
    setOpenMenuId(null);

    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'Pendente' })
      .eq('po', order.code);

    if (error) {
      setToast({ show: true, title: 'Erro', message: 'Não foi possível reabrir a entrega divergente.', type: 'info' });
      return;
    }

    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, deliveryStatus: 'Pendente' } : item));
    setToast({ show: true, title: 'Entrega reaberta', message: `${order.code} voltou para a fila de Operação em Entregas.`, type: 'success' });
  };

  const executeAction = async () => {
    if (confirmModal.orderId && confirmModal.type) {
      if (confirmModal.type === 'approve') {
        const order = orders.find(o => o.id === confirmModal.orderId);
        const note = confirmModal.approvalNote?.trim();
        const { data: { user } } = await supabase.auth.getUser();
        await updateOrderStatus(confirmModal.orderId, 'Aprovada', order, {
          approval_note: note || null,
          approved_by: user?.id || null,
          approved_at: new Date().toISOString()
        });
        setToast({ show: true, title: 'Sucesso', message: `Ordem ${confirmModal.orderCode} aprovada.`, type: 'success' });
      } else if (confirmModal.type === 'cancel') {
        const cancellingOrder = orders.find((order) => order.id === confirmModal.orderId);
        const expectedReversal = Number(cancellingOrder?.total || confirmModal.amount || 0);
        setToast({ show: true, title: 'Cancelando e estornando OC', message: `Retirando R$ ${expectedReversal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} dos indicadores e liberando os itens.`, type: 'loading' });
        try {
          const result = await purchaseOrderService.cancelAndReleaseForRepurchase({
            purchaseOrderId: confirmModal.orderId,
          });
          await loadOrders();
          const reversedAmount = Number(result?.reversedAmount ?? result?.reversed_amount ?? expectedReversal);
          setToast({
            show: true,
            title: 'Compra cancelada e valor estornado',
            message: `${confirmModal.orderCode}: R$ ${reversedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} retirados dos KPIs; ${result.releasedItems} item(ns) voltaram para compra.`,
            type: 'success'
          });
        } catch (error: any) {
          setToast({ show: true, title: 'Erro ao cancelar', message: error?.message || 'Nao foi possivel liberar a recompra.', type: 'info' });
          return;
        }
      } else if (confirmModal.type === 'return') {
        const returningOrder = orders.find((order) => order.id === confirmModal.orderId);
        const expectedReturn = Number(returningOrder?.total || confirmModal.amount || 0);
        const reason = confirmModal.approvalNote?.trim();
        setToast({
          show: true,
          title: 'Registrando devolução',
          message: `Retirando R$ ${expectedReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do caixa gerencial e dos KPIs.`,
          type: 'loading',
        });
        try {
          const result = await purchaseOrderService.registerReturn({
            purchaseOrderId: confirmModal.orderId,
            reason,
          });
          await loadOrders();
          const returnedAmount = Number(result?.returnedAmount ?? result?.returned_amount ?? expectedReturn);
          setToast({
            show: true,
            title: 'Devolução registrada',
            message: `${confirmModal.orderCode}: R$ ${returnedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} devolvidos e retirados dos indicadores. Os itens foram liberados para nova cotação e compra.`,
            type: 'success',
          });
        } catch (error: any) {
          setToast({ show: true, title: 'Erro na devolução', message: error?.message || 'Não foi possível registrar a devolução.', type: 'info' });
          return;
        }
      } else if (confirmModal.type === 'delete') {
        if (!canDelete) {
          setToast({ show: true, title: 'Acesso negado', message: 'Você não possui permissão para excluir OCs.', type: 'info' });
          return;
        }
        const order = orders.find(o => o.id === confirmModal.orderId);
        const { error } = await supabase.from('purchase_orders').delete().eq('id', confirmModal.orderId);
        if (!error) {
            setOrders(prev => prev.filter(o => o.id !== confirmModal.orderId));
            await syncWorkflowStatus(order, 'Cancelada');
            auditService.log('Delete', 'PurchaseOrder', confirmModal.orderId!, { code: confirmModal.orderCode });
            setToast({ show: true, title: 'Excluído', message: `Ordem ${confirmModal.orderCode} removida.`, type: 'success' });
        } else {
            setToast({ show: true, title: 'Erro', message: error.message || 'Não foi possível excluir.', type: 'info' });
        }
      }
      setConfirmModal({ isOpen: false, type: null, orderId: null, orderCode: null });
    }
  };

  const handlePrintEnhanced = (order: any, orientation: PrintOrientation = 'portrait') => {
    setToast({ show: true, title: 'Visualização', message: 'Abrindo documento no navegador...', type: 'loading' });
    openPurchaseOrderPreview(order, orientation);
    setTimeout(() => setToast(null), 1200);
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
    if (status === 'Devolvida') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  const getQuotationStatusClass = (status: string) => {
    if (status === 'Compra Autorizada' || status === 'Compra Realizada') return 'text-green-700';
    if (status === 'Cancelada') return 'text-red-600';
    return 'text-amber-600';
  };

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, any>();
    filteredOrders.forEach(order => {
      const key = `${order.customerName || 'Cliente não vinculado'}|${order.eventProtocol || order.eventId || 'Sem sinistro'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          customerName: order.customerName || 'Cliente não vinculado',
          customerDocument: order.customerDocument,
          eventProtocol: order.eventProtocol || 'Sinistro não vinculado',
          vehicleLabel: order.vehicleLabel,
          orders: [],
          total: 0,
          itemCount: 0,
          reversedTotal: 0,
          statuses: new Set<string>(),
          quotations: new Set<string>(),
          collaborators: new Set<string>(),
          createdAt: order.createdAt
        });
      }
      const group = groups.get(key);
      group.orders.push(order);
      const isReversed = order.status === 'Cancelada' || order.status === 'Devolvida';
      if (isReversed) group.reversedTotal += Number(order.reversedAmount || order.total || 0);
      else group.total += Number(order.total || 0);
      group.itemCount += order.items?.length || 0;
      group.statuses.add(order.status);
      if (order.quotationCode) group.quotations.add(order.quotationCode);
      if (order.createdByName) group.collaborators.add(order.createdByName);
      if (new Date(order.createdAt).getTime() > new Date(group.createdAt).getTime()) group.createdAt = order.createdAt;
    });
    return Array.from(groups.values());
  }, [filteredOrders]);

  const purchaseFinancialStats = useMemo(() => {
    const reversedOrders = orders.filter((order) => order.status === 'Cancelada' || order.status === 'Devolvida');
    const activeOrders = orders.filter((order) => order.status !== 'Cancelada' && order.status !== 'Devolvida');
    return {
      activeValue: activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      cancelledCount: orders.filter((order) => order.status === 'Cancelada').length,
      returnedCount: orders.filter((order) => order.status === 'Devolvida').length,
      affectedQuotations: new Set(reversedOrders.map((order) => order.quotationId).filter(Boolean)).size,
      reversedValue: reversedOrders.reduce((sum, order) => sum + Number(order.reversedAmount || order.total || 0), 0),
    };
  }, [orders]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode !== 'panel') setViewOrder(null);
    window.localStorage.setItem('eventscar:purchases-view', mode);
  };

  useEffect(() => {
    if (viewMode !== 'panel') return;
    if (viewOrder && filteredOrders.some((order) => order.id === viewOrder.id)) return;
    setViewOrder(filteredOrders[0] || null);
  }, [viewMode, filteredOrders, viewOrder]);

  const renderItemComparison = (item: any, order: any) => {
    const offers = [...(item.comparisons || [])].sort((first: any, second: any) => {
      const availabilityDifference = Number(first.availability === false) - Number(second.availability === false);
      if (availabilityDifference !== 0) return availabilityDifference;
      if (first.price !== second.price) return first.price - second.price;
      return Number(first.deliveryDays ?? Number.POSITIVE_INFINITY) - Number(second.deliveryDays ?? Number.POSITIVE_INFINITY);
    });
    const recommendation = getOfferRecommendation(offers.map((offer: any) => ({
      supplier_id: offer.supplierId,
      price: offer.price,
      delivery_days: offer.deliveryDays,
      availability: offer.availability,
    })));
    const potentialSavings = recommendation ? Math.max(0, Number(item.price || 0) - recommendation.bestPrice) : 0;

    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Scale size={14} className="text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">Comparação de fornecedores</p>
          </div>
          {potentialSavings > 0 && <span className="rounded bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800">Economia possível: R$ {potentialSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
        </div>
        {offers.length === 0 ? (
          <p className="px-3 py-4 text-xs font-semibold text-slate-500">As propostas originais não estão disponíveis para comparação.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {offers.map((offer: any) => {
              const isChosen = offer.supplierId === order.supplierId;
              const isRecommended = !!recommendation?.supplierIds.includes(offer.supplierId);
              const difference = recommendation ? Math.max(0, offer.price - recommendation.bestPrice) : 0;
              const recommendationLabel = recommendation?.technicalTie
                ? 'Empate técnico'
                : recommendation?.reason === 'fastest-delivery' ? 'Melhor prazo' : 'Melhor opção';
              return (
                <div key={offer.supplierId} className={`grid grid-cols-[minmax(0,1fr)_74px_88px] items-center gap-2 px-3 py-2.5 ${isChosen ? 'bg-blue-50' : isRecommended ? 'bg-emerald-50/70' : offer.availability === false ? 'bg-slate-50 opacity-70' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-black text-slate-900">{offer.supplierName}</p>
                      {isChosen && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Nesta OC</span>}
                      {isRecommended && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-800">{recommendationLabel}</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{offer.supplierCity || 'Local não informado'}{difference > 0 ? ` • + R$ ${difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400">Prazo</p>
                    <p className={`text-xs font-bold ${offer.availability === false ? 'text-red-600' : 'text-slate-700'}`}>{offer.availability === false ? 'Indisponível' : offer.deliveryDays != null ? `${offer.deliveryDays} dia(s)` : 'Não informado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-slate-400">Unitário</p>
                    <p className={`text-sm font-black ${isRecommended ? 'text-emerald-700' : 'text-slate-900'}`}>R$ {Number(offer.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPanelDetails = (order: any) => (
    <div className="app-panel flex min-h-[560px] flex-col overflow-hidden xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Compra selecionada</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">{order.code}</h3>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{order.supplierName}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-black uppercase ${getStatusClass(order.status)}`}>{order.status}</span>
            <p className="mt-2 text-xl font-black text-slate-900">R$ {Number(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
          <div><p className="text-[8px] font-black uppercase text-slate-400">Cliente</p><p className="mt-1 font-bold text-slate-800">{order.customerName}</p></div>
          <div><p className="text-[8px] font-black uppercase text-slate-400">Sinistro</p><p className="mt-1 font-bold text-slate-800">{order.eventProtocol || 'Não vinculado'}</p></div>
          <div><p className="text-[8px] font-black uppercase text-slate-400">Cotação</p><p className="mt-1 font-bold text-slate-800">{order.quotationCode || 'Não vinculada'}</p></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-900">Itens e propostas comparadas</h4>
          <span className="text-xs font-bold text-slate-500">{order.items?.length || 0} item(ns)</span>
        </div>
        <div className="space-y-4">
          {order.items?.map((item: any, index: number) => (
            <article key={`${item.quotation_item_id || item.name}-${index}`} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase text-blue-600">Item {index + 1}</p>
                  <h5 className="mt-1 text-sm font-black text-slate-900">{item.name}</h5>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.quantity} {item.unit || 'un.'}</p>
                </div>
                <p className="whitespace-nowrap text-base font-black text-slate-900">R$ {Number(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              {renderItemComparison(item, order)}
            </article>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 py-4">
        <button type="button" onClick={() => handlePrintEnhanced(order)} className="app-btn-secondary flex items-center justify-center gap-2"><Printer size={15}/> Imprimir</button>
        {order.status === 'Gerada' && canApprove ? (
          <button type="button" onClick={() => handleRequestApprove(order)} className="app-btn-primary flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"><ShieldCheck size={15}/> Aprovar</button>
        ) : order.status === 'Recebida' && canCancel ? (
          <button type="button" onClick={() => handleRequestReturn(order)} className="app-btn-primary flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700"><RotateCcw size={15}/> Devolver</button>
        ) : (
          <button type="button" onClick={() => openHistory(order)} className="app-btn-primary flex items-center justify-center gap-2"><History size={15}/> Histórico</button>
        )}
      </div>
    </div>
  );

  if (loading) return <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600" size={32}/></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
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
      <div className="flex justify-between items-center sr-only">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Ordens de Compra</h2>
          <p className="text-sm text-slate-500">Organizadas por associado e sinistro, com as OCs e cotações dentro de cada caso.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="app-toolbar flex-col md:flex-row">
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
            {['Todos', 'Gerada', 'Aprovada', 'Recebida', 'Cancelada', 'Devolvida'].map(st => (
                <button key={st} onClick={() => setFilterStatus(st)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterStatus === st ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{st}</button>
            ))}
        </div>
        <ViewModeSwitch value={viewMode} onChange={changeViewMode} modes={['list', 'cards', 'panel']} />
      </div>

      <div className="app-kpi-grid app-kpi-grid--compact">
        <div className="app-kpi">
          <p className="text-[9px] font-black uppercase text-slate-400">Valor ativo em compras</p>
          <p className="mt-1 text-xl font-black text-slate-900">R$ {purchaseFinancialStats.activeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">Não inclui cancelamentos e devoluções</p>
        </div>
        <div className="app-kpi">
          <p className="text-[9px] font-black uppercase text-slate-400">OCs canceladas</p>
          <p className="mt-1 text-xl font-black text-red-700">{purchaseFinancialStats.cancelledCount}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">{purchaseFinancialStats.returnedCount} devolvida(s)</p>
        </div>
        <div className="app-kpi">
          <p className="text-[9px] font-black uppercase text-slate-400">Cotações reabertas</p>
          <p className="mt-1 text-xl font-black text-amber-700">{purchaseFinancialStats.affectedQuotations}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">Itens liberados para nova compra</p>
        </div>
        <div className="app-kpi">
          <p className="text-[9px] font-black uppercase text-slate-400">Valor estornado / devolvido</p>
          <p className="mt-1 text-xl font-black text-emerald-700">R$ {purchaseFinancialStats.reversedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">Retirado dos indicadores financeiros</p>
        </div>
      </div>

      {/* Lista */}
      {viewMode === 'panel' ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(360px,0.78fr)_minmax(600px,1.22fr)]">
          <div className="app-panel overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Compras do período</p>
              <p className="mt-1 text-sm font-bold text-slate-800">Selecione uma OC para comparar os itens</p>
            </div>
            {groupedOrders.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm font-bold text-slate-400">Nenhuma compra encontrada.</div>
            ) : (
              <div className="max-h-[calc(100vh-15rem)] overflow-y-auto">
                {groupedOrders.map((group) => (
                  <section key={group.id} className="border-b border-slate-200 last:border-b-0">
                    <div className="bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-slate-900">{group.customerName}</h3>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{group.eventProtocol}{group.vehicleLabel ? ` • ${group.vehicleLabel}` : ''}</p>
                        </div>
                        <span className="shrink-0 rounded bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-500">{group.orders.length} OC(s)</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.orders.map((order: any) => {
                        const selected = viewOrder?.id === order.id;
                        return (
                          <button key={order.id} type="button" onClick={() => setViewOrder(order)} className={`grid w-full grid-cols-[minmax(0,1fr)_90px_28px] items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-blue-50 shadow-[inset_3px_0_0_#2563eb]' : 'bg-white hover:bg-slate-50'}`}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-slate-900">{order.code}</p>
                                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase ${getStatusClass(order.status)}`}>{order.status}</span>
                              </div>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-500">{order.supplierName}</p>
                              <p className="mt-1 text-[10px] font-bold text-slate-400">{order.items.length} item(ns) • {new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black uppercase text-slate-400">Total</p>
                              <p className="mt-1 text-sm font-black text-slate-900">R$ {Number(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <ChevronRight size={17} className={selected ? 'text-blue-600' : 'text-slate-300'} />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          {viewOrder ? renderPanelDetails(viewOrder) : (
            <div className="app-panel flex min-h-[560px] items-center justify-center border-dashed p-8 text-center">
              <div><Scale className="mx-auto text-slate-300" size={32}/><p className="mt-3 text-sm font-bold text-slate-500">Selecione uma compra para abrir a comparação.</p></div>
            </div>
          )}
        </div>
      ) : (
      <div className={viewMode === 'cards' ? 'grid grid-cols-1 2xl:grid-cols-2 gap-4' : 'space-y-4'}>
        {groupedOrders.length === 0 ? (
            <div className="app-panel py-16 text-center border-dashed">
                <ShoppingCart className="mx-auto text-slate-300 mb-2" size={40}/>
                <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhuma compra encontrada</p>
            </div>
        ) : (
            groupedOrders.map(group => (
                <div key={group.id} className="app-panel hover:border-blue-200 transition-all overflow-hidden">
                    <button type="button" onClick={() => toggleGroup(group.id)} className="w-full px-5 py-4 text-left">
                        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-5">
                            <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-blue-50 text-blue-600">
                                <User size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h3 className="text-base font-bold text-slate-800">{group.customerName}</h3>
                                    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{group.orders.length} OC(s)</span>
                                    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600">{group.quotations.size || 1} cotação(ões)</span>
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
                                    <p className="text-lg font-bold text-slate-800 leading-none">R$ {group.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                    {group.reversedTotal > 0 && <p className="mt-1 text-[10px] font-bold text-red-600">R$ {group.reversedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} revertidos</p>}
                                </div>
                                <div className="text-left xl:text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens</p>
                                    <p className="text-lg font-black text-slate-700">{group.itemCount}</p>
                                </div>
                                <div className="px-3 py-2 rounded-md border border-slate-200 bg-white text-xs font-bold text-blue-600">
                                    {expandedGroups[group.id] ? 'Fechar' : 'Abrir'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {expandedGroups[group.id] && (
                        <div className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {group.orders.map((order: any) => (
                                <div
                                  key={order.id}
                                  onClick={() => setViewOrder(order)}
                                  className={`cursor-pointer rounded-md border p-4 transition-colors ${viewOrder?.id === order.id ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-blue-200 hover:bg-blue-50/30'}`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-white text-blue-600 border border-slate-100">
                                                {order.status === 'Cancelada' || order.status === 'Devolvida' ? <XCircle className={order.status === 'Devolvida' ? 'text-amber-500' : 'text-red-400'}/> : <ShoppingCart/>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="text-base font-black text-slate-800">{order.code}</h4>
                                                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${getStatusClass(order.status)}`}>{order.status}</span>
                                                    {order.quotationCode && <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-white text-blue-600 border-blue-100">{order.quotationCode}</span>}
                                                    {order.deliveryStatus === 'Divergente' && (
                                                        <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border bg-red-50 text-red-700 border-red-200">
                                                            Entrega divergente
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs text-slate-500 font-bold">
                                                    <span className="flex items-center gap-1 text-slate-700 truncate max-w-[260px]"><Truck size={12} className="text-blue-400"/> {order.supplierName}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>Feita por {order.createdByName}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>{order.items.length} itens</span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {order.quotationStatus && (
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${getQuotationStatusClass(order.quotationStatus)}`}>
                                                            Status da cotação: {order.quotationStatus}
                                                        </p>
                                                    )}
                                                    {order.deliveryStatus === 'Divergente' && (
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                                                            Ação necessária: tratar divergência da entrega
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between lg:justify-end gap-4">
                                            <div className="text-left lg:text-right min-w-[140px]">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valor da OC</p>
                                                <p className="text-xl font-black text-slate-800 leading-none">R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                            </div>

                                            <div className="flex gap-2 flex-shrink-0" onClick={event => event.stopPropagation()}>
                                                {order.status === 'Gerada' && canApprove && (
                                                    <button onClick={() => handleRequestApprove(order)} className="bg-green-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center gap-2" title="Aprovar por escrito">
                                                        <ShieldCheck size={16}/> Aprovar
                                                    </button>
                                                )}
                                                {order.deliveryStatus === 'Divergente' && (
                                                    <button onClick={() => handleResolveDivergence(order)} className="bg-red-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center gap-2" title="Tratar divergência">
                                                        <AlertTriangle size={16}/>
                                                    </button>
                                                )}
                                                <button onClick={() => openHistory(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl hover:border-indigo-200 transition-all shadow-sm" title="Histórico / Auditoria"><History size={18}/></button>
                                                <button onClick={() => setViewOrder(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm" title="Ver Detalhes"><Eye size={18}/></button>
                                                <button onClick={() => handlePrintEnhanced(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm hidden sm:block" title="Imprimir OC em lista"><Printer size={18}/></button>
                                                <div className="relative">
                                                    <button onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"><MoreVertical size={18}/></button>
                                                    {openMenuId === order.id && (
                                                        <div className="absolute right-0 bottom-full lg:bottom-auto lg:top-full mb-2 lg:mb-0 lg:mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in duration-200">
                                                            {!['Cancelada', 'Devolvida', 'Recebida'].includes(order.status) && canCancel && <button onClick={() => handleRequestCancel(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-amber-600 hover:bg-amber-50 border-b border-slate-50">Cancelar OC e estornar</button>}
                                                            {order.status === 'Recebida' && canCancel && <button onClick={() => handleRequestReturn(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-amber-700 hover:bg-amber-50 border-b border-slate-50">Registrar devolução</button>}
                                                            <button onClick={() => openHistory(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border-b border-slate-50">Histórico / Auditoria</button>
                                                            {order.deliveryStatus === 'Divergente' && <button onClick={() => handleResolveDivergence(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 border-b border-slate-50">Tratar divergência</button>}
                                                            <button onClick={() => { setOpenMenuId(null); handlePrintEnhanced(order, 'landscape'); }} className="w-full text-left px-4 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 border-b border-slate-50">Visualizar paisagem</button>
                                                            {canDelete && <button onClick={() => handleRequestDelete(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50">Excluir Registro</button>}
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
      )}

      {/* Painel lateral de itens da compra */}
      {viewOrder && viewMode !== 'panel' && (
        <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="purchase-drawer-title">
            <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setViewOrder(null)}></div>
            <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-600">Detalhes da compra</p>
                        <h3 id="purchase-drawer-title" className="truncate text-xl font-black text-slate-900">{viewOrder.code}</h3>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{viewOrder.supplierName}</p>
                      </div>
                      <button type="button" onClick={() => setViewOrder(null)} className="app-icon-button shrink-0" aria-label="Fechar detalhes da compra"><X size={19}/></button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Status</p>
                        <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase ${getStatusClass(viewOrder.status)}`}>{viewOrder.status}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sinistro</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{viewOrder.eventProtocol || 'Não vinculado'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Data da compra</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{new Date(viewOrder.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                </div>

                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cliente / veículo</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{viewOrder.customerName}</p>
                  {viewOrder.vehicleLabel && <p className="mt-1 text-xs font-semibold text-slate-500">{viewOrder.vehicleLabel}</p>}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Itens separados</p>
                        <h4 className="mt-1 text-base font-black text-slate-900">{viewOrder.items?.length || 0} item(ns) nesta compra</h4>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">Cotação {viewOrder.quotationCode || 'não vinculada'}</p>
                    </div>

                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                      {viewOrder.items?.map((item: any, idx: number) => (
                        <article key={`${item.quotation_item_id || item.name}-${idx}`} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 py-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700">{idx + 1}</div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h5 className="text-sm font-black text-slate-900">{item.name}</h5>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{item.quantity} {item.unit || 'un.'} × R$ {Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                              <p className="whitespace-nowrap text-base font-black text-slate-900">R$ {Number(item.total || (item.price * item.quantity) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600">Item {idx + 1} de {viewOrder.items.length}</span>
                              {item.repurchaseRelease && <span className="rounded-md bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-800">Recompra liberada</span>}
                            </div>
                            {item.repurchaseRelease?.reason && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Motivo: {item.repurchaseRelease.reason}</p>}
                            {renderItemComparison(item, viewOrder)}
                          </div>
                        </article>
                      ))}
                    </div>
                </div>

                <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total da OC</p>
                      <p className="text-2xl font-black text-slate-900">R$ {Number(viewOrder.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`grid grid-cols-1 gap-2 ${viewOrder.status === 'Recebida' && canCancel ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                      <button onClick={() => handlePrintEnhanced(viewOrder)} className="app-btn-primary flex min-h-10 items-center justify-center gap-2"><Printer size={15}/> Imprimir lista</button>
                      <button onClick={() => handlePrintEnhanced(viewOrder, 'landscape')} className="app-btn-secondary flex min-h-10 items-center justify-center gap-2"><Printer size={15}/> Imprimir paisagem</button>
                      {viewOrder.status === 'Recebida' && canCancel && <button onClick={() => handleRequestReturn(viewOrder)} className="app-btn-secondary flex min-h-10 items-center justify-center gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"><RotateCcw size={15}/> Devolver</button>}
                    </div>
                </div>
            </aside>
        </div>
      )}

      {historyModal.order && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setHistoryModal({ order: null, entries: [], loading: false })} />
          <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ClipboardList size={20}/></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Auditoria da OC</h3>
                  <p className="text-xs font-bold text-slate-500">{historyModal.order.code}</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal({ order: null, entries: [], loading: false })}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {historyModal.loading ? (
                <div className="py-16 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={28}/></div>
              ) : historyModal.entries.length === 0 ? (
                <p className="text-center text-sm font-bold text-slate-400 py-12">Nenhum evento registrado ainda.</p>
              ) : (
                <div className="space-y-4">
                  {historyModal.entries.map((entry) => (
                    <div key={entry.id} className="relative pl-6 border-l-2 border-indigo-100">
                      <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-indigo-500" />
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-black uppercase tracking-widest text-indigo-700">{getActionLabel(entry.action)}</span>
                          <span className="text-[10px] font-mono text-slate-400">{new Date(entry.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        {(entry.from_status || entry.to_status) && (
                          <p className="text-xs font-bold text-slate-600 mb-1">
                            Status: {entry.from_status || '—'} → {entry.to_status || '—'}
                          </p>
                        )}
                        {entry.comment && <p className="text-xs text-slate-600 mt-2 bg-white p-3 rounded-xl border border-slate-100">{entry.comment}</p>}
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">Por: {entry.user_name || 'Sistema'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in zoom-in">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmModal.type === 'approve' ? 'bg-green-50 text-green-500' : confirmModal.type === 'return' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
              {confirmModal.type === 'approve' ? <ShieldCheck size={40} /> : confirmModal.type === 'return' ? <RotateCcw size={40} /> : <AlertTriangle size={40} />}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {confirmModal.type === 'approve' ? 'Aprovar ordem de compra' : confirmModal.type === 'return' ? 'Registrar devolução total' : 'Confirmar ação?'}
            </h3>
            {confirmModal.type === 'approve' && (
              <div className="mt-4 text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Observação da aprovação (opcional)</label>
                <textarea
                  className="w-full min-h-[110px] p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none resize-none"
                  placeholder="Registre uma observação para a auditoria, se necessário..."
                  value={confirmModal.approvalNote || ''}
                  onChange={(e) => setConfirmModal({ ...confirmModal, approvalNote: e.target.value })}
                />
              </div>
            )}
            {confirmModal.type === 'cancel' && (
              <div className="mt-4 p-4 rounded-2xl border border-amber-100 bg-amber-50 text-left">
                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  Ao cancelar, R$ {Number(confirmModal.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} serão estornados dos indicadores. Os itens voltam para a matriz como liberados para nova compra, mantendo todo o histórico.
                </p>
              </div>
            )}
            {confirmModal.type === 'return' && (
              <div className="mt-4 text-left">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold leading-relaxed text-amber-900">
                    A devolução retirará R$ {Number(confirmModal.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do caixa gerencial e dos KPIs. Os itens voltarão para nova cotação e compra, com histórico preservado.
                  </p>
                </div>
                <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da devolução (opcional)</label>
                <textarea
                  className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 outline-none focus:border-amber-400"
                  placeholder="Ex.: peça incompatível, avaria ou troca de fornecedor..."
                  value={confirmModal.approvalNote || ''}
                  onChange={(event) => setConfirmModal({ ...confirmModal, approvalNote: event.target.value })}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false, approvalNote: '' })} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Voltar</button>
              <button onClick={executeAction} className={`py-3 text-white rounded-2xl font-black text-xs uppercase ${confirmModal.type === 'approve' ? 'bg-green-600' : confirmModal.type === 'return' ? 'bg-amber-600' : 'bg-red-500'}`}>{confirmModal.type === 'return' ? 'Registrar devolução' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;


