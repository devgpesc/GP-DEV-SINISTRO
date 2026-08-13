import { fetchAPIBrasil, fetchDetran } from '../_vehicle.js';
import { applyCors } from '../_lib/http.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (!applyCors(req, res)) return res.status(403).json({ error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) return res.status(401).json({ error: 'Faça login para consultar uma placa.' });
  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData?.user?.id) {
    return res.status(401).json({ error: 'Sua sessão expirou. Faça login novamente.' });
  }

  const { plate, provider = 'auto' } = req.query;

  if (!plate || String(plate).length < 7) {
    return res.status(400).json({ error: 'Placa invalida.' });
  }

  const cleanPlate = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cached = cache.get(cleanPlate);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true });
  }

  const errors = [];
  let result = null;

  try {
    if (provider === 'apibrasil') {
      result = await fetchAPIBrasil(cleanPlate);
    } else if (provider === 'detran') {
      result = await fetchDetran(cleanPlate);
    } else {
      try {
        result = await fetchAPIBrasil(cleanPlate);
      } catch (error) {
        errors.push(`APIBrasil: ${error.message}`);
        try {
          result = await fetchDetran(cleanPlate);
        } catch (fallbackError) {
          errors.push(`Detran: ${fallbackError.message}`);
          result = null;
        }
      }
    }

    if (!result) {
      const unavailable = errors.some((item) => item.includes('Credenciais APIBrasil nao configuradas'));
      if (unavailable) {
        return res.status(503).json({ error: 'Consulta veicular ainda nao configurada no servidor.' });
      }
      const billingBlocked = errors.some((item) => /saldo|balance|credito|credit|perfil|conta pj|pessoa juridica/i.test(item));
      if (billingBlocked) {
        return res.status(402).json({
          error: 'A consulta veicular esta sem saldo ou aguarda a liberacao cadastral da conta APIBrasil.',
        });
      }
      return res.status(404).json({ error: 'Veiculo nao encontrado em nenhuma base confiavel.', details: errors });
    }

    const returnedPlate = String(result.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!returnedPlate || returnedPlate !== cleanPlate || result.provider === 'Mock/Fallback') {
      return res.status(422).json({ error: 'A consulta retornou dados que nao correspondem a placa informada.' });
    }
    if (!String(result.brand || '').trim() || !String(result.model || '').trim()) {
      return res.status(422).json({ error: 'A base consultada nao retornou marca e modelo confiaveis para esta placa.' });
    }

    cache.set(cleanPlate, { data: result, timestamp: Date.now() });
    return res.json(result);
  } catch (error) {
    console.error('[vehicle-lookup]', error);
    const status = error.message?.includes('invalido') ? 401 : 500;
    return res.status(status).json({ error: status === 401 ? 'Credencial de consulta invalida.' : 'Nao foi possivel consultar o veiculo.' });
  }
}
