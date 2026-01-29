
import { supabase } from './supabaseClient';
import { Quotation, QuotationItem, SupplierPrice, MatrixData } from '../types';

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
   * PROCESSA A COMPRA: GERA OCS NO BANCO
   * Versão Blindada: Logs, Validação de Auth e Tratamento de Erro SQL
   */
  async processPurchase(quotationId: string, selections: Record<string, string>, eventId?: string) {
      console.log('>>> Iniciando processPurchase', { quotationId, selectionsCount: Object.keys(selections).length });

      // 1. Validar Usuário (Obrigatório para created_by)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
          console.error("Erro Auth:", authError);
          throw new Error("Sessão expirada. Faça login novamente para aprovar.");
      }

      // 2. Buscar dados da matriz
      const { items, prices } = await this.getMatrixData(quotationId);
      
      // Agrupamento de itens por fornecedor
      const ordersBySupplier: Record<string, any[]> = {};
      const itemIds = items.map(i => i.id);

      // 3. Resetar vencedores anteriores (para evitar duplicidade visual na matriz)
      await supabase.from('quotation_supplier_prices')
          .update({ is_winner: false })
          .in('quotation_item_id', itemIds);

      const winnersToUpdate: any[] = [];

      // 4. Processar Seleções
      Object.entries(selections).forEach(([itemId, supplierId]) => {
          const item = items.find(i => i.id === itemId);
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (item && priceObj) {
              // Marca vencedor no banco
              winnersToUpdate.push(
                  supabase.from('quotation_supplier_prices')
                      .update({ is_winner: true })
                      .match({ quotation_item_id: itemId, supplier_id: supplierId })
              );

              // Adiciona ao carrinho do fornecedor
              if (!ordersBySupplier[supplierId]) {
                  ordersBySupplier[supplierId] = [];
              }
              
              ordersBySupplier[supplierId].push({
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit || 'UN',
                  price: priceObj.price,
                  total: priceObj.price * item.quantity,
                  catalog_item_id: item.catalog_item_id || null, // Importante para rastreabilidade
                  quotation_item_id: item.id
              });
          }
      });

      if (Object.keys(ordersBySupplier).length === 0) {
          throw new Error("Nenhum item selecionado ou preços não encontrados.");
      }

      // Executa updates de "winner" em paralelo
      await Promise.all(winnersToUpdate);

      // 5. CRIAR AS OCs (INSERT REAL)
      const creationPromises = Object.keys(ordersBySupplier).map(async (supplierId) => {
          const cartItems = ordersBySupplier[supplierId];
          const total = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
          
          // Gera código OC único
          const code = `OC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          
          const payload = {
              code: code,
              event_id: eventId || null,
              supplier_id: supplierId,
              quotation_id: quotationId,
              items: cartItems, // Salva itens como JSONB para simplicidade inicial
              total: total,
              status: 'Gerada',
              created_at: new Date().toISOString(),
              created_by: user.id
          };

          console.log(`Tentando criar OC para Fornecedor ${supplierId}:`, payload);

          const { data, error } = await supabase
              .from('purchase_orders')
              .insert([payload])
              .select()
              .single();

          if (error) {
              console.error(`ERRO CRÍTICO ao criar OC ${code}:`, error);
              throw new Error(`Falha no banco ao criar OC: ${error.message}`);
          }
          
          return data;
      });

      const createdOrders = await Promise.all(creationPromises);
      console.log(">>> OCs Criadas com Sucesso:", createdOrders);

      // 6. Atualizar status da cotação e evento
      await supabase.from('quotations').update({ status: 'Finalizada' }).eq('id', quotationId);
      
      if (eventId) {
          await supabase.from('events').update({ status: 'Aprovado' }).eq('id', eventId);
      }

      return createdOrders;
  }
};
