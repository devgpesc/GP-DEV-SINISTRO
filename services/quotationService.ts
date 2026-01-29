
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
    // Precisamos dos preços de todos os itens desta cotação
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
    // (Aqueles que foram convidados ou que já responderam)
    const { data: qSuppliers, error: qsError } = await supabase
        .from('quotation_suppliers')
        .select('supplier_id, suppliers(id, name, rating, city)')
        .eq('quotation_id', quotationId);

    if (qsError) throw qsError;

    const suppliers = qSuppliers.map((qs: any) => qs.suppliers);

    return { items, prices, suppliers };
  },

  /**
   * Simula a resposta de fornecedores (Mock inteligente para demonstração)
   * Em produção, isso viria de um portal do fornecedor.
   */
  async simulateSupplierResponses(quotationId: string) {
      // 1. Pega itens e fornecedores
      const { items, suppliers } = await this.getMatrixData(quotationId);
      
      if (items.length === 0 || suppliers.length === 0) return;

      const newPrices = [];

      for (const item of items) {
          for (const supplier of suppliers) {
              // Verifica se já tem preço
              const { data: existing } = await supabase.from('quotation_supplier_prices')
                .select('id')
                .eq('quotation_item_id', item.id)
                .eq('supplier_id', supplier.id)
                .maybeSingle();

              if (!existing) {
                  // Gera preço aleatório baseado numa média fictícia
                  const basePrice = Math.random() * 500 + 100; 
                  const variation = (Math.random() - 0.5) * 50; // +/- 25
                  
                  newPrices.push({
                      quotation_item_id: item.id,
                      supplier_id: supplier.id,
                      price: Number((basePrice + variation).toFixed(2)),
                      availability: Math.random() > 0.1, // 90% chance de ter
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
      
      // 1. Agrupar itens por fornecedor
      const ordersBySupplier: Record<string, any[]> = {};
      const { items, prices } = await this.getMatrixData(quotationId);

      Object.entries(selections).forEach(([itemId, supplierId]) => {
          const item = items.find(i => i.id === itemId);
          const priceObj = prices.find(p => p.quotation_item_id === itemId && p.supplier_id === supplierId);
          
          if (item && priceObj) {
              if (!ordersBySupplier[supplierId]) {
                  ordersBySupplier[supplierId] = [];
              }
              ordersBySupplier[supplierId].push({
                  name: item.name,
                  quantity: item.quantity,
                  price: priceObj.price,
                  catalogId: itemId // Link lógico
              });
          }
      });

      // 2. Criar OCs no banco
      const promises = Object.keys(ordersBySupplier).map(async (supplierId) => {
          const cartItems = ordersBySupplier[supplierId];
          const total = cartItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
          
          const payload = {
              code: `OC-${Date.now().toString().slice(-6)}`,
              eventId: eventId,
              supplierId: supplierId,
              items: cartItems, // JSONB
              total: total,
              status: 'Gerada', // Status inicial
              createdAt: new Date().toISOString()
          };

          return supabase.from('purchase_orders').insert([payload]);
      });

      await Promise.all(promises);

      // 3. Atualizar status da cotação
      await supabase.from('quotations').update({ status: 'Finalizada' }).eq('id', quotationId);
  }
};
