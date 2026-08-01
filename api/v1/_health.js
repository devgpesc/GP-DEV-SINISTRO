import { applyCors, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  return sendJson(res, 200, {
    ok: true,
    service: 'EventsCar API',
    version: 'v1',
    timestamp: new Date().toISOString(),
  });
}
