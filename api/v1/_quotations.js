import { applyCors, sendJson, methodNotAllowed, serverError } from '../_lib/http.js';
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
    const status = req.query.status ? String(req.query.status) : null;
    const id = req.query.id ? String(req.query.id) : null;

    if (id) {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          id, code, eventRef, eventId, status, date, suppliers, itemCount,
          participation_quota, attachments, created_at, updated_at, tenant_id,
          quotation_items (id, name, quantity, unit, item_type, status, category)
        `)
        .eq('tenant_id', auth.tenantId)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return sendJson(res, 200, { data: data || null });
    }

    let query = supabase
      .from('quotations')
      .select('id, code, eventRef, eventId, status, date, suppliers, itemCount, participation_quota, created_at, tenant_id')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (code) query = query.eq('code', code);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, { data: data || [], meta: { count: data?.length || 0, tenant_id: auth.tenantId } });
  } catch (error) {
    console.error('[API quotations]', error);
    return serverError(res, error.message);
  }
}
