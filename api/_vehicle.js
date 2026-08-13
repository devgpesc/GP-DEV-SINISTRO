const APIBRASIL_URL = process.env.APIBRASIL_URL || 'https://gateway.apibrasil.io/api/v2';

export class VehicleProviderError extends Error {
  constructor(message, status = 502, provider = 'APIBrasil') {
    super(message);
    this.name = 'VehicleProviderError';
    this.status = status;
    this.provider = provider;
  }
}

function vehiclePayload(source) {
  const envelope = source?.response ?? source?.data ?? source ?? {};
  const nested = envelope?.data ?? envelope?.dados ?? envelope?.vehicle ?? envelope;
  return Array.isArray(nested) ? (nested[0] || {}) : nested;
}

function readField(payload, aliases) {
  const normalized = new Map(
    Object.entries(payload || {}).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function providerMessage(data, fallback) {
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data?.data?.message === 'string' && data.data.message.trim()) return data.data.message.trim();
  return fallback;
}

export function normalizeVehicleData(source, provider) {
  if (provider === 'apibrasil') {
    const payload = vehiclePayload(source);
    return {
      plate: readField(payload, ['placa', 'plate']),
      brand: readField(payload, ['marca', 'brand', 'marca_veiculo']),
      model: readField(payload, ['modelo', 'model', 'modelo_veiculo']),
      version: readField(payload, ['versao', 'version', 'submodelo']),
      yearFab: readField(payload, ['ano_fabricacao', 'anoFabricacao', 'yearFab', 'ano']),
      yearModel: readField(payload, ['ano_modelo', 'anoModelo', 'yearModel', 'modelo_ano']),
      color: readField(payload, ['cor', 'color']),
      fuel: readField(payload, ['combustivel', 'fuel']),
      type: readField(payload, ['tipo', 'especie', 'type', 'tipo_veiculo']),
      chassi: readField(payload, ['chassi', 'chassis']),
      renavam: readField(payload, ['renavam']),
      uf: readField(payload, ['uf', 'estado']),
      city: readField(payload, ['municipio', 'cidade', 'city']),
      status: readField(payload, ['situacao', 'status']) || 'Regular',
      provider: 'APIBrasil',
      queryCost: source?.valor_consulta,
      balance: source?.balance,
    };
  }

  if (provider === 'detran') {
    return {
      plate: source.plate,
      brand: source.brand_name,
      model: source.model_name,
      yearFab: source.manufacturing_year,
      yearModel: source.model_year,
      color: source.color_name,
      fuel: source.fuel_type,
      chassi: source.vin,
      renavam: source.renavam_code,
      uf: source.state,
      city: source.city,
      status: source.status,
      provider: 'Detran-SP',
    };
  }

  throw new Error(`Provedor veicular nao suportado: ${provider}`);
}

export async function fetchAPIBrasil(plate, customToken) {
  const token = customToken || process.env.APIBRASIL_BEARER_TOKEN || process.env.APIBRASIL_TOKEN;
  const deviceToken = process.env.APIBRASIL_DEVICE_TOKEN;
  if (!token) throw new Error('Credenciais APIBrasil nao configuradas');

  // A APIBrasil possui duas modalidades para os mesmos dados:
  // plano/device em /vehicles/dados e credito avulso em /consulta/veiculos/credits.
  const baseUrl = APIBRASIL_URL.replace(/\/+$/, '').replace(/\/vehicles$/i, '');
  const route = deviceToken ? '/vehicles/dados' : '/consulta/veiculos/credits';
  const homolog = /^(1|true)$/i.test(String(process.env.APIBRASIL_HOMOLOG || ''));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(deviceToken ? { DeviceToken: deviceToken } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ placa: plate, ...(homolog ? { homolog: true } : {}) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new VehicleProviderError(
      providerMessage(data, `Falha na consulta veicular (HTTP ${response.status})`),
      response.status,
    );
  }
  if (data?.error === true) {
    throw new VehicleProviderError(providerMessage(data, 'Erro retornado pela consulta veicular'), 422);
  }
  return normalizeVehicleData(data, 'apibrasil');
}

export async function fetchDetran(plate) {
  void plate;
  throw new Error('Consulta ao Detran ainda nao configurada.');
}
