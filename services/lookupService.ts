
/**
 * Serviço de Consultas Externas (Lookup)
 * Centraliza as chamadas para APIs de terceiros para enriquecimento de dados.
 */

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

interface CnpjData {
  name: string;
  fantasy?: string;
  city: string;
  state: string;
  zip: string;
  address: string;
  neighborhood: string;
  email?: string;
  phone?: string;
}

interface PlateData {
  plate: string;
  brand: string;
  model: string;
  version: string;
  yearFab: string;
  yearModel: string;
  color: string;
  chassi: string;
  renavam?: string;
  fuel: string;
  type: string;
  city: string;
  uf: string;
  fipe_price?: number;
}

export const lookupService = {
  /**
   * Busca dados de CNPJ usando a BrasilAPI
   */
  async fetchCNPJ(cnpj: string): Promise<CnpjData | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) throw new Error('CNPJ não encontrado');
      const data = await response.json();
      
      return {
        name: data.razao_social,
        fantasy: data.nome_fantasia,
        city: data.municipio,
        state: data.uf,
        zip: data.cep,
        address: `${data.logradouro}, ${data.numero}`,
        neighborhood: data.bairro,
        email: data.email,
        phone: data.ddd_telefone_1
      };
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      return null;
    }
  },

  /**
   * Busca dados de Placa.
   * Prioridade: Backend Real -> Mock Determinístico
   */
  async fetchPlate(plate: string): Promise<PlateData | null> {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPlate.length !== 7) return null;

    // 1. Tentar buscar do Backend Real (se configurado)
    try {
        // Verifica se estamos em ambiente que suporta a chamada real ou se o backend existe
        // Para fins deste código, tentaremos fazer o fetch.
        // Se falhar (404/500/Network), caímos no mock.
        if ((import.meta as any).env?.VITE_USE_REAL_API === 'true') {
            const response = await fetch(`${API_BASE_URL}/vehicles/lookup?plate=${cleanPlate}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    plate: data.placa,
                    brand: data.marca,
                    model: data.modelo,
                    version: data.versao || data.modelo,
                    yearFab: data.ano_fabricacao,
                    yearModel: data.ano_modelo,
                    color: data.cor,
                    chassi: data.chassi,
                    renavam: data.renavam,
                    fuel: data.combustivel,
                    type: data.tipo_veiculo,
                    city: data.municipio,
                    uf: data.uf,
                    fipe_price: data.valor_fipe
                };
            }
        }
    } catch (e) {
        console.warn('API Real falhou, usando Mock.', e);
    }

    // 2. Mock Determinístico (Fallback/Dev Mode)
    // Simulação de delay de rede
    await new Promise(resolve => setTimeout(resolve, 800));

    const brands = ['TOYOTA', 'HONDA', 'VOLKSWAGEN', 'FIAT', 'CHEVROLET', 'FORD', 'HYUNDAI', 'JEEP', 'RENAULT', 'NISSAN', 'BMW', 'MERCEDES-BENZ'];
    const modelsByBrand: Record<string, string[]> = {
      'TOYOTA': ['COROLLA XEI 2.0', 'YARIS XS', 'HILUX SRV', 'COROLLA CROSS'],
      'HONDA': ['CIVIC TOURING', 'HR-V EXL', 'CITY EX', 'CR-V'],
      'VOLKSWAGEN': ['T-CROSS HIGHLINE', 'NIVUS', 'POLO TRACK', 'VIRTUS'],
      'FIAT': ['STRADA VOLCANO', 'TORO FREEDOM', 'PULSE', 'FASTBACK'],
      'CHEVROLET': ['ONIX PREMIER', 'TRACKER', 'S10 LTZ', 'CRUZE'],
      'FORD': ['RANGER LIMITED', 'MAVERICK', 'TERRITORY', 'MUSTANG'],
      'HYUNDAI': ['HB20 PLATINUM', 'CRETA ULTIMATE', 'TUCSON', 'HB20S'],
      'JEEP': ['COMPASS LIMITED', 'RENEGADE', 'COMMANDER', 'WRANGLER'],
      'RENAULT': ['KWID OUTSIDER', 'DUSTER ICONIC', 'OROCH', 'KARDIAN'],
      'NISSAN': ['KICKS EXCLUSIVE', 'VERSA', 'SENTRA', 'FRONTIER'],
      'BMW': ['320I M SPORT', 'X1', 'X3', 'X5'],
      'MERCEDES-BENZ': ['C300 AMG LINE', 'GLA 200', 'GLC 300', 'A200']
    };
    
    const colors = ['BRANCA', 'PRETO', 'PRATA', 'CINZA', 'VERMELHO', 'AZUL PEROLIZADO', 'LARANJA SOLAR'];
    const fuels = ['FLEX', 'GASOLINA', 'DIESEL', 'HÍBRIDO', 'ELÉTRICO'];
    const ufs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'GO', 'DF', 'BA'];
    const types = ['AUTOMOVEL', 'CAMIONETA', 'UTILITARIO'];

    // Gerar seed numérico baseado na placa
    const seed = cleanPlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const brand = brands[seed % brands.length];
    const availableModels = modelsByBrand[brand];
    const model = availableModels[seed % availableModels.length];
    const color = colors[seed % colors.length];
    
    const yearBase = 2020 + (seed % 5);
    const yearFab = yearBase.toString();
    const yearModel = (yearBase + (seed % 2)).toString(); // Ano modelo pode ser igual ou +1
    
    const chassiPrefix = '9' + brand.substring(0, 2) + cleanPlate.substring(0, 3);
    const chassiSuffix = seed.toString().padStart(6, '0');
    const chassi = (chassiPrefix + chassiSuffix).substring(0, 17).padEnd(17, '0');
    
    const renavam = (seed * 123456).toString().substring(0, 11).padEnd(11, '0');

    return {
      plate: cleanPlate,
      brand,
      model,
      version: `${model} ${1.0 + (seed % 20)/10}`,
      yearFab,
      yearModel,
      color,
      chassi: chassi.toUpperCase(),
      renavam,
      fuel: fuels[seed % fuels.length],
      type: types[seed % types.length],
      city: 'SÃO PAULO', // Simplificação para o mock
      uf: ufs[seed % ufs.length]
    };
  }
};
