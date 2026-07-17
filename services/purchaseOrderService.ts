import { supabase } from './supabaseClient';

export type PurchaseOrderHistoryEntry = {
  id: string;
  purchase_order_id: string;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  comment?: string | null;
  details?: Record<string, unknown>;
  user_id?: string | null;
  created_at: string;
  user_name?: string;
};

const actionLabels: Record<string, string> = {
  created: 'OC criada',
  approved: 'Aprovada por escrito',
  cancelled: 'Cancelada',
  received: 'Recebida / entregue',
  updated: 'Atualizada',
  deleted: 'Excluída',
  divergence: 'Divergência tratada',
};

export const getActionLabel = (action: string) => actionLabels[action] || action;

export const purchaseOrderService = {
  async getHistory(purchaseOrderId: string): Promise<PurchaseOrderHistoryEntry[]> {
    const { data, error } = await supabase
      .from('purchase_order_history')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: false });

    if (error || !data?.length) return [];

    const userIds = [...new Set(data.map((row) => row.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || p.email]));

    return data.map((row) => ({
      ...row,
      user_name: row.user_id ? profileMap.get(row.user_id) || 'Sistema' : 'Sistema',
    }));
  },

  async getHistoryByCodes(codes: string[]): Promise<Record<string, PurchaseOrderHistoryEntry[]>> {
    if (!codes.length) return {};

    const { data: orders } = await supabase
      .from('purchase_orders')
      .select('id, code')
      .in('code', codes);

    if (!orders?.length) return {};

    const result: Record<string, PurchaseOrderHistoryEntry[]> = {};
    await Promise.all(
      orders.map(async (order) => {
        result[order.code] = await this.getHistory(order.id);
      })
    );
    return result;
  },

  async logManualEntry(input: {
    purchaseOrderId: string;
    tenantId?: string;
    action: string;
    comment?: string;
    details?: Record<string, unknown>;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('purchase_order_history').insert([{
      purchase_order_id: input.purchaseOrderId,
      tenant_id: input.tenantId || null,
      action: input.action,
      comment: input.comment || null,
      details: input.details || {},
      user_id: user?.id || null,
    }]);
  },
};
