import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

async function findUsersByEmail(admin, email) {
  const normalized = email.toLowerCase();
  const matches = [];

  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const filtered = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
      },
    );
    if (filtered.ok) {
      const payload = await filtered.json();
      const users = payload?.users || payload || [];
      for (const u of Array.isArray(users) ? users : []) {
        if (String(u.email || '').toLowerCase() === normalized) matches.push(u);
      }
    }

    // Fallback: varre poucas paginas se o filtro nao achar (casos Google/senha duplicados).
    if (matches.length === 0) {
      for (let page = 1; page <= 3; page++) {
        const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
        });
        if (!response.ok) break;
        const payload = await response.json();
        const users = payload?.users || [];
        for (const u of users) {
          if (String(u.email || '').toLowerCase() === normalized) matches.push(u);
        }
        if (users.length < 200) break;
      }
    }
  } catch (err) {
    console.warn('[activate-invite] list users falhou:', err.message);
  }

  if (matches.length === 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email')
      .ilike('email', normalized);
    for (const profile of profiles || []) {
      const { data } = await admin.auth.admin.getUserById(profile.id);
      if (data?.user) matches.push(data.user);
    }
  }

  return matches;
}

async function resolveSessionUser(admin, req) {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Ativa usuario convidado e vincula membership ao user da sessao atual.
 * Body: { email, inviteToken? }
 * Header opcional: Authorization: Bearer <access_token>
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const inviteToken = body.inviteToken ? String(body.inviteToken).trim() : null;

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Informe um e-mail valido.' });
    }

    const admin = getSupabaseAdmin();
    const sessionUser = await resolveSessionUser(admin, req);
    const usersByEmail = await findUsersByEmail(admin, email);

    // Preferir sempre o usuario da sessao logada (Google), se o e-mail bater.
    let user = null;
    if (sessionUser && String(sessionUser.email || '').toLowerCase() === email) {
      user = sessionUser;
    } else if (sessionUser && !usersByEmail.some((u) => u.id === sessionUser.id)) {
      // Sessao existe mas e-mail divergente — ainda usa a sessao se for o unico caminho.
      user = sessionUser;
    } else {
      user = usersByEmail[0] || null;
    }

    if (!user) {
      return sendJson(res, 404, {
        error: 'Usuario nao encontrado. Conclua o cadastro pelo link de convite primeiro.',
      });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updateError) throw updateError;

    // Confirma tambem eventuais contas duplicadas do mesmo e-mail.
    for (const extra of usersByEmail) {
      if (extra.id === user.id) continue;
      await admin.auth.admin.updateUserById(extra.id, { email_confirm: true }).catch(() => null);
    }

    // Garante que a sessao atual esta na lista (Google pode nao aparecer no filtro por e-mail).
    const relatedUsers = [...usersByEmail];
    if (!relatedUsers.some((u) => u.id === user.id)) {
      relatedUsers.push(user);
    }

    let invite = null;
    if (inviteToken) {
      const { data, error } = await admin
        .from('invitations')
        .select('id, tenant_id, role, email, status, token')
        .eq('token', inviteToken)
        .maybeSingle();
      if (error) throw error;
      invite = data;
    }

    if (!invite) {
      const { data: invites, error } = await admin
        .from('invitations')
        .select('id, tenant_id, role, email, status, token')
        .eq('email', email)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      invite = invites?.[0] || null;
    }

    // Coleta memberships de TODAS as contas do mesmo e-mail (senha vs Google).
    const membershipMap = new Map();
    for (const related of relatedUsers) {
      const { data: rows, error } = await admin
        .from('organization_members')
        .select('tenant_id, role')
        .eq('user_id', related.id);
      if (error) throw error;
      for (const row of rows || []) {
        if (!row.tenant_id) continue;
        membershipMap.set(row.tenant_id, row.role || 'member');
      }
    }

    let inviteSkippedReason = null;
    if (invite?.tenant_id && String(invite.email || '').toLowerCase() === email && invite.status !== 'cancelled') {
      membershipMap.set(invite.tenant_id, invite.role || 'member');
      await admin.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);
    } else if (!invite) {
      inviteSkippedReason = 'invite_not_found';
    } else if (invite.status === 'cancelled') {
      inviteSkippedReason = 'invite_cancelled';
    } else if (String(invite.email || '').toLowerCase() !== email) {
      inviteSkippedReason = 'invite_email_mismatch';
    }

    // Propaga memberships para TODAS as contas do e-mail (inclui sessao Google).
    for (const [tenant_id, role] of membershipMap.entries()) {
      for (const related of relatedUsers) {
        const { error: upsertError } = await admin.from('organization_members').upsert(
          { tenant_id, user_id: related.id, role },
          { onConflict: 'tenant_id,user_id' },
        );
        if (upsertError) throw upsertError;
      }
    }

    const membershipLinked = membershipMap.size > 0;

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: user.id,
        email: String(user.email || email).toLowerCase(),
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileError) throw profileError;

    const { data: memberships, error: membershipError } = await admin
      .from('organization_members')
      .select('id, tenant_id, role')
      .eq('user_id', user.id);
    if (membershipError) throw membershipError;

    if (!membershipLinked && (memberships?.length || 0) === 0) {
      return sendJson(res, 422, {
        error:
          inviteSkippedReason === 'invite_cancelled'
            ? 'Este convite foi cancelado. Peca ao administrador para recriar o acesso com senha.'
            : 'Nao foi possivel vincular esta conta a uma empresa. Peca ao administrador para adicionar o membro novamente.',
        inviteSkippedReason,
        userId: user.id,
        inviteStatus: invite?.status || null,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Conta ativada e vinculada a empresa.',
      userId: user.id,
      membershipLinked: true,
      membershipCount: memberships?.length || 0,
      inviteStatus: invite?.status || null,
      duplicateUsers: relatedUsers.length,
    });
  } catch (error) {
    console.error('[activate-invite]', error);
    return sendJson(res, 500, { error: error.message || 'Falha ao ativar convite.' });
  }
}
