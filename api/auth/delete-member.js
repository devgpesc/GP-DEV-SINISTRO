import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

async function getCallerUser(admin, req) {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Remove membership e apaga a conta Auth (limpeza definitiva).
 * Body: { userId, tenantId, deleteAuthAccount?: boolean }
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userId = String(body.userId || '').trim();
    const tenantId = String(body.tenantId || '').trim();
    const deleteAuthAccount = body.deleteAuthAccount !== false;

    if (!userId || !tenantId) {
      return sendJson(res, 400, { error: 'Informe userId e tenantId.' });
    }

    const admin = getSupabaseAdmin();
    const caller = await getCallerUser(admin, req);
    if (!caller) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    if (caller.id === userId) {
      return sendJson(res, 400, { error: 'Voce nao pode excluir a propria conta por aqui.' });
    }

    const { data: tenant } = await admin
      .from('saas_tenants')
      .select('id, owner_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (!tenant) return sendJson(res, 404, { error: 'Empresa nao encontrada.' });

    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', caller.id)
      .maybeSingle();

    const callerRole = String(membership?.role || '').toLowerCase();
    const isOwner = tenant.owner_id === caller.id;
    const isAdmin = callerRole === 'admin' || callerRole === 'owner';
    if (!isOwner && !isAdmin) {
      return sendJson(res, 403, { error: 'Apenas administradores podem excluir membros.' });
    }

    const { data: targetUserData } = await admin.auth.admin.getUserById(userId);
    const targetEmail = String(targetUserData?.user?.email || '').toLowerCase();

    await admin.from('organization_members').delete().eq('tenant_id', tenantId).eq('user_id', userId);

    if (targetEmail) {
      await admin
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('tenant_id', tenantId)
        .eq('email', targetEmail)
        .in('status', ['pending', 'accepted']);
    }

    let authDeleted = false;
    if (deleteAuthAccount) {
      // Se o usuario ainda tem membership em outra empresa, nao apaga Auth.
      const { data: otherMemberships } = await admin
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      const { data: ownedTenants } = await admin
        .from('saas_tenants')
        .select('id')
        .eq('owner_id', userId)
        .limit(1);

      if ((otherMemberships?.length || 0) === 0 && (ownedTenants?.length || 0) === 0) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;
        authDeleted = true;
        await admin.from('profiles').delete().eq('id', userId);
      }
    }

    return sendJson(res, 200, {
      ok: true,
      authDeleted,
      message: authDeleted
        ? 'Usuario removido da empresa e conta de acesso excluida. Pode adicionar novamente com senha nova.'
        : 'Usuario removido da empresa. Conta Auth mantida (ainda vinculada a outra empresa ou como dono).',
    });
  } catch (error) {
    console.error('[delete-member]', error);
    return sendJson(res, 500, { error: error.message || 'Falha ao excluir membro.' });
  }
}
