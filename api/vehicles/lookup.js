import { fetchAPIBrasil, fetchDetran, fetchMock } from '../_vehicle.js';

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const { plate, provider = 'auto' } = req.query;
  const customToken = req.headers['x-provider-token'];

  if (!plate || String(plate).length < 7) {
    return res.status(400).json({ error: 'Placa invalida.' });
  }

  const cleanPlate = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!customToken) {
    const cached = cache.get(cleanPlate);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ ...cached.data, cached: true });
    }
  }

  const errors = [];
  let result = null;

  try {
    if (provider === 'apibrasil') {
      result = await fetchAPIBrasil(cleanPlate, customToken);
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
          result = await fetchMock(cleanPlate);
        }
      }
    }

    if (!result) {
      return res.status(404).json({ error: 'Veiculo nao encontrado em nenhuma base.', details: errors });
    }

    if (!customToken) cache.set(cleanPlate, { data: result, timestamp: Date.now() });
    return res.json(result);
  } catch (error) {
    const status = error.message?.includes('invalido') ? 401 : 500;
    return res.status(status).json({ error: error.message, details: errors });
  }
}
