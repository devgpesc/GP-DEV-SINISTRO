import { applyCors, sendJson, methodNotAllowed, serverError, badRequest } from '../_lib/http.js';
import { authenticateApiRequest } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const auth = await authenticateApiRequest(req, res, 'read');
  if (!auth) return;

  try {
    const supabase = getSupabaseAdmin();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const code = req.query.code ? String(req.query.code) : null;
    const id = req.query.id ? String(req.query.id) : null;
    const status = req.query.status ? String(req.query.status) : null;

    if (id) {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, code, status, total, created_at, approval_note, approved_at, approved_by,
          quotation_id, event_id, supplier_id, tenant_id,
          suppliers (name, city, email, whatsapp),
          purchase_order_items (name, quantity, unit, unit_price, total_price)
        `)
        .eq('tenant_id', auth.tenantId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return badRequest(res, 'Ordem de compra nao encontrada.');

      const { data: history } = await supabase
        .from('purchase_order_history')
        .select('id, action, from_status, to_status, comment, details, user_id, created_at')
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: false });

      return sendJson(res, 200, { data: { ...data, history: history || [] } });
    }

    let query = supabase
      .from('purchase_orders')
      .select(`
        id, code, status, total, created_at, approval_note, approved_at,
        quotation_id, event_id, supplier_id,
        suppliers (name, city),
        purchase_order_items (name, quantity, unit, unit_price, total_price)
      `)
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (code) query = query.eq('code', code);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, {
      data: data || [],
      meta: { count: data?.length || 0, tenant_id: auth.tenantId },
    });
  } catch (error) {
    console.error('[API purchase-orders]', error);
    return serverError(res, error.message);
  }
}
