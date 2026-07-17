import { getSupabaseAdmin } from './supabase.js';
import { unauthorized } from './http.js';

function extractApiKey(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (header && String(header).toLowerCase().startsWith('bearer ')) {
    return String(header).slice(7).trim();
  }
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  if (req.query?.api_key) return String(req.query.api_key).trim();
  return null;
}

export async function authenticateApiRequest(req, res, requiredScope = 'read') {
  const rawKey = extractApiKey(req);
  if (!rawKey) {
    unauthorized(res, 'Informe a chave via Authorization: Bearer <API_KEY> ou header X-Api-Key.');
    return null;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('validate_api_key', { p_raw_key: rawKey });

    if (error || !data) {
      unauthorized(res, 'Chave de API invalida ou revogada.');
      return null;
    }

    const scopes = Array.isArray(data.scopes) ? data.scopes : ['read'];
    if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes('admin')) {
      unauthorized(res, `Escopo insuficiente. Requer: ${requiredScope}.`);
      return null;
    }

    return {
      tenantId: data.tenant_id,
      keyId: data.key_id,
      scopes,
      name: data.name,
    };
  } catch (error) {
    console.error('[API Auth]', error);
    unauthorized(res, 'Falha na autenticacao da API.');
    return null;
  }
}
