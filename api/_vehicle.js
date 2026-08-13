const APIBRASIL_URL = process.env.APIBRASIL_URL || 'https://gateway.apibrasil.io/api/v2/vehicles';

export function normalizeVehicleData(source, provider) {
  if (provider === 'apibrasil') {
    const payload = source?.response?.data || source?.response || source?.data?.data || source?.data || source || {};
    return {
      plate: payload.placa || payload.plate,
      brand: payload.marca || payload.brand,
      model: payload.modelo || payload.model,
      version: payload.versao || payload.version,
      yearFab: payload.ano_fabricacao || payload.anoFabricacao || payload.yearFab,
      yearModel: payload.ano_modelo || payload.anoModelo || payload.yearModel,
      color: payload.cor || payload.color,
      fuel: payload.combustivel || payload.fuel,
      type: payload.tipo || payload.especie || payload.type,
      chassi: payload.chassi || payload.chassis,
      renavam: payload.renavam,
      uf: payload.uf,
      city: payload.municipio || payload.cidade || payload.city,
      status: payload.situacao || payload.status || 'Regular',
      provider: 'APIBrasil',
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(`${APIBRASIL_URL}/dados`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(deviceToken ? { DeviceToken: deviceToken } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ placa: plate }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error('Token APIBrasil invalido ou expirado.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`APIBrasil: ${data?.message || 'Falha na consulta veicular'}`);
  if (data?.error) throw new Error(`APIBrasil: ${data.message || 'Erro desconhecido'}`);
  return normalizeVehicleData(data, 'apibrasil');
}

export async function fetchDetran(plate) {
  void plate;
  throw new Error('Consulta ao Detran ainda nao configurada.');
}
