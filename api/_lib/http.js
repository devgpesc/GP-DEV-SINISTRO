const normalizeOrigin = (value) => String(value || '').trim().replace(/\/$/, '');

function allowedOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const defaults = [
    'https://eventos.escsistemas.com',
    'https://gp-dev-sinistro.vercel.app',
    process.env.VITE_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].map(normalizeOrigin).filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    defaults.push('http://127.0.0.1:5173', 'http://localhost:5173');
  }
  return new Set([...defaults, ...configured]);
}

export function applyCors(req, res) {
  const origin = normalizeOrigin(req?.headers?.origin);
  res.setHeader('Vary', 'Origin');

  if (origin && !allowedOrigins().has(origin)) {
    return false;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Api-Key');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function methodNotAllowed(res, allowed = 'GET') {
  res.setHeader('Allow', allowed);
  return sendJson(res, 405, { error: 'Metodo nao permitido.' });
}

export function unauthorized(res, message = 'Nao autorizado.') {
  return sendJson(res, 401, { error: message });
}

export function badRequest(res, message) {
  return sendJson(res, 400, { error: message });
}

export function serverError(res) {
  return sendJson(res, 500, { error: 'Nao foi possivel concluir a solicitacao.' });
}
