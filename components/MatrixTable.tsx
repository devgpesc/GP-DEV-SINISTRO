import React, { useEffect, useMemo, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Edit2,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { quotationService, ManualPurchaseSelection } from '../services/quotationService';
import { QuotationItem, Supplier, SupplierPrice } from '../types';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import { openMatrixPrintPreview } from '../utils/matrixPrint';
import { formatDateTimeBr, formatVehicleLabel } from '../utils/vehicleLabel';
import * as XLSX from 'xlsx';

interface MatrixProps {
  quotationId?: string;
  eventId?: string;
}

interface EditingCell {
  itemId: string;
  supplierId: string;
}

const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const MatrixTable: React.FC<MatrixProps> = ({ quotationId, eventId }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatingSim, setGeneratingSim] = useState(false);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [processedItemIds, setProcessedItemIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, ManualPurchaseSelection>>({});
  const [filterText, setFilterText] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterVersion, setFilterVersion] = useState('Todas as versões');
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editDeliveryDays, setEditDeliveryDays] = useState('');
  const [editAvailability, setEditAvailability] = useState(true);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [releasingItemId, setReleasingItemId] = useState<string | null>(null);
  const [releaseModalItem, setReleaseModalItem] = useState<QuotationItem | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<string[]>([]);
  const [headerMeta, setHeaderMeta] = useState<{
    quotationCode?: string;
    eventProtocol?: string;
    associateName?: string;
    vehicleLabel?: string;
    participationQuota?: number | null;
    createdAt?: string;
    eventOpenedAt?: string;
    eventStatus?: string;
  } | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  useEffect(() => {
    if (quotationId) loadData();
  }, [quotationId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, filterStatus, filterSupplier, filterVersion, itemsPerPage]);

  const loadData = async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
      const data = await quotationService.getMatrixData(quotationId);
      setItems(data.items);
      setSuppliers(data.suppliers);
      setPrices(data.prices);
      setProcessedItemIds(data.processedItemIds);

      const persistedSelections: Record<string, ManualPurchaseSelection> = {};
      data.selections
        .filter((selection) => selection.status === 'Selecionado')
        .filter((selection) => !data.processedItemIds.includes(selection.quotation_item_id))
        .forEach((selection) => {
          persistedSelections[selection.quotation_item_id] = {
            supplierId: selection.supplier_id,
            quantity: selection.quantity,
            justification: selection.justification || '',
          };
        });
      setSelections(persistedSelections);

      const { data: quotationRow } = await supabase
        .from('quotations')
        .select('id, code, eventRef, eventId, created_at, participation_quota')
        .eq('id', quotationId)
        .maybeSingle();

      const eventRefId = eventId || quotationRow?.eventId || null;
      let associateName = '';
      let vehicleLabel = '';
      let eventProtocol = quotationRow?.eventRef || '';
      let eventParticipationQuota: number | null = null;
      let eventOpenedAt = '';
      let eventStatus = '';

      if (eventRefId) {
        const { data: eventRow } = await supabase
          .from('events')
          .select('id, protocol, associateId, vehicleId, participation_quota, created_at, status')
          .eq('id', eventRefId)
          .maybeSingle();

        if (eventRow) {
          eventProtocol = eventRow.protocol || eventProtocol;
          eventParticipationQuota = eventRow.participation_quota ?? null;
          eventOpenedAt = formatDateTimeBr(eventRow.created_at);
          eventStatus = eventRow.status || '';

          const [{ data: associateRow }, { data: vehicleRow }] = await Promise.all([
            eventRow.associateId ? supabase.from('associates').select('name').eq('id', eventRow.associateId).maybeSingle() : Promise.resolve({ data: null as any }),
            eventRow.vehicleId ? supabase.from('vehicles').select('brand, model, plate, year_fab, year_model').eq('id', eventRow.vehicleId).maybeSingle() : Promise.resolve({ data: null as any }),
          ]);

          associateName = associateRow?.name || '';
          if (vehicleRow) {
            vehicleLabel = formatVehicleLabel(vehicleRow);
          }
        }
      }

      setHeaderMeta({
        quotationCode: quotationRow?.code || undefined,
        eventProtocol: eventProtocol || undefined,
        associateName: associateName || undefined,
        vehicleLabel: vehicleLabel || undefined,
        participationQuota: quotationRow?.participation_quota ?? eventParticipationQuota,
        createdAt: quotationRow?.created_at || undefined,
        eventOpenedAt: eventOpenedAt || undefined,
        eventStatus: eventStatus || undefined,
      });
    } catch (error) {
      console.error('Erro Matrix:', error);
      addToast('error', 'Erro ao carregar matriz', 'Nao foi possivel buscar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!quotationId) return;
    setGeneratingSim(true);
    try {
      await quotationService.simulateSupplierResponses(quotationId);
      await loadData();
      addToast('success', 'Simulacao concluida', 'Precos ficticios gerados para teste.');
    } catch {
      addToast('error', 'Erro', 'Falha na simulacao.');
    } finally {
      setGeneratingSim(false);
    }
  };

  const startEditing = (itemId: string, supplierId: string, currentPrice?: SupplierPrice) => {
    setEditingCell({ itemId, supplierId });
    setEditPrice(currentPrice?.price ? String(currentPrice.price) : '');
    setEditObs(currentPrice?.obs || '');
    setEditDeliveryDays(currentPrice?.delivery_days ? String(currentPrice.delivery_days) : '');
    setEditAvailability(currentPrice?.availability ?? true);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditPrice('');
    setEditObs('');
    setEditDeliveryDays('');
    setEditAvailability(true);
  };

  const saveManualPrice = async () => {
    if (!editingCell || !quotationId) return;
    const priceValue = Number(editPrice.replace(',', '.'));
    const deliveryDays = editDeliveryDays ? Number(editDeliveryDays) : null;

    if (!priceValue || priceValue < 0) {
      addToast('warning', 'Valor invalido', 'Insira um preco valido.');
      return;
    }

    setIsSavingPrice(true);
    try {
      await quotationService.savePrice({
        quotation_item_id: editingCell.itemId,
        supplier_id: editingCell.supplierId,
        price: priceValue,
        obs: editObs,
        availability: editAvailability,
        delivery_days: deliveryDays,
      });
      await loadData();
      cancelEditing();
      addToast('success', 'Preco lancado', 'Valor atualizado na matriz.');
    } catch (error: any) {
      addToast('error', 'Erro ao salvar', error.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  const bestPriceByItem = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      const itemPrices = prices.filter((price) => price.quotation_item_id === item.id && price.availability !== false);
      if (itemPrices.length > 0) map[item.id] = Math.min(...itemPrices.map((price) => price.price));
    });
    return map;
  }, [items, prices]);

  const selectForPurchase = async (item: QuotationItem, supplier: Supplier, price: SupplierPrice) => {
    if (!quotationId) return;
    if (processedItemIds.includes(item.id)) {
      addToast('warning', 'Item ja processado', 'Este item ja gerou compra e nao pode ser selecionado novamente.');
      return;
    }

    const existing = selections[item.id];
    const isSameSupplier = existing?.supplierId === supplier.id;
    if (isSameSupplier) {
      const nextSelections = { ...selections };
      delete nextSelections[item.id];
      setSelections(nextSelections);
      await quotationService.removePurchaseSelection(quotationId, item.id);
      return;
    }

    const isNotBestPrice = bestPriceByItem[item.id] !== undefined && price.price > bestPriceByItem[item.id];
    const nextSelection: ManualPurchaseSelection = {
      supplierId: supplier.id,
      quantity: item.quantity || 1,
      justification: isNotBestPrice ? existing?.justification || '' : existing?.justification || '',
    };

    setSelections((previous) => ({ ...previous, [item.id]: nextSelection }));
    await quotationService.savePurchaseSelection(quotationId, item, price, nextSelection);
  };

  const updateSelection = async (item: QuotationItem, changes: Partial<ManualPurchaseSelection>) => {
    if (!quotationId) return;
    const current = selections[item.id];
    if (!current) return;
    const price = prices.find((candidate) => candidate.quotation_item_id === item.id && candidate.supplier_id === current.supplierId);
    if (!price) return;

    const updated = { ...current, ...changes };
    setSelections((previous) => ({ ...previous, [item.id]: updated }));
    await quotationService.savePurchaseSelection(quotationId, item, price, updated);
  };

  const clearSelection = async () => {
    if (!quotationId) return;
    await Promise.all(Object.keys(selections).map((itemId) => quotationService.removePurchaseSelection(quotationId, itemId)));
    setSelections({});
  };

  const openReleaseModal = (item: QuotationItem) => {
    setReleaseModalItem(item);
    setReleaseReason('');
  };

  const closeReleaseModal = () => {
    setReleaseModalItem(null);
    setReleaseReason('');
  };

  const releaseForRepurchase = async () => {
    if (!quotationId || !releaseModalItem) return;
    const reason = releaseReason.trim();
    if (!reason) {
      addToast('warning', 'Motivo obrigatório', 'A liberação exige justificativa.');
      return;
    }

    setReleasingItemId(releaseModalItem.id);
    try {
      await quotationService.releaseItemForRepurchase(quotationId, releaseModalItem.id, reason);
      addToast('success', 'Item liberado', 'O item voltou para compra com histórico da justificativa.');
      closeReleaseModal();
      await loadData();
    } catch (error: any) {
      addToast('error', 'Erro ao liberar', error.message || 'Não foi possível liberar item para recompra.');
    } finally {
      setReleasingItemId(null);
    }
  };

  const activeSelections = useMemo(() => {
    const next: Record<string, ManualPurchaseSelection> = {};
    Object.entries(selections).forEach(([itemId, selection]) => {
      if (!processedItemIds.includes(itemId)) next[itemId] = selection;
    });
    return next;
  }, [selections, processedItemIds]);

  const selectedGroups = useMemo(() => {
    const groups: Record<string, { supplier: Supplier; rows: Array<{ item: QuotationItem; price: SupplierPrice; selection: ManualPurchaseSelection }>; total: number }> = {};
    Object.entries(activeSelections).forEach(([itemId, selection]) => {
      const item = items.find((candidate) => candidate.id === itemId);
      const supplier = suppliers.find((candidate) => candidate.id === selection.supplierId);
      const price = prices.find((candidate) => candidate.quotation_item_id === itemId && candidate.supplier_id === selection.supplierId);
      if (!item || !supplier || !price) return;

      if (!groups[supplier.id]) groups[supplier.id] = { supplier, rows: [], total: 0 };
      groups[supplier.id].rows.push({ item, price, selection });
      groups[supplier.id].total += price.price * (selection.quantity || item.quantity || 1);
    });
    return Object.values(groups);
  }, [items, suppliers, prices, activeSelections]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const quotedItems = items.filter((item) => prices.some((price) => price.quotation_item_id === item.id)).length;
    const selectedItems = Object.keys(activeSelections).length;
    const selectedTotal = selectedGroups.reduce((sum, group) => sum + group.total, 0);
    const avgItemValue = selectedItems > 0 ? selectedTotal / selectedItems : 0;
    const coverage = totalItems > 0 ? (quotedItems / totalItems) * 100 : 0;
    return { totalItems, quotedItems, selectedItems, selectedTotal, avgItemValue, coverage, responsesCount: prices.length };
  }, [items, prices, activeSelections, selectedGroups]);

  const versionOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item: any) => {
      const raw = item.complement || item.version || item.variant;
      if (raw) values.add(String(raw));
    });
    return ['Todas as versões', ...Array.from(values)];
  }, [items]);

  const filteredItems = items.filter((item: any) => {
    const matchesText = item.name.toLowerCase().includes(filterText.toLowerCase());
    const hasPrice = prices.some((price) => price.quotation_item_id === item.id);
    const complement = item.complement || item.version || item.variant || '';
    const matchesVersion = filterVersion === 'Todas as versões' || String(complement) === filterVersion;
    if (!matchesVersion) return false;
    if (filterStatus === 'Sem Cotacao') return matchesText && !hasPrice;
    if (filterStatus === 'Cotado') return matchesText && hasPrice;
    if (filterStatus === 'Selecionado') return matchesText && !!activeSelections[item.id];
    if (filterStatus === 'Processado') return matchesText && processedItemIds.includes(item.id);
    return matchesText;
  });

  const filteredSuppliers = suppliers.filter((supplier) => !filterSupplier || supplier.id === filterSupplier);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleProcessPurchase = async () => {
    if (!quotationId) return;
    if (Object.keys(activeSelections).length === 0) {
      addToast('warning', 'Selecao vazia', 'Selecione manualmente pelo menos um item para compra.');
      return;
    }

    const invalid = Object.entries(activeSelections).find(([itemId, selection]) => {
      const item = items.find((candidate) => candidate.id === itemId);
      const price = prices.find((candidate) => candidate.quotation_item_id === itemId && candidate.supplier_id === selection.supplierId);
      return !item || !selection.supplierId || !selection.quantity || !price;
    });

    if (invalid) {
      addToast('warning', 'Selecao incompleta', 'Revise fornecedor, valor e quantidade dos itens selecionados.');
      return;
    }

    setIsSubmitting(true);
    try {
      await quotationService.processPurchase(quotationId, activeSelections, eventId);
      setSelections({});
      addToast('success', 'Compras enviadas', 'As OCs foram geradas para aprovacao da gestao.');
      navigate('/compras');
    } catch (error: any) {
      addToast('error', 'Erro no processamento', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPrintPreview = (layout: 'landscape' | 'list') => {
    if (!headerMeta) return;
    openMatrixPrintPreview({
      headerMeta: {
        quotationCode: headerMeta.quotationCode,
        eventProtocol: headerMeta.eventProtocol,
        associateName: headerMeta.associateName,
        vehicleLabel: headerMeta.vehicleLabel,
        participationQuota: headerMeta.participationQuota,
        eventOpenedAt: headerMeta.eventOpenedAt,
        quotationCreatedAt: formatDateTimeBr(headerMeta.createdAt),
        eventStatus: headerMeta.eventStatus,
      },
      items: filteredItems.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit })),
      suppliers: filteredSuppliers.map(s => ({ id: s.id, name: s.name, city: s.city })),
      prices: prices.map(p => ({
        quotation_item_id: p.quotation_item_id,
        supplier_id: p.supplier_id,
        price: p.price,
        delivery_days: p.delivery_days,
        availability: p.availability,
      })),
      layout,
    });
    setPrintMenuOpen(false);
  };

  const exportCsv = () => {
    const headers = ['Item', 'Qtd', 'Fornecedor', 'Valor', 'Prazo', 'Disponivel', 'Selecionado', 'Justificativa'];
    const rows = items.flatMap((item) => suppliers.map((supplier) => {
      const price = prices.find((candidate) => candidate.quotation_item_id === item.id && candidate.supplier_id === supplier.id);
      const selection = selections[item.id];
      return [
        item.name,
        item.quantity,
        supplier.name,
        price?.price ?? '',
        price?.delivery_days ?? '',
        price ? (price.availability === false ? 'Nao' : 'Sim') : '',
        selection?.supplierId === supplier.id ? 'Sim' : 'Nao',
        selection?.supplierId === supplier.id ? selection.justification || '' : '',
      ];
    }));
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matriz-cotacao-${quotationId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const rows = items.flatMap((item: any) => suppliers.map((supplier) => {
      const price = prices.find((candidate) => candidate.quotation_item_id === item.id && candidate.supplier_id === supplier.id);
      const selection = selections[item.id];
      return {
        Item: item.name,
        Quantidade: item.quantity,
        Unidade: item.unit,
        VersaoComplemento: item.complement || item.version || item.variant || '',
        Fornecedor: supplier.name,
        Valor: price?.price ?? '',
        PrazoDias: price?.delivery_days ?? '',
        Disponivel: price ? (price.availability === false ? 'Não' : 'Sim') : '',
        Selecionado: selection?.supplierId === supplier.id ? 'Sim' : 'Não',
        Justificativa: selection?.supplierId === supplier.id ? selection.justification || '' : '',
      };
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MatrizCotacao');
    XLSX.writeFile(wb, `matriz-cotacao-${quotationId}.xlsx`);
  };

  const toggleSupplierDetails = (supplierId: string) => {
    setExpandedSupplierIds((prev) => prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]);
  };

  if (loading) {
    return <div className="py-20 text-center flex flex-col items-center"><Loader2 className="animate-spin mb-4 text-blue-600" size={32} /><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Montando matriz de cotacao...</p></div>;
  }

  if (items.length === 0) {
    return <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">Nenhum item nesta cotacao.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 print:p-0">
      <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl text-amber-900 print:hidden">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="mt-0.5" />
          <div>
            <p className="font-black text-sm uppercase tracking-widest">Decisao de compra manual</p>
            <p className="text-sm font-medium">O menor preco e apenas destacado. O sistema nao seleciona fornecedor automaticamente. Clique no valor desejado para escolher onde comprar cada item.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pré-Orçamento</p>
            <p className="font-black text-slate-800">{headerMeta?.quotationCode || quotationId}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Protocolo</p>
            <p className="font-black text-slate-800">{headerMeta?.eventProtocol || 'Não vinculado'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Associado</p>
            <p className="font-black text-slate-800">{headerMeta?.associateName || 'Não identificado'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Veículo / Placa</p>
            <p className="font-black text-slate-800">{headerMeta?.vehicleLabel || 'Não identificado'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Abertura sinistro</p>
            <p className="font-black text-slate-800">{headerMeta?.eventOpenedAt || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Data da cotação</p>
            <p className="font-black text-slate-800">{formatDateTimeBr(headerMeta?.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens / Cotados</p>
          <span className="text-2xl font-black text-slate-800">{stats.quotedItems}/{stats.totalItems}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Orcamentos recebidos</p>
          <span className="text-2xl font-black text-slate-800">{stats.responsesCount}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cobertura</p>
          <div className="flex items-center gap-2"><div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${stats.coverage}%` }} /></div><span className="text-xs font-bold text-blue-600">{stats.coverage.toFixed(0)}%</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total selecionado</p>
          <span className="text-2xl font-black text-slate-800">R$ {money(stats.selectedTotal)}</span>
        </div>
      </div>

      {prices.length === 0 && (
        <div className="bg-white border border-amber-100 p-6 rounded-2xl flex justify-between items-center print:hidden">
          <div className="text-amber-800"><p className="font-bold text-sm">Nenhum valor lancado</p><p className="text-xs">Use o lapis nas celulas para inserir valores manualmente.</p></div>
          <button onClick={handleSimulate} disabled={generatingSim} className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-2">
            {generatingSim ? <Loader2 className="animate-spin" size={14} /> : <><RefreshCw size={14} /> Simular teste</>}
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-100 p-2 rounded-2xl print:hidden">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Filtrar itens..." className="pl-9 pr-4 py-2 bg-white rounded-xl text-sm font-medium outline-none w-48" value={filterText} onChange={(event) => setFilterText(event.target.value)} />
          </div>
          <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={filterSupplier} onChange={(event) => setFilterSupplier(event.target.value)}>
            <option value="">Todos fornecedores</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option>Todos</option>
            <option>Cotado</option>
            <option>Sem Cotacao</option>
            <option>Selecionado</option>
            <option>Processado</option>
          </select>
          <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={filterVersion} onChange={(event) => setFilterVersion(event.target.value)}>
            {versionOptions.map((version) => <option key={version} value={version}>{version}</option>)}
          </select>
          <select className="px-4 py-2 bg-white rounded-xl text-sm font-bold text-slate-600 outline-none" value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}>
            {[10, 15, 20, 30, 50].map((qty) => <option key={qty} value={qty}>{qty} itens/página</option>)}
          </select>
        </div>
        <div className="flex gap-2 relative">
          <button onClick={() => setPrintMenuOpen(v => !v)} className="p-2 bg-white text-slate-600 hover:text-blue-600 rounded-xl transition-all shadow-sm" title="Visualizar impressão"><FileText size={18} /></button>
          {printMenuOpen && (
            <div className="absolute right-0 top-full mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 min-w-[180px]">
              <button onClick={() => openPrintPreview('landscape')} className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-blue-50 hover:text-blue-700">Paisagem</button>
              <button onClick={() => openPrintPreview('list')} className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-blue-50 hover:text-blue-700">Lista</button>
            </div>
          )}
          <button onClick={exportCsv} className="p-2 bg-white text-slate-600 hover:text-green-600 rounded-xl transition-all shadow-sm" title="Exportar CSV/Excel"><Download size={18} /></button>
          <button onClick={exportXlsx} className="px-3 py-2 bg-white text-slate-600 hover:text-emerald-700 rounded-xl transition-all shadow-sm text-xs font-black uppercase tracking-wider" title="Exportar XLSX">XLSX</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[32px] border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest min-w-[270px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Item / Qtd</th>
              {filteredSuppliers.map((supplier) => (
                <th key={supplier.id} className="p-6 text-center min-w-[220px]">
                  <span className="font-bold text-slate-800 text-sm">{supplier.name}</span>
                  <p className="text-[10px] text-slate-400 font-bold">{supplier.city || 'Local'}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.map((item) => {
              const isProcessed = processedItemIds.includes(item.id);
              return (
                <tr key={item.id} className={isProcessed ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}>
                  <td className="p-6 sticky left-0 bg-white border-r border-slate-100 z-10 font-bold text-slate-700">
                    <span className="block text-sm">{item.name}</span>
                    <div className="flex gap-2 mt-2 items-center">
                      <span className="text-[10px] text-slate-400 font-black uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{item.quantity} {item.unit}</span>
                      {isProcessed && <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Processado</span>}
                      {activeSelections[item.id] && !isProcessed && <CheckCircle2 size={16} className="text-blue-600" />}
                      {(item as any).item_type === 'Serviço' && <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">Servico</span>}
                    </div>
                    {isProcessed && (
                      <button
                        type="button"
                        onClick={() => openReleaseModal(item)}
                        disabled={releasingItemId === item.id}
                        className="mt-2 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider disabled:opacity-50 print:hidden"
                      >
                        {releasingItemId === item.id ? 'Liberando...' : 'Liberar Recompra'}
                      </button>
                    )}
                  </td>
                  {filteredSuppliers.map((supplier) => {
                    const price = prices.find((candidate) => candidate.quotation_item_id === item.id && candidate.supplier_id === supplier.id);
                    const selected = activeSelections[item.id]?.supplierId === supplier.id;
                    const isBest = !!price && bestPriceByItem[item.id] === price.price;
                    const isEditing = editingCell?.itemId === item.id && editingCell?.supplierId === supplier.id;

                    if (isEditing) {
                      return (
                        <td key={supplier.id} className="p-2 min-w-[220px]">
                          <div className="bg-white border-2 border-blue-500 rounded-2xl p-3 shadow-lg">
                            <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-slate-500">R$</span><input autoFocus type="number" className="w-full font-black text-slate-800 outline-none border-b border-slate-200" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} placeholder="0.00" /></div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input className="text-[10px] font-medium text-slate-500 outline-none bg-slate-50 p-1.5 rounded" placeholder="Prazo dias" value={editDeliveryDays} onChange={(event) => setEditDeliveryDays(event.target.value)} />
                              <label className="text-[10px] font-bold text-slate-500 bg-slate-50 p-1.5 rounded flex items-center gap-1"><input type="checkbox" checked={editAvailability} onChange={(event) => setEditAvailability(event.target.checked)} /> Disp.</label>
                            </div>
                            <input className="w-full text-[10px] font-medium text-slate-500 outline-none bg-slate-50 p-1.5 rounded mb-2" placeholder="Observacao" value={editObs} onChange={(event) => setEditObs(event.target.value)} />
                            <div className="flex justify-end gap-1"><button onClick={cancelEditing} className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><X size={14} /></button><button onClick={saveManualPrice} disabled={isSavingPrice} className="p-1.5 rounded-lg bg-blue-600 text-white">{isSavingPrice ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}</button></div>
                          </div>
                        </td>
                      );
                    }

                    if (!price) {
                      return (
                        <td key={supplier.id} className="p-4 text-center">
                          <button onClick={() => startEditing(item.id, supplier.id)} className="w-full py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-1 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200">
                            <Edit2 size={14} /> Lancar valor
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td key={supplier.id} className="p-3 text-center relative group/cell">
                        <button onClick={(event) => { event.stopPropagation(); startEditing(item.id, supplier.id, price); }} className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-blue-600 rounded-full shadow-sm border border-slate-100 opacity-0 group-hover/cell:opacity-100 transition-opacity z-20"><Edit2 size={12} /></button>
                        <button onClick={() => selectForPurchase(item, supplier, price)} disabled={isProcessed || price.availability === false} className={`w-full py-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${selected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 z-10' : isBest ? 'bg-green-50 border-green-300 text-slate-800 hover:border-blue-500' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                          {isBest && !selected && <span className="absolute -top-3 bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm border border-white">Menor preco</span>}
                          <span className="text-sm font-black"><span className="opacity-50 text-[10px]">R$</span> {money(price.price)}</span>
                          <span className={`text-[9px] font-bold mt-1 uppercase ${selected ? 'text-blue-200' : 'text-slate-400'}`}>Total R$ {money(price.price * (activeSelections[item.id]?.quantity || item.quantity || 1))}</span>
                          <span className={`text-[9px] font-bold mt-1 ${price.availability === false ? 'text-red-400' : selected ? 'text-blue-100' : 'text-slate-400'}`}>{price.availability === false ? 'Indisponivel' : price.delivery_days ? `${price.delivery_days} dia(s)` : 'Prazo nao informado'}</span>
                          {price.obs && <MessageSquare size={10} className={selected ? 'text-blue-300 mt-1' : 'text-slate-300 mt-1'} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs font-bold text-slate-500 print:hidden">
        <span>Mostrando {paginatedItems.length} de {filteredItems.length} item(ns)</span>
        <div className="flex items-center gap-2">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40">Anterior</button>
          <span>Página {currentPage} de {totalPages}</span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40">Próxima</button>
        </div>
      </div>

      {selectedGroups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm p-6 print:break-before-page">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ShoppingCart size={20} className="text-blue-600" /> Itens selecionados para compra</h3>
              <p className="text-xs text-slate-500 font-bold">Revise as escolhas antes de processar. Uma escolha ativa por item.</p>
            </div>
            <button onClick={clearSelection} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase flex items-center gap-2 print:hidden"><Trash2 size={14} /> Limpar selecao</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {selectedGroups.map((group) => (
              <div key={group.supplier.id} className="border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-black text-slate-800">{group.supplier.name}</h4>
                  <span className="font-black text-blue-600">R$ {money(group.total)}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase mb-3">{group.rows.length} item(ns) selecionado(s)</p>
                <button onClick={() => toggleSupplierDetails(group.supplier.id)} className="mb-3 px-3 py-1.5 rounded-lg bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 print:hidden">
                  {expandedSupplierIds.includes(group.supplier.id) ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>
                <div className="space-y-3">
                  {group.rows.map(({ item, price, selection }) => {
                    const isNotBest = bestPriceByItem[item.id] !== undefined && price.price > bestPriceByItem[item.id];
                    const showDetails = expandedSupplierIds.includes(group.supplier.id);
                    return (
                      <div key={item.id} className="bg-slate-50 rounded-xl p-3">
                        <div className="flex justify-between gap-3"><span className="text-sm font-bold text-slate-700">{item.name}</span><span className="text-sm font-black text-slate-800">R$ {money(price.price * selection.quantity)}</span></div>
                        {showDetails && (
                          <p className="mt-1 text-[11px] text-slate-500 font-medium">Unitário: R$ {money(price.price)} • Prazo: {price.delivery_days ? `${price.delivery_days} dia(s)` : 'não informado'} • Disponível: {price.availability === false ? 'Não' : 'Sim'}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 print:hidden">
                          <label className="text-[10px] font-black uppercase text-slate-400">Qtd</label>
                          <input type="number" min={1} value={selection.quantity} onChange={(event) => updateSelection(item, { quantity: Number(event.target.value) })} className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold" />
                        </div>
                        <textarea value={selection.justification || ''} onChange={(event) => updateSelection(item, { justification: event.target.value })} placeholder={isNotBest ? 'Justifique a escolha fora do menor preco...' : 'Observacao/justificativa opcional'} className={`mt-2 w-full p-2 rounded-lg text-xs font-medium border outline-none print:hidden ${isNotBest && !selection.justification ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`} />
                        {isNotBest && <p className="mt-1 text-[10px] text-amber-600 font-bold">Fornecedor escolhido nao e o menor preco. Registre a justificativa.</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between items-center">
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total geral</p><p className="text-2xl font-black text-slate-800">{stats.selectedItems} item(ns) - R$ {money(stats.selectedTotal)}</p></div>
            <button onClick={handleProcessPurchase} disabled={isSubmitting} className="px-8 py-4 bg-green-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-green-600/20 flex items-center gap-3 hover:bg-green-700 disabled:opacity-60 print:hidden">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <><ShoppingCart size={18} /> Processar compras <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {selectedGroups.length === 0 && (
        <div className="flex justify-end pt-2 pb-20 print:hidden">
          <button disabled className="px-8 py-4 bg-slate-200 text-slate-400 rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3"><XCircle size={18} /> Nenhum item selecionado</button>
        </div>
      )}

      {releaseModalItem && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 print:hidden">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1">Liberar Recompra</p>
                <h3 className="text-xl font-black text-slate-800 leading-tight">{releaseModalItem.name}</h3>
              </div>
              <button onClick={closeReleaseModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600 font-medium">
                Informe o motivo da liberação. Isso ficará registrado no histórico e no relatório gerencial.
              </p>
              <textarea
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                maxLength={280}
                placeholder="Ex.: peça devolvida por defeito, estorno confirmado e nova compra necessária."
                className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Motivo obrigatório</span>
                <span className="text-slate-400 font-bold">{releaseReason.trim().length}/280</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button onClick={closeReleaseModal} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200">
                Cancelar
              </button>
              <button
                onClick={releaseForRepurchase}
                disabled={releasingItemId === releaseModalItem.id || !releaseReason.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {releasingItemId === releaseModalItem.id ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirmar Liberação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixTable;
