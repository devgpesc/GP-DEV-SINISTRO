
import { supabase } from './supabaseClient';
import { QuotationItem, SupplierPrice } from '../types';

export const quotationService = {
  /**
   * Busca dados completos para montar a Matriz de Decisão
   */
  async getMatrixData(quotationId: string): Promise<{ items: QuotationItem[], prices: SupplierPrice[], suppliers: any[] }> {
    const { data: items, error: itemsError } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('name');

    if (itemsError) throw itemsError;

    const itemIds = items.map(i => i.id);
    let prices: SupplierPrice[] = [];
    
    if (itemIds.length > 0) {
        const { data: pricesData, error: pricesError } = await supabase
        .from('quotation_supplier_prices')
        .select('*')
        .in('quotation_item_id', itemIds);
        
        if (pricesError) throw pricesError;
        prices = pricesData || [];
    }

    const { data: qSuppliers, error: qsError } = await supabase
        .from('quotation_suppliers')
        .select('supplier_id, suppliers(id, name, rating, city)')
        .eq('quotation_id', quotationId);

    if (qsError) throw qsError;

    const suppliers = qSuppliers.map((qs: any) => qs.suppliers);

    return { items, prices, suppliers };
  },

  /**
   * Salva ou atualiza um preço individual na matriz
   */
  async savePrice(payload: { quotation_item_id: string, supplier_id: string, price: number, obs?: string }) {
      const { error } = await supabase
          .from('quotation_supplier_prices')
          .upsert({
              ...payload,
              availability: true,
              is_winner: false, 
              created_at: new Date().toISOString()
          }, { onConflict: 'quotation_item_id, supplier_id' });
      
      if (error) throw error;
  },

  /**
   * Simula a resposta de fornecedores
   */
  async simulateSupplierResponses(quotationId: string) {
      const { items, suppliers } = await this.getMatrixData(quotationId);
      if (items.length === 0 || suppliers.length === 0) return;

      const newPrices = [];
      for (const item of items) {
          for (const supplier of suppliers) {
              const { data: existing } = await supabase.from('quotation_supplier_prices')
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
                      is_winner: false
                  });
              }
          }
      }
      if (newPrices.length > 0) {
          await supabase.from('quotation_supplier_prices').insert(newPrices);
      }
  },

  /**
   * PROCESSA A COMPRA: GERA OCS NO BANCO (MODELO RELACIONAL)
   * Passo 1: Cria Purchase Order (Header)
   * Passo 2: Cria Purchase Order Items (Detail)
   */
  async processPurchase(quotationId: string, selections: Record<string, string>, eventId?: string) {
      console.log('>>> Iniciando processPurchase (Relacional)', { quotationId, selectionsCount: Object.keys(selections).length });

      // 1. Validar Usuário
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
          throw new Error("Sessão expirada. Faça login novamente para aprovar.");
      }

      // 2. Buscar dados da matriz para enriquecer a OC
      const { items, prices } = await this.getMatrixData(quotationId);
      
      // Agrupamento de itens por fornecedor
      const ordersBySupplier: Record<string, any[]> = {};
      const itemIds = items.map(i => i.id);

      // 3. Atualizar vencedores na matriz (Auditoria)
      await supabase.from('quotation_supplier_prices')
          .update({ is_winner: false })
          .in('quotation_item_id', itemIds);

      const winnersToUpdate: any[] = [];

      // 4. Agrupar Itens por Fornecedor Vencedor
      Object.entries(selections).forEach(([itemId, supplierId]) => {
          const item = items.find(i => i.id === itemId);
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (item && priceObj) {
              // Auditoria de Vencedor
              winnersToUpdate.push(
                  supabase.from('quotation_supplier_prices')
                      .update({ is_winner: true })
                      .match({ quotation_item_id: itemId, supplier_id: supplierId })
              );

              // Estrutura do Item para Tabela Relacional
              if (!ordersBySupplier[supplierId]) {
                  ordersBySupplier[supplierId] = [];
              }
              
              ordersBySupplier[supplierId].push({
                  quotation_item_id: item.id,
                  catalog_item_id: item.catalog_item_id || null,
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit || 'UN',
                  unit_price: priceObj.price,
                  total_price: priceObj.price * item.quantity
              });
          }
      });

      if (Object.keys(ordersBySupplier).length === 0) {
          throw new Error("Nenhum item selecionado ou preços não encontrados.");
      }

      // Salva Vencedores
      await Promise.all(winnersToUpdate);

      // 5. TRANSAÇÃO DE CRIAÇÃO (Order + Items)
      const creationPromises = Object.keys(ordersBySupplier).map(async (supplierId) => {
          const cartItems = ordersBySupplier[supplierId];
          const totalOrder = cartItems.reduce((acc, i) => acc + i.total_price, 0);
          
          const code = `OC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          
          // A) Criar HEADER (Purchase Order)
          // NÃO INCLUIR COLUNA 'items' (JSONB) AQUI
          const orderPayload = {
              code: code,
              event_id: eventId || null,
              supplier_id: supplierId,
              quotation_id: quotationId,
              total: totalOrder,
              status: 'Gerada',
              created_at: new Date().toISOString(),
              created_by: user.id
          };

          const { data: orderData, error: orderError } = await supabase
              .from('purchase_orders')
              .insert([orderPayload])
              .select()
              .single();

          if (orderError) {
              console.error(`Falha ao criar OC Header ${code}:`, orderError);
              throw new Error(`Erro ao criar OC: ${orderError.message}`);
          }

          const orderId = orderData.id;

          // B) Criar ITEMS (Purchase Order Items)
          const itemsPayload = cartItems.map(item => ({
              purchase_order_id: orderId,
              quotation_item_id: item.quotation_item_id,
              catalog_item_id: item.catalog_item_id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              total_price: item.total_price
          }));

          const { error: itemsError } = await supabase
              .from('purchase_order_items')
              .insert(itemsPayload);

          if (itemsError) {
              console.error(`Falha ao inserir itens da OC ${code}:`, itemsError);
              // Opcional: Rollback da OC se falhar itens (delete orderId)
              await supabase.from('purchase_orders').delete().eq('id', orderId);
              throw new Error(`Erro ao salvar itens da OC: ${itemsError.message}`);
          }
          
          return { ...orderData, itemsCount: itemsPayload.length };
      });

      const results = await Promise.all(creationPromises);
      console.log(">>> Processo de Compra Finalizado. OCs:", results);

      // 6. Finalizar Cotação
      await supabase.from('quotations').update({ status: 'Finalizada' }).eq('id', quotationId);
      
      if (eventId) {
          await supabase.from('events').update({ status: 'Aprovado' }).eq('id', eventId);
      }

      return results;
  }
};
