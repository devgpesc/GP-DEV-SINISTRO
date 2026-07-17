export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Api-Key');
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

export function serverError(res, message = 'Erro interno.') {
  return sendJson(res, 500, { error: message });
}
