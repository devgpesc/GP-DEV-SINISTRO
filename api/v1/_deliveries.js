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
    const status = req.query.status ? String(req.query.status) : null;
    const po = req.query.po ? String(req.query.po) : null;

    let query = supabase
      .from('deliveries')
      .select('id, po, supplier, items, date, event, customer, vehicle, status, delivered_by, observation, movement_history, created_at, tenant_id')
      .eq('tenant_id', auth.tenantId)
      .order('date', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (po) query = query.eq('po', po);

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, { data: data || [], meta: { count: data?.length || 0, tenant_id: auth.tenantId } });
  } catch (error) {
    console.error('[API deliveries]', error);
    return serverError(res, error.message);
  }
}
