
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
   * NOTA: APIs de placa gratuitas são escassas/instáveis devido a dados sensíveis.
   * Para Produção Real, recomenda-se: APIBrasil, Infosimples ou OlhoNoCarro.
   * 
   * AQUI: Simulamos uma resposta realista baseada no final da placa para UX testing.
   */
  async fetchPlate(plate: string): Promise<PlateData | null> {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPlate.length !== 7) return null;

    // Simulação de delay de rede (UX Realista)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Lógica determinística para testes baseada no último dígito
    const lastChar = cleanPlate.slice(-1);
    const isNumber = !isNaN(parseInt(lastChar));
    
    // Base de dados simulada para testes ricos
    const mockDB: Record<string, PlateData> = {
      '1': { brand: 'TOYOTA', model: 'COROLLA XEI 2.0', year: '2023', color: 'BRANCA', chassi: '9BR...X882' },
      '2': { brand: 'HONDA', model: 'CIVIC TOURING 1.5T', year: '2022', color: 'PRATA', chassi: '93H...Y112' },
      '3': { brand: 'FIAT', model: 'STRADA VOLCANO', year: '2024', color: 'CINZA', chassi: '9BD...Z331' },
      '4': { brand: 'VOLKSWAGEN', model: 'T-CROSS HIGHLINE', year: '2023', color: 'AZUL', chassi: '9BW...A445' },
      '5': { brand: 'JEEP', model: 'COMPASS LIMITED', year: '2022', color: 'PRETO', chassi: '988...B556' },
      '6': { brand: 'HYUNDAI', model: 'HB20 PLATINUM', year: '2024', color: 'BRANCA', chassi: '9BH...C667' },
      '7': { brand: 'CHEVROLET', model: 'ONIX PREMIER', year: '2023', color: 'VERMELHO', chassi: '9BG...D778' },
      '8': { brand: 'RENAULT', model: 'KWID OUTSIDER', year: '2024', color: 'LARANJA', chassi: '93Y...E889' },
      '9': { brand: 'FORD', model: 'RANGER RAPTOR', year: '2023', color: 'AZUL', chassi: '8AF...F990' },
      '0': { brand: 'BYD', model: 'DOLPHIN EV', year: '2024', color: 'CINZA', chassi: 'LBV...G001' },
    };

    // Fallback genérico ou específico
    const key = isNumber ? lastChar : '1'; // Se terminar em letra (Mercosul), usa lógica do '1'
    return mockDB[key] || mockDB['1'];
  }
};
