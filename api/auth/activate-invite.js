import { getSupabaseAdmin } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

async function findUserByEmail(admin, email) {
  const normalized = email.toLowerCase();

  // Prefer Auth Admin API filter when disponivel
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });
    if (response.ok) {
      const payload = await response.json();
      const users = payload?.users || payload || [];
      const match = (Array.isArray(users) ? users : []).find(
        (u) => String(u.email || '').toLowerCase() === normalized,
      );
      if (match) return match;
    }
  } catch (err) {
    console.warn('[activate-invite] admin users filter falhou:', err.message);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();

  if (profile?.id) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    return data?.user || null;
  }

  return null;
}

/**
 * Ativa usuario convidado sem depender do e-mail de confirmacao do Supabase.
 * Body: { email, inviteToken? }
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const inviteToken = body.inviteToken ? String(body.inviteToken) : null;

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Informe um e-mail valido.' });
    }

    const admin = getSupabaseAdmin();
    const user = await findUserByEmail(admin, email);

    if (!user) {
      return sendJson(res, 404, {
        error: 'Usuario nao encontrado. Conclua o cadastro pelo link de convite primeiro.',
      });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updateError) throw updateError;

    let invite = null;
    if (inviteToken) {
      const { data } = await admin
        .from('invitations')
        .select('id, tenant_id, role, email, status')
        .eq('token', inviteToken)
        .maybeSingle();
      invite = data;
    }

    if (!invite) {
      const { data: invites } = await admin
        .from('invitations')
        .select('id, tenant_id, role, email, status')
        .eq('email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      invite = invites?.[0] || null;
    }

    if (invite?.tenant_id && String(invite.email || '').toLowerCase() === email && invite.status !== 'cancelled') {
      await admin.from('organization_members').upsert(
        {
          tenant_id: invite.tenant_id,
          user_id: user.id,
          role: invite.role || 'member',
        },
        { onConflict: 'tenant_id,user_id' },
      );
      await admin.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);
    }

    await admin.from('profiles').upsert(
      {
        id: user.id,
        email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    return sendJson(res, 200, {
      ok: true,
      message: 'Conta ativada. Faca login novamente com e-mail e senha.',
      userId: user.id,
    });
  } catch (error) {
    console.error('[activate-invite]', error);
    return sendJson(res, 500, { error: error.message || 'Falha ao ativar convite.' });
  }
}
