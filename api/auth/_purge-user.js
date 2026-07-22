import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';
import { purgeAuthUserById } from '../_lib/purgeAuthUser.js';

async function getCallerUser(admin, req) {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function findUsersByEmail(admin, email) {
  const normalized = email.toLowerCase();
  const matches = [];
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (response.ok) {
      const payload = await response.json();
      const users = payload?.users || payload || [];
      for (const u of Array.isArray(users) ? users : []) {
        if (String(u.email || '').toLowerCase() === normalized) matches.push(u);
      }
    }
  } catch (err) {
    console.warn('[purge-user] list:', err.message);
  }

  const { data: profiles } = await admin.from('profiles').select('id, email').ilike('email', normalized);
  for (const profile of profiles || []) {
    if (matches.some((m) => m.id === profile.id)) continue;
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (data?.user) matches.push(data.user);
  }
  return matches;
}

/**
 * Limpa conta fantasma do Auth (mesmo apos remocao da Equipe).
 * Body: { email, tenantId }
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const tenantId = String(body.tenantId || '').trim();

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Informe um e-mail valido.' });
    }
    if (!tenantId) {
      return sendJson(res, 400, { error: 'Informe tenantId.' });
    }

    const admin = getSupabaseAdmin();
    const caller = await getCallerUser(admin, req);
    if (!caller) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    if (String(caller.email || '').toLowerCase() === email) {
      return sendJson(res, 400, { error: 'Voce nao pode apagar a propria conta por aqui.' });
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
    const isPlatform =
      String(caller.email || '').toLowerCase() === 'devgpesc@gmail.com' ||
      String(caller.app_metadata?.role || '') === 'super_admin';

    if (!isOwner && !isAdmin && !isPlatform) {
      return sendJson(res, 403, { error: 'Apenas administradores podem limpar contas.' });
    }

    const users = await findUsersByEmail(admin, email);
    if (users.length === 0) {
      return sendJson(res, 404, { error: 'Nenhuma conta Auth encontrada para este e-mail.' });
    }

    const deletedIds = [];
    const skipped = [];

    for (const user of users) {
      if (user.id === caller.id) {
        skipped.push({ id: user.id, reason: 'caller' });
        continue;
      }

      await admin.from('organization_members').delete().eq('user_id', user.id);
      await admin
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('email', email)
        .in('status', ['pending', 'accepted']);

      // Nao apaga se for dono de alguma empresa.
      const { data: owned } = await admin.from('saas_tenants').select('id').eq('owner_id', user.id).limit(1);
      if ((owned?.length || 0) > 0) {
        skipped.push({ id: user.id, reason: 'owner' });
        continue;
      }

      await purgeAuthUserById(admin, user.id);
      deletedIds.push(user.id);
    }

    return sendJson(res, 200, {
      ok: true,
      email,
      deletedCount: deletedIds.length,
      deletedIds,
      skipped,
      message:
        deletedIds.length > 0
          ? `Conta(s) Auth removida(s) para ${email}. Pode adicionar o membro novamente.`
          : `Nenhuma conta Auth foi apagada para ${email}.`,
    });
  } catch (error) {
    console.error('[purge-user]', error);
    return sendJson(res, 500, { error: error.message || 'Falha ao limpar conta Auth.' });
  }
}
