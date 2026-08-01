import associates from './_associates.js';
import deliveries from './_deliveries.js';
import events from './_events.js';
import health from './_health.js';
import indexHandler from './_index.js';
import purchaseOrders from './_purchase-orders.js';
import quotations from './_quotations.js';
import { applyCors, sendJson } from '../_lib/http.js';

const routes = {
  '': indexHandler,
  health,
  events,
  quotations,
  'purchase-orders': purchaseOrders,
  deliveries,
  associates,
};

function resolvePath(req) {
  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean).join('/');
  if (typeof raw === 'string' && raw.trim()) return raw.trim().replace(/^\/+|\/+$/g, '');
  const urlPath = String(req.url || '')
    .split('?')[0]
    .replace(/^\/api\/v1\/?/, '')
    .replace(/^\/+|\/+$/g, '');
  return urlPath;
}

/**
 * Router unico para /api/v1/* (Hobby plan: max 12 serverless functions).
 */
export default async function handler(req, res) {
  if (!applyCors(req, res)) return sendJson(res, 403, { error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();

  const path = resolvePath(req);
  const target = routes[path];
  if (!target) {
    return sendJson(res, 404, {
      error: 'Rota v1 nao encontrada.',
      path,
      available: Object.keys(routes).filter(Boolean),
    });
  }
  return target(req, res);
}
