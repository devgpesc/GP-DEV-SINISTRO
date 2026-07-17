import { applyCors, sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

  return sendJson(res, 200, {
    name: 'EventsCar Public API',
    version: 'v1',
    documentation: `${baseUrl}/docs/API-INTEGRACAO.md`,
    endpoints: [
      { method: 'GET', path: '/api/v1/health', auth: false },
      { method: 'GET', path: '/api/v1/events', auth: true, scopes: ['read'] },
      { method: 'GET', path: '/api/v1/quotations', auth: true, scopes: ['read'] },
      { method: 'GET', path: '/api/v1/purchase-orders', auth: true, scopes: ['read'] },
      { method: 'GET', path: '/api/v1/deliveries', auth: true, scopes: ['read'] },
      { method: 'GET', path: '/api/v1/associates', auth: true, scopes: ['read'] },
    ],
    auth: {
      type: 'api_key',
      headers: ['Authorization: Bearer evsc_live_...', 'X-Api-Key: evsc_live_...'],
    },
  });
}
