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

async function findUserByEmail(admin, email) {
  const normalized = email.toLowerCase();
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
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
    console.warn('[create-member] email lookup:', err.message);
  }

  const { data: profile } = await admin.from('profiles').select('id').eq('email', normalized).maybeSingle();
  if (profile?.id) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    return data?.user || null;
  }
  return null;
}

/**
 * Modelo Esc Finan: admin cria membro com senha e ja libera acesso na empresa.
 * Body: { email, password, name, role?, tenantId }
 * Header: Authorization Bearer <access_token do admin>
 */
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const role = String(body.role || 'member').trim() || 'member';
    const tenantId = String(body.tenantId || '').trim();

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Informe um e-mail valido.' });
    }
    if (!name || name.length < 2) {
      return sendJson(res, 400, { error: 'Informe o nome do membro.' });
    }
    if (!password || password.length < 8) {
      return sendJson(res, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
    }
    if (!tenantId) {
      return sendJson(res, 400, { error: 'Empresa (tenantId) obrigatoria.' });
    }
    if (!['member', 'admin', 'owner'].includes(role)) {
      return sendJson(res, 400, { error: 'Perfil invalido. Use member, admin ou owner.' });
    }

    const admin = getSupabaseAdmin();
    const caller = await getCallerUser(admin, req);
    if (!caller) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    // Admin da empresa ou dono
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', caller.id)
      .maybeSingle();

    const { data: tenant } = await admin
      .from('saas_tenants')
      .select('id, name, owner_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (!tenant) {
      return sendJson(res, 404, { error: 'Empresa nao encontrada.' });
    }

    const callerRole = String(membership?.role || '').toLowerCase();
    const isOwner = tenant.owner_id === caller.id;
    const isAdmin = callerRole === 'admin' || callerRole === 'owner';
    if (!isOwner && !isAdmin) {
      return sendJson(res, 403, { error: 'Apenas administradores podem adicionar membros.' });
    }

    let user = await findUserByEmail(admin, email);
    let created = false;

    if (user) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata || {}),
          full_name: name,
          name,
        },
      });
      if (updateError) throw updateError;
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, name },
      });
      if (createError) throw createError;
      user = createdUser.user;
      created = true;
    }

    if (!user?.id) {
      return sendJson(res, 500, { error: 'Falha ao criar usuario.' });
    }

    const { error: memberError } = await admin.from('organization_members').upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        role,
      },
      { onConflict: 'tenant_id,user_id' },
    );
    if (memberError) throw memberError;

    if (role === 'owner') {
      await admin.from('saas_tenants').update({ owner_id: user.id }).eq('id', tenantId);
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: user.id,
        email,
        full_name: name,
        role: 'Usuário',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileError) throw profileError;

    // Cancela convites pendentes do mesmo e-mail nesta empresa (modelo antigo).
    await admin
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .eq('status', 'pending');

    const loginUrl = `${process.env.APP_ORIGIN || process.env.VITE_APP_ORIGIN || 'https://eventos.escsistemas.com'}/login`;

    return sendJson(res, 200, {
      ok: true,
      created,
      userId: user.id,
      email,
      name,
      role,
      tenantId,
      tenantName: tenant.name,
      loginUrl,
      message: created
        ? 'Membro criado. Ja pode entrar com e-mail e senha (sem confirmacao).'
        : 'Usuario existente atualizado e vinculado a empresa. Ja pode entrar com a senha definida.',
    });
  } catch (error) {
    console.error('[create-member]', error);
    const message = error?.message || 'Falha ao criar membro.';
    if (String(message).toLowerCase().includes('already') || String(message).toLowerCase().includes('registered')) {
      return sendJson(res, 409, { error: 'Este e-mail ja possui conta. Tente novamente ou redefina a senha no formulario.' });
    }
    return sendJson(res, 500, { error: message });
  }
}
