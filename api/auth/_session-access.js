import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

/** Retorna somente o acesso ja concedido ao usuario da sessao. */
export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  }

  try {
    const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return sendJson(res, 401, { error: 'Sessao obrigatoria.' });

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    const { data: memberships, error: membershipError } = await admin
      .from('organization_members')
      .select('tenant_id, role, permissions, module_permissions, created_at')
      .eq('user_id', authData.user.id);
    if (membershipError) throw membershipError;

    const tenantIds = [...new Set((memberships || []).map((membership) => membership.tenant_id).filter(Boolean))];
    let tenants = [];
    if (tenantIds.length) {
      const { data, error } = await admin
        .from('saas_tenants')
        .select('id, name, status, plan_id')
        .in('id', tenantIds);
      if (error) throw error;
      tenants = data || [];
    }

    return sendJson(res, 200, {
      ok: true,
      membershipCount: memberships?.length || 0,
      memberships: memberships || [],
      tenants,
    });
  } catch (error) {
    console.error('[session-access]', error);
    return sendJson(res, 500, { error: 'Nao foi possivel verificar o acesso da sessao.' });
  }
}
