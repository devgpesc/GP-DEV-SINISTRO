import { createHash } from 'node:crypto';
import { getSupabaseAdmin, getSupabaseForUser } from '../_lib/supabase.js';
import { applyCors, sendJson } from '../_lib/http.js';

const hashKey = (value) => createHash('sha256').update(value).digest('hex');

const requestIp = (req) => String(
  req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
).split(',')[0].trim();

async function consumeLimit(admin, key, limit, windowSeconds) {
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_key_hash: hashKey(key),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo nao permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const inviteToken = String(body.inviteToken || '').trim();
    if (inviteToken.length < 20) {
      return sendJson(res, 400, { error: 'Convite valido obrigatorio.' });
    }

    const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!accessToken) return sendJson(res, 401, { error: 'Sessao obrigatoria.' });

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData?.user?.id || !authData.user.email) {
      return sendJson(res, 401, { error: 'Sessao invalida. Faca login novamente.' });
    }

    const bodyEmail = String(body.email || '').trim().toLowerCase();
    const sessionEmail = String(authData.user.email).trim().toLowerCase();
    if (bodyEmail && bodyEmail !== sessionEmail) {
      return sendJson(res, 403, { error: 'O convite nao pertence a esta sessao.' });
    }

    const ip = requestIp(req);
    const [ipAllowed, userAllowed] = await Promise.all([
      consumeLimit(admin, `activate-invite:ip:${ip}`, 20, 15 * 60),
      consumeLimit(admin, `activate-invite:user:${authData.user.id}`, 10, 15 * 60),
    ]);
    if (!ipAllowed || !userAllowed) {
      return sendJson(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }

    const userClient = getSupabaseForUser(accessToken);
    const { error: inviteError } = await userClient.rpc('accept_invite', {
      invite_token: inviteToken,
    });
    if (inviteError) {
      const message = String(inviteError.message || '').toLowerCase();
      if (message.includes('outro e-mail')) {
        return sendJson(res, 403, { error: 'O convite nao pertence a esta sessao.' });
      }
      return sendJson(res, 409, { error: 'Convite invalido, cancelado ou ja utilizado.' });
    }

    return sendJson(res, 200, {
      ok: true,
      message: 'Conta vinculada a empresa.',
    });
  } catch (error) {
    console.error('[activate-invite]', error);
    return sendJson(res, 500, { error: 'Nao foi possivel ativar o convite.' });
  }
}
