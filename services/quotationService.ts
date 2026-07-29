import { supabase } from './supabaseClient';
import { PurchaseSelection, QuotationItem, SupplierPrice } from '../types';

export interface ManualPurchaseSelection {
  supplierId: string;
  quantity: number;
  justification?: string;
}

const isMissingTableError = (error: any, tableName: string) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`'public.${tableName}'`) && message.includes('schema cache');
};

export const quotationService = {
  async getMatrixData(quotationId: string): Promise<{
    items: QuotationItem[];
    prices: SupplierPrice[];
    suppliers: any[];
    selections: PurchaseSelection[];
    processedItemIds: string[];
  }> {
    const { data: items, error: itemsError } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('name');

    if (itemsError) throw itemsError;

    const safeItems = items || [];
    const itemIds = safeItems.map((item) => item.id);
    let prices: SupplierPrice[] = [];

    if (itemIds.length > 0) {
      const { data: pricesData, error: pricesError } = await supabase
        .from('quotation_supplier_prices')
        .select('*')
        .in('quotation_item_id', itemIds);

      if (pricesError) throw pricesError;
      prices = pricesData || [];
    }

    const { data: qSuppliers, error: suppliersError } = await supabase
      .from('quotation_suppliers')
      .select('supplier_id, suppliers(id, name, rating, city)')
      .eq('quotation_id', quotationId);

    if (suppliersError) throw suppliersError;

    const suppliers = (qSuppliers || []).map((row: any) => row.suppliers).filter(Boolean);
    const selections = await this.getPurchaseSelections(quotationId);
    const processedItemIds = await this.getProcessedItemIds(quotationId);

    return { items: safeItems, prices, suppliers, selections, processedItemIds };
  },

  async getPurchaseSelections(quotationId: string): Promise<PurchaseSelection[]> {
    const { data, error } = await supabase
      .from('quotation_purchase_selections')
      .select('*')
      .eq('quotation_id', quotationId);

    if (error) {
      console.warn('[quotationService] Selecoes manuais indisponiveis:', error.message);
      return [];
    }

    return data || [];
  },

  async getProcessedItemIds(quotationId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('quotation_item_id, purchase_orders!inner(quotation_id)')
      .eq('purchase_orders.quotation_id', quotationId)
      .not('quotation_item_id', 'is', null);

    if (error) {
      console.warn('[quotationService] Nao foi possivel validar itens processados:', error.message);
      return [];
    }

    const processedIds = [...new Set((data || []).map((item: any) => item.quotation_item_id).filter(Boolean))];

    const { data: releasedRows, error: releaseError } = await supabase
      .from('quotation_item_releases')
      .select('quotation_item_id')
      .eq('quotation_id', quotationId)
      .eq('status', 'released');

    if (releaseError) {
      if (!isMissingTableError(releaseError, 'quotation_item_releases')) return processedIds;
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from('quotation_decision_history')
        .select('details')
        .eq('quotation_id', quotationId)
        .eq('action', 'release_repurchase');
      if (fallbackError) return processedIds;
      const releasedFallbackIds = new Set(
        (fallbackRows || [])
          .map((row: any) => row?.details?.quotation_item_id)
          .filter(Boolean)
      );
      return processedIds.filter((id) => !releasedFallbackIds.has(id));
    }

    const releasedIds = new Set((releasedRows || []).map((row: any) => row.quotation_item_id).filter(Boolean));
    return processedIds.filter((id) => !releasedIds.has(id));
  },

  async releaseItemForRepurchase(quotationId: string, itemId: string, reason: string) {
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) throw new Error('Motivo é obrigatório para liberar recompra.');

    const { data: { user } } = await (supabase.auth as any).getUser();
    const userId = user?.id || null;

    const { error } = await supabase.from('quotation_item_releases').upsert(
      {
        quotation_id: quotationId,
        quotation_item_id: itemId,
        reason: trimmedReason,
        status: 'released',
        created_by: userId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'quotation_id, quotation_item_id' }
    );

    if (error && !isMissingTableError(error, 'quotation_item_releases')) throw error;

    await supabase
      .from('quotation_purchase_selections')
      .update({ status: 'Cancelado' })
      .eq('quotation_id', quotationId)
      .eq('quotation_item_id', itemId);

    await this.saveDecisionHistory(quotationId, 'release_repurchase', {
      quotation_item_id: itemId,
      reason: trimmedReason,
      user_id: userId,
      source: error ? 'fallback_decision_history' : 'quotation_item_releases',
    });
  },

  async savePrice(payload: {
    quotation_item_id: string;
    supplier_id: string;
    price: number;
    obs?: string;
    availability?: boolean;
    delivery_days?: number | null;
  }) {
    const { error } = await supabase
      .from('quotation_supplier_prices')
      .upsert(
        {
          ...payload,
          availability: payload.availability ?? true,
          is_winner: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'quotation_item_id, supplier_id' }
      );

    if (error && payload.delivery_days !== undefined) {
      const { delivery_days, ...legacyPayload } = payload;
      const { error: fallbackError } = await supabase
        .from('quotation_supplier_prices')
        .upsert(
          {
            ...legacyPayload,
            availability: legacyPayload.availability ?? true,
            is_winner: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'quotation_item_id, supplier_id' }
        );

      if (fallbackError) throw fallbackError;
      return;
    }

    if (error) throw error;
  },

  async simulateSupplierResponses(quotationId: string) {
    const { items, suppliers } = await this.getMatrixData(quotationId);
    if (items.length === 0 || suppliers.length === 0) return;

    const newPrices = [];
    for (const item of items) {
      for (const supplier of suppliers) {
        const { data: existing } = await supabase
          .from('quotation_supplier_prices')
          .select('id')
          .eq('quotation_item_id', item.id)
          .eq('supplier_id', supplier.id)
          .maybeSingle();

        if (!existing) {
          const basePrice = Math.random() * 500 + 100;
          const variation = (Math.random() - 0.5) * 50;
          newPrices.push({
            quotation_item_id: item.id,
            supplier_id: supplier.id,
            price: Number((basePrice + variation).toFixed(2)),
            availability: Math.random() > 0.1,
            delivery_days: Math.floor(Math.random() * 7) + 1,
            is_winner: false,
          });
        }
      }
    }

    if (newPrices.length > 0) {
      await supabase.from('quotation_supplier_prices').insert(newPrices);
    }
  },

  async savePurchaseSelection(
    quotationId: string,
    item: QuotationItem,
    price: SupplierPrice,
    selection: ManualPurchaseSelection
  ) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    const payload = {
      quotation_id: quotationId,
      quotation_item_id: item.id,
      supplier_id: selection.supplierId,
      selected_price: price.price,
      quantity: selection.quantity || item.quantity || 1,
      justification: selection.justification || null,
      status: 'Selecionado',
      selected_by: user?.id || null,
      selected_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('quotation_purchase_selections')
      .upsert(payload, { onConflict: 'quotation_id, quotation_item_id' });

    if (error) {
      console.warn('[quotationService] Falha ao persistir selecao manual:', error.message);
    }
  },

  async getLockedQuotationItemIds(quotationId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('quotation_item_id, purchase_orders!inner(quotation_id)')
      .eq('purchase_orders.quotation_id', quotationId)
      .not('quotation_item_id', 'is', null);

    if (error) {
      console.warn('[quotationService] Nao foi possivel validar itens com OC:', error.message);
      return new Set();
    }

    return new Set((data || []).map((row: any) => row.quotation_item_id).filter(Boolean));
  },

  async syncQuotationItems(
    quotationId: string,
    wizardItems: Array<{
      id?: string;
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      item_type?: 'Peça' | 'Serviço';
      catalog_item_id?: string;
    }>
  ) {
    const lockedIds = await this.getLockedQuotationItemIds(quotationId);

    const { data: existingRows, error: existingError } = await supabase
      .from('quotation_items')
      .select('id')
      .eq('quotation_id', quotationId);

    if (existingError) throw existingError;

    const existingIds = new Set((existingRows || []).map((row) => row.id));
    const wizardIds = new Set(wizardItems.filter((item) => item.id).map((item) => item.id!));

    for (const item of wizardItems) {
      const payload = {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || (item.item_type === 'Serviço' ? 'HL' : 'UN'),
        category: item.category,
        item_type: item.item_type || 'Peça',
        catalog_item_id: item.catalog_item_id || null,
      };

      if (item.id && existingIds.has(item.id)) {
        const { error } = await supabase.from('quotation_items').update(payload).eq('id', item.id);
        if (error) throw error;
        continue;
      }

      const { error } = await supabase.from('quotation_items').insert([{
        quotation_id: quotationId,
        ...payload,
        status: 'Pendente',
      }]);
      if (error) throw error;
    }

    const removableIds = (existingRows || [])
      .map((row) => row.id)
      .filter((id) => !wizardIds.has(id) && !lockedIds.has(id));

    if (removableIds.length > 0) {
      const { error } = await supabase.from('quotation_items').delete().in('id', removableIds);
      if (error) throw error;
    }
  },

  async syncQuotationSuppliers(quotationId: string, supplierIds: string[]) {
    const { data: existingRows, error: existingError } = await supabase
      .from('quotation_suppliers')
      .select('supplier_id')
      .eq('quotation_id', quotationId);

    if (existingError) throw existingError;

    const existingIds = new Set((existingRows || []).map((row) => row.supplier_id));
    const desiredIds = new Set(supplierIds);

    const toRemove = [...existingIds].filter((id) => !desiredIds.has(id));
    const toAdd = supplierIds.filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('quotation_suppliers')
        .delete()
        .eq('quotation_id', quotationId)
        .in('supplier_id', toRemove);
      if (error) throw error;
    }

    if (toAdd.length > 0) {
      const { error } = await supabase.from('quotation_suppliers').insert(
        toAdd.map((supplierId) => ({
          quotation_id: quotationId,
          supplier_id: supplierId,
          status: 'Aguardando',
        }))
      );
      if (error) throw error;
    }
  },

  async removePurchaseSelection(quotationId: string, itemId: string) {
    const { error } = await supabase
      .from('quotation_purchase_selections')
      .delete()
      .eq('quotation_id', quotationId)
      .eq('quotation_item_id', itemId);

    if (error) {
      console.warn('[quotationService] Falha ao remover selecao manual:', error.message);
    }
  },

  async saveDecisionHistory(quotationId: string, action: string, details: any) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    const { error } = await supabase.from('quotation_decision_history').insert([{
      quotation_id: quotationId,
      action,
      details,
      user_id: user?.id || null,
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      console.warn('[quotationService] Historico indisponivel:', error.message);
    }
  },

  async processPurchase(
    quotationId: string,
    selections: Record<string, ManualPurchaseSelection>,
    eventId?: string
  ) {
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser();
    if (authError || !user) {
      throw new Error('Sessao expirada. Faca login novamente para processar compras.');
    }

    if (Object.keys(selections).length === 0) {
      throw new Error('Selecione pelo menos um item para compra.');
    }

    const { items, prices, processedItemIds } = await this.getMatrixData(quotationId);
    const activeSelections = Object.fromEntries(
      Object.entries(selections).filter(([itemId]) => !processedItemIds.includes(itemId))
    );

    if (Object.keys(activeSelections).length === 0) {
      throw new Error('Selecione pelo menos um item pendente para compra.');
    }

    const duplicateItems = Object.keys(activeSelections).filter((itemId) => processedItemIds.includes(itemId));
    if (duplicateItems.length > 0) {
      throw new Error('Existem itens ja processados. Atualize a matriz antes de continuar.');
    }

    const itemIds = items.map((item) => item.id);
    const ordersBySupplier: Record<string, any[]> = {};
    const winnerUpdates: PromiseLike<any>[] = [];

    await supabase
      .from('quotation_supplier_prices')
      .update({ is_winner: false })
      .in('quotation_item_id', itemIds);

    for (const [itemId, selection] of Object.entries(activeSelections)) {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error(`Item nao encontrado na cotacao: ${itemId}`);
      if (!selection.supplierId) throw new Error(`Item sem fornecedor selecionado: ${item.name}`);

      const price = prices.find(
        (candidate) => candidate.quotation_item_id === itemId && candidate.supplier_id === selection.supplierId
      );
      if (!price || price.price === null || price.price === undefined) {
        throw new Error(`Item selecionado sem valor cotado: ${item.name}`);
      }

      const quantity = Number(selection.quantity || item.quantity || 1);
      if (!quantity || quantity <= 0) throw new Error(`Quantidade invalida para o item: ${item.name}`);

      winnerUpdates.push(
        supabase
          .from('quotation_supplier_prices')
          .update({ is_winner: true })
          .match({ quotation_item_id: itemId, supplier_id: selection.supplierId })
      );

      if (!ordersBySupplier[selection.supplierId]) ordersBySupplier[selection.supplierId] = [];
      ordersBySupplier[selection.supplierId].push({
        quotation_item_id: item.id,
        catalog_item_id: item.catalog_item_id || null,
        name: item.name,
        quantity,
        unit: item.unit || 'UN',
        unit_price: price.price,
        total_price: price.price * quantity,
        justification: selection.justification || null,
      });
    }

    await Promise.all(winnerUpdates);

    const createdOrders = await Promise.all(Object.entries(ordersBySupplier).map(async ([supplierId, cartItems]) => {
      const totalOrder = cartItems.reduce((sum, item) => sum + item.total_price, 0);
      const code = `OC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert([{
          code,
          event_id: eventId || null,
          supplier_id: supplierId,
          quotation_id: quotationId,
          total: totalOrder,
          status: 'Gerada',
          created_at: new Date().toISOString(),
          created_by: user.id,
        }])
        .select()
        .single();

      if (orderError) throw new Error(`Erro ao criar OC: ${orderError.message}`);

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(
        cartItems.map((item) => ({
          purchase_order_id: order.id,
          quotation_item_id: item.quotation_item_id,
          catalog_item_id: item.catalog_item_id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      );

      if (itemsError) {
        await supabase.from('purchase_orders').delete().eq('id', order.id);
        throw new Error(`Erro ao salvar itens da OC: ${itemsError.message}`);
      }

      return { ...order, itemsCount: cartItems.length };
    }));

    await supabase
      .from('quotation_purchase_selections')
      .update({ status: 'Processado' })
      .eq('quotation_id', quotationId)
      .in('quotation_item_id', Object.keys(activeSelections));

    await this.saveDecisionHistory(quotationId, 'process_purchase', {
      selections: activeSelections,
      purchase_orders: createdOrders.map((order: any) => ({ id: order.id, code: order.code, itemsCount: order.itemsCount })),
    });

    await supabase.from('quotations').update({ status: 'Aguardando Aprovação' }).eq('id', quotationId);
    if (eventId) {
      await supabase.from('events').update({ status: 'Aguardando Aprovação' }).eq('id', eventId);
    }

    return createdOrders;
  },
};
