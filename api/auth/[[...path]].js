import activateInvite from './_activate-invite.js';
import createMember from './_create-member.js';
import deleteMember from './_delete-member.js';
import purgeUser from './_purge-user.js';
import sessionAccess from './_session-access.js';
import { applyCors, sendJson } from '../_lib/http.js';

const routes = {
  'activate-invite': activateInvite,
  'create-member': createMember,
  'delete-member': deleteMember,
  'purge-user': purgeUser,
  'session-access': sessionAccess,
};

function resolvePath(req) {
  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean).join('/');
  if (typeof raw === 'string' && raw.trim()) return raw.trim().replace(/^\/+|\/+$/g, '');
  const urlPath = String(req.url || '')
    .split('?')[0]
    .replace(/^\/api\/auth\/?/, '')
    .replace(/^\/+|\/+$/g, '');
  return urlPath;
}

/**
 * Router unico para /api/auth/* (Hobby plan: max 12 serverless functions).
 * Exemplos: /api/auth/create-member, /api/auth/session-access
 */
export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();

  const path = resolvePath(req);
  const target = routes[path];
  if (!target) {
    return sendJson(res, 404, {
      error: 'Rota auth nao encontrada.',
      path,
      available: Object.keys(routes),
    });
  }
  return target(req, res);
}
