
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
      // 0. Obter Usuário Atual (Necessário para RLS e Auditoria)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Validar e Buscar Dados
      const { items, prices } = await this.getMatrixData(quotationId);
      const ordersBySupplier: Record<string, any[]> = {};

      // 2. Marcar vencedores no banco (Auditoria) e Preparar Itens
      const itemIds = items.map(i => i.id);
      
      // Resetar vencedores anteriores para evitar duplicidade
      await supabase.from('quotation_supplier_prices')
          .update({ is_winner: false })
          .in('quotation_item_id', itemIds);

      const winnersToUpdate: any[] = [];

      Object.entries(selections).forEach(([itemId, supplierId]) => {
          const item = items.find(i => i.id === itemId);
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (item && priceObj) {
              // Preparar atualização de vencedor no banco
              winnersToUpdate.push(
                  supabase.from('quotation_supplier_prices')
                      .update({ is_winner: true })
                      .match({ quotation_item_id: itemId, supplier_id: supplierId })
              );

              // Agrupar para OC
              if (!ordersBySupplier[supplierId]) {
                  ordersBySupplier[supplierId] = [];
              }
              
              // ESTRUTURA DO ITEM NA OC (JSONB)
              // Enriquece com dados do catálogo e cotação para rastreabilidade
              ordersBySupplier[supplierId].push({
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  price: priceObj.price,
                  total: priceObj.price * item.quantity,
                  catalog_item_id: item.catalog_item_id || null, // Link com catálogo
                  catalogId: item.catalog_item_id || null, // Retrocompatibilidade frontend
                  quotation_item_id: item.id
              });
          }
      });

      if (winnersToUpdate.length === 0) {
          throw new Error("Nenhum item válido selecionado.");
      }

      await Promise.all(winnersToUpdate);

      // 3. Criar OCs no banco
      const promises = Object.keys(ordersBySupplier).map(async (supplierId) => {
          const cartItems = ordersBySupplier[supplierId];
          const total = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
          
          const code = `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          
          // PAYLOAD BLINDADO: Apenas campos que garantimos existir na migration
          const payload = {
              code: code,
              event_id: eventId || null,
              supplier_id: supplierId,
              quotation_id: quotationId,
              items: cartItems, // JSONB com estrutura rica
              total: total,
              status: 'Gerada',
              created_at: new Date().toISOString(),
              created_by: user.id
          };

          const { error } = await supabase.from('purchase_orders').insert([payload]);
          if (error) {
              console.error("Erro ao criar OC:", error);
              // Lança erro específico se for coluna ausente (para debug rápido)
              if (error.message.includes('column') && error.message.includes('does not exist')) {
                  throw new Error(`Erro de Schema: Coluna inexistente. Rode a migration 20240317.`);
              }
              throw new Error(`Falha ao gerar OC: ${error.message}`);
          }
      });

      await Promise.all(promises);

      // 4. Atualizar status da cotação
      await supabase.from('quotations').update({ status: 'Finalizada' }).eq('id', quotationId);
      
      // 5. Atualizar status do Evento (se houver)
      if (eventId) {
          await supabase.from('events').update({ status: 'Aprovado' }).eq('id', eventId);
      }
  }
};
