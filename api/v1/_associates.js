import { applyCors, sendJson, methodNotAllowed, serverError } from '../_lib/http.js';
import { authenticateApiRequest } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const auth = await authenticateApiRequest(req, res, 'read');
  if (!auth) return;

  try {
    const supabase = getSupabaseAdmin();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const document = req.query.document ? String(req.query.document).replace(/\D/g, '') : null;

    let query = supabase
      .from('associates')
      .select('id, name, document, type, email, phone, created_at, tenant_id')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (document) query = query.eq('document', document);

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, { data: data || [], meta: { count: data?.length || 0, tenant_id: auth.tenantId } });
  } catch (error) {
    console.error('[API associates]', error);
    return serverError(res, error.message);
  }
}
