
import { supabase } from './supabaseClient';
import { Quotation, QuotationItem, SupplierPrice, MatrixData } from '../types';

export const quotationService = {
  /**
   * Busca dados completos para montar a Matriz de Decisão
   */
  async getMatrixData(quotationId: string): Promise<{ items: QuotationItem[], prices: SupplierPrice[], suppliers: any[] }> {
    // 1. Buscar Itens
    const { data: items, error: itemsError } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('name');

    if (itemsError) throw itemsError;

    // 2. Buscar Preços
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

    // 3. Buscar Fornecedores Participantes
    const { data: qSuppliers, error: qsError } = await supabase
        .from('quotation_suppliers')
        .select('supplier_id, suppliers(id, name, rating, city)')
        .eq('quotation_id', quotationId);

    if (qsError) throw qsError;

    const suppliers = qSuppliers.map((qs: any) => qs.suppliers);

    return { items, prices, suppliers };
  },

  /**
   * Salva ou atualiza um preço individual na matriz (Célula editável)
   */
  async savePrice(payload: { quotation_item_id: string, supplier_id: string, price: number, obs?: string }) {
      const { error } = await supabase
          .from('quotation_supplier_prices')
          .upsert({
              ...payload,
              availability: true,
              is_winner: false, // Reset winner status on edit
              created_at: new Date().toISOString()
          }, { onConflict: 'quotation_item_id, supplier_id' });
      
      if (error) throw error;
  },

  /**
   * Simula a resposta de fornecedores (Mock inteligente para demonstração)
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
   * Processa a compra: Gera OCs baseadas nos vencedores selecionados na Matriz
   */
  async processPurchase(quotationId: string, selections: Record<string, string>, eventId?: string) {
      // selections: { [itemId]: supplierId }
      
      // 0. Obter Usuário Atual (Necessário para RLS e Auditoria)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Validar e Buscar Dados
      const { items, prices } = await this.getMatrixData(quotationId);
      const ordersBySupplier: Record<string, any[]> = {};

      // 2. Marcar vencedores no banco (Auditoria)
      // Resetar anteriores primeiro
      const itemIds = items.map(i => i.id);
      await supabase.from('quotation_supplier_prices')
          .update({ is_winner: false })
          .in('quotation_item_id', itemIds);

      const winnersToUpdate: any[] = [];

      Object.entries(selections).forEach(([itemId, supplierId]) => {
          const item = items.find(i => i.id === itemId);
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (item && priceObj) {
              // Preparar atualização de vencedor
              winnersToUpdate.push(
                  supabase.from('quotation_supplier_prices')
                      .update({ is_winner: true })
                      .match({ quotation_item_id: itemId, supplier_id: supplierId })
              );

              // Agrupar para OC
              if (!ordersBySupplier[supplierId]) {
                  ordersBySupplier[supplierId] = [];
              }
              ordersBySupplier[supplierId].push({
                  name: item.name,
                  quantity: item.quantity,
                  price: priceObj.price,
                  catalogId: item.catalog_item_id || null,
                  unit: item.unit
              });
          }
      });

      await Promise.all(winnersToUpdate);

      // 3. Criar OCs no banco (PAYLOAD CORRIGIDO SNAKE_CASE)
      const promises = Object.keys(ordersBySupplier).map(async (supplierId) => {
          const cartItems = ordersBySupplier[supplierId];
          const total = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
          
          // Gera código aleatório OC-ANO-XXXX
          const code = `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          
          const payload = {
              code: code,
              event_id: eventId || null,      // snake_case
              supplier_id: supplierId,        // snake_case
              quotation_id: quotationId,      // snake_case (novo vínculo)
              items: cartItems,               // JSONB
              total: total,
              status: 'Gerada',
              created_at: new Date().toISOString(), // snake_case
              created_by: user.id             // snake_case (CRÍTICO)
          };

          const { error } = await supabase.from('purchase_orders').insert([payload]);
          if (error) {
              console.error("Erro ao criar OC para fornecedor " + supplierId, error);
              throw new Error(`Falha ao gerar OC: ${error.message}`);
          }
      });

      await Promise.all(promises);

      // 4. Atualizar status da cotação
      const { error: quoteError } = await supabase.from('quotations').update({ status: 'Finalizada' }).eq('id', quotationId);
      if (quoteError) console.warn("Erro ao finalizar cotação:", quoteError);
      
      // 5. Atualizar status do Evento (se houver)
      if (eventId) {
          await supabase.from('events').update({ status: 'Aprovado' }).eq('id', eventId);
      }
  }
};
