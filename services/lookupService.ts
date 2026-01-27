
/**
 * Serviço de Consultas Externas (Lookup)
 * Centraliza as chamadas para APIs de terceiros para enriquecimento de dados.
 */

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
  brand: string;
  model: string;
  year: string;
  color: string;
  chassi: string;
  fipe_price?: number;
}

export const lookupService = {
  /**
   * Busca dados de CNPJ usando a BrasilAPI (Gratuita e Real)
   */
  async fetchCNPJ(cnpj: string): Promise<CnpjData | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        throw new Error('CNPJ não encontrado ou serviço indisponível');
      }

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
   * Algoritmo de Mock Determinístico: Gera dados consistentes para qualquer placa válida
   * para garantir que o usuário sempre tenha uma experiência positiva no modo Demo/Teste.
   */
  async fetchPlate(plate: string): Promise<PlateData | null> {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Validação básica de formato (Mercosul ou Antiga: 7 chars)
    if (cleanPlate.length !== 7) return null;

    // Simulação de delay de rede (UX Realista)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Base de dados de Mock
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
    const colors = ['BRANCA', 'PRETO', 'PRATA', 'CINZA', 'VERMELHO', 'AZUL', 'LARANJA'];

    // Gerar seed numérico baseado na placa para garantir consistência (mesma placa = mesmo carro)
    const seed = cleanPlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Selecionar dados baseados no seed
    const brandIndex = seed % brands.length;
    const brand = brands[brandIndex];
    
    const availableModels = modelsByBrand[brand];
    const modelIndex = seed % availableModels.length;
    const model = availableModels[modelIndex];
    
    const color = colors[seed % colors.length];
    const year = (2020 + (seed % 5)).toString(); // Anos entre 2020 e 2024
    
    // Gerar Chassi Fake realista
    const chassiPrefix = '9' + brand.substring(0, 2) + cleanPlate.substring(0, 3);
    const chassiSuffix = seed.toString().padStart(6, '0');
    const chassi = (chassiPrefix + chassiSuffix).substring(0, 17).padEnd(17, '0');

    return {
      brand,
      model,
      year,
      color,
      chassi: chassi.toUpperCase()
    };
  }
};
