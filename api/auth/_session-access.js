import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

async function findUsersByEmail(admin, email, timeoutMs = 4000) {
  const normalized = email.toLowerCase();
  const matches = [];

  const lookup = (async () => {
    try {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const filtered = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      if (filtered.ok) {
        const payload = await filtered.json();
        const users = payload?.users || payload || [];
        for (const u of Array.isArray(users) ? users : []) {
          if (String(u.email || '').toLowerCase() === normalized) matches.push(u);
        }
      }
    } catch (err) {
      console.warn('[session-access] list users:', err.message);
    }

    const { data: profiles } = await admin.from('profiles').select('id, email').ilike('email', normalized);
    for (const profile of profiles || []) {
      if (matches.some((m) => m.id === profile.id)) continue;
      const { data } = await admin.auth.admin.getUserById(profile.id);
      if (data?.user) matches.push(data.user);
    }
  })();

  await Promise.race([
    lookup,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  return matches;
}

/**
 * Repara e devolve memberships da sessao atual (service role).
 * GET/POST com Authorization: Bearer <access_token>
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return sendJson(res, 401, { error: 'Sessao obrigatoria.' });
    }

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    const user = authData.user;
    const email = String(user.email || '').trim().toLowerCase();

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true }).catch(() => null);

    // Profile upsert em paralelo com memberships (nao bloqueia leitura).
    const profileUpsert = admin.from('profiles').upsert(
      {
        id: user.id,
        email: email || null,
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          (email ? email.split('@')[0] : 'Usuario'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    let { data: memberships, error: membersError } = await admin
      .from('organization_members')
      .select('id, tenant_id, user_id, role, permissions, module_permissions, created_at')
      .eq('user_id', user.id);
    if (membersError) throw membersError;

    void profileUpsert;

    // Se vazio, tenta propagar de contas irmas / convites (com timeout curto).
    if ((!memberships || memberships.length === 0) && email) {
      const related = await findUsersByEmail(admin, email, 3500);
      if (!related.some((u) => u.id === user.id)) related.push(user);

      const membershipMap = new Map();
      for (const relatedUser of related) {
        const { data: rows } = await admin
          .from('organization_members')
          .select('tenant_id, role')
          .eq('user_id', relatedUser.id);
        for (const row of rows || []) {
          if (row.tenant_id) membershipMap.set(row.tenant_id, row.role || 'member');
        }
      }

      const { data: invites } = await admin
        .from('invitations')
        .select('tenant_id, role, status')
        .eq('email', email)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(5);

      for (const invite of invites || []) {
        if (invite.tenant_id) membershipMap.set(invite.tenant_id, invite.role || 'member');
      }

      for (const [tenant_id, role] of membershipMap.entries()) {
        await admin.from('organization_members').upsert(
          { tenant_id, user_id: user.id, role },
          { onConflict: 'tenant_id,user_id' },
        );
      }

      const refreshed = await admin
        .from('organization_members')
        .select('id, tenant_id, user_id, role, permissions, module_permissions, created_at')
        .eq('user_id', user.id);
      memberships = refreshed.data || [];
    }

    const tenantIds = [...new Set((memberships || []).map((m) => m.tenant_id).filter(Boolean))];
    let tenants = [];
    if (tenantIds.length > 0) {
      const { data: tenantRows } = await admin.from('saas_tenants').select('*').in('id', tenantIds);
      tenants = tenantRows || [];
    }

    return sendJson(res, 200, {
      ok: true,
      userId: user.id,
      email,
      membershipCount: memberships?.length || 0,
      memberships: memberships || [],
      tenants,
      repaired: (memberships?.length || 0) > 0,
    });
  } catch (error) {
    console.error('[session-access]', error);
    return sendJson(res, 500, { error: error.message || 'Falha ao verificar acesso da sessao.' });
  }
}
