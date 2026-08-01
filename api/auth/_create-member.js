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
      const matches = (Array.isArray(users) ? users : []).filter(
        (u) => String(u.email || '').toLowerCase() === normalized,
      );
      if (matches.length > 1) throw new Error('MULTIPLE_AUTH_ACCOUNTS');
      if (matches[0]) return matches[0];
    }
  } catch (err) {
    if (err?.message === 'MULTIPLE_AUTH_ACCOUNTS') throw err;
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
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const role = String(body.role || 'member').trim() || 'member';
    const tenantId = String(body.tenantId || '').trim();
    const userId = body.userId ? String(body.userId).trim() : null;

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

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();
    const profileRole = String(callerProfile?.role || '').toLowerCase();
    const isPlatform =
      String(caller.email || '').toLowerCase() === 'devgpesc@gmail.com' ||
      profileRole === 'super_admin' ||
      String(caller.app_metadata?.role || '') === 'super_admin';

    if (!isOwner && !isAdmin && !isPlatform) {
      return sendJson(res, 403, { error: 'Apenas administradores podem adicionar membros.' });
    }
    if (role === 'owner' && !isOwner && !isPlatform) {
      return sendJson(res, 403, { error: 'Apenas o proprietario atual ou a plataforma podem transferir a empresa.' });
    }

    let user = null;
    if (userId) {
      const { data } = await admin.auth.admin.getUserById(userId);
      user = data?.user || null;
      if (user && String(user.email || '').toLowerCase() !== email) {
        return sendJson(res, 400, { error: 'O usuario selecionado nao corresponde ao e-mail informado.' });
      }
    }
    if (!user) {
      user = await findUserByEmail(admin, email);
    }

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
        role: role === 'owner' ? 'admin' : role,
        permissions: {
          manage_users: role === 'owner' || role === 'admin',
          view_reports: role === 'owner' || role === 'admin',
          delete_records: role === 'owner' || role === 'admin',
          financial_view: role === 'owner' || role === 'admin',
          approve_purchases: role === 'owner' || role === 'admin',
        },
        module_permissions: {
          dashboard: true,
          eventos: true,
          cotacoes: true,
          compras: true,
          entregas: true,
          associados: true,
          fornecedores: true,
          veiculos: true,
          catalogo: true,
          relatorios: true,
          notificacoes: true,
          configuracoes: role === 'owner' || role === 'admin',
        },
      },
      { onConflict: 'tenant_id,user_id' },
    );
    if (memberError) throw memberError;

    await admin.from('profiles').upsert(
      {
        id: user.id,
        email,
        full_name: name,
        role: 'Usuário',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (role === 'owner') {
      const { error: ownerError } = await admin
        .from('saas_tenants')
        .update({ owner_id: user.id })
        .eq('id', tenantId);
      if (ownerError) throw ownerError;
    }

    // Cancela convites pendentes do mesmo e-mail nesta empresa (modelo antigo).
    await admin
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .eq('status', 'pending');

    // Confirma membership real antes de responder ok.
    const { data: confirmedMembers, error: confirmError } = await admin
      .from('organization_members')
      .select('id, tenant_id, role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId);
    if (confirmError) throw confirmError;
    if (!confirmedMembers || confirmedMembers.length === 0) {
      return sendJson(res, 500, {
        error: 'Usuario criado, mas o vinculo com a empresa nao foi confirmado. Tente novamente.',
      });
    }

    const loginUrl = `${process.env.APP_ORIGIN || process.env.VITE_APP_ORIGIN || 'https://eventos.escsistemas.com'}/login`;

    return sendJson(res, 200, {
      ok: true,
      created,
      loginUrl,
      message: created
        ? 'Membro criado. Ja pode entrar com e-mail e senha (sem confirmacao).'
        : 'Senha atualizada e acesso liberado para a conta selecionada.',
    });
  } catch (error) {
    console.error('[create-member]', error);
    const message = error?.message || 'Falha ao criar membro.';
    if (String(message).toLowerCase().includes('already') || String(message).toLowerCase().includes('registered')) {
      return sendJson(res, 409, { error: 'Este e-mail ja possui conta. Use Editar usuario para redefinir a senha.' });
    }
    if (message === 'MULTIPLE_AUTH_ACCOUNTS') {
      return sendJson(res, 409, { error: 'Existem contas duplicadas para este e-mail. Selecione o usuario exato na equipe antes de alterar o acesso.' });
    }
    return sendJson(res, 500, { error: 'Nao foi possivel criar ou atualizar o membro.' });
  }
}
