const APIBRASIL_URL = process.env.APIBRASIL_URL || 'https://gateway.apibrasil.com.br/api/v2/vehicles';

export function normalizeVehicleData(source, provider) {
  if (provider === 'apibrasil') {
    return {
      plate: source.placa,
      brand: source.marca,
      model: source.modelo,
      yearFab: source.ano_fabricacao,
      yearModel: source.ano_modelo,
      color: source.cor,
      fuel: source.combustivel,
      chassi: source.chassi,
      renavam: source.renavam,
      uf: source.uf,
      city: source.municipio,
      status: source.situacao || 'Regular',
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

  return {
    plate: source.plate,
    brand: source.brand,
    model: source.model,
    yearFab: source.yearFab,
    yearModel: source.yearModel,
    color: source.color,
    fuel: source.fuel,
    provider: 'Mock/Fallback',
  };
}

export async function fetchAPIBrasil(plate, customToken) {
  const token = customToken || process.env.APIBRASIL_TOKEN;
  if (!token) throw new Error('Credenciais APIBrasil nao configuradas');

  const response = await fetch(`${APIBRASIL_URL}/dados`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ placa: plate }),
  });

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error('Token APIBrasil invalido ou expirado.');
  }

  const data = await response.json();
  if (data?.error) throw new Error(`APIBrasil: ${data.message || 'Erro desconhecido'}`);
  return normalizeVehicleData(data, 'apibrasil');
}

export async function fetchMock(plate) {
  if (plate === 'AAA0000') return null;

  return normalizeVehicleData({
    plate,
    brand: 'TOYOTA',
    model: 'COROLLA XEI',
    yearFab: '2023',
    yearModel: '2024',
    color: 'PRATA',
    fuel: 'FLEX',
  }, 'mock');
}

export async function fetchDetran(plate) {
  if (!process.env.DETRAN_API_KEY) throw new Error('Credenciais Detran nao configuradas');

  return normalizeVehicleData({
    plate,
    brand_name: 'HONDA',
    model_name: 'CIVIC TOURING',
    manufacturing_year: '2023',
    model_year: '2023',
    color_name: 'BRANCA',
    fuel_type: 'GASOLINA',
    vin: '93H...........',
    renavam_code: '123456789',
    state: 'SP',
    city: 'SANTOS',
    status: 'EM CIRCULACAO',
  }, 'detran');
}
