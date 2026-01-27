
import { Vehicle } from '../types';

/**
 * Serviço de Lookup Veicular
 * 
 * ATENÇÃO: Este serviço consome o backend local (/api/vehicles/lookup)
 * para evitar expor chaves de API no frontend.
 */

// URL Base do Backend (Vite Proxy ou URL direta)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export const lookupService = {
  /**
   * Consulta placa no backend seguro.
   */
  async fetchPlate(plate: string): Promise<Partial<Vehicle> | null> {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPlate.length !== 7) return null;

    try {
      // Chamada ao Backend (Não chama API externa direto)
      const response = await fetch(`${API_BASE}/vehicles/lookup?plate=${cleanPlate}`);
      
      if (!response.ok) {
        if (response.status === 404) console.warn('Veículo não encontrado.');
        return null;
      }

      const data = await response.json();

      // Mapeamento para o formato Vehicle do Frontend
      return {
        plate: data.plate,
        brand: data.brand,
        model: data.model,
        version: data.version,
        yearFab: data.yearFab,
        yearModel: data.yearModel,
        color: data.color,
        fuel: data.fuel,
        type: data.type,
        chassi: data.chassi,
        renavam: data.renavam,
        uf: data.uf,
        city: data.city,
      };

    } catch (error) {
      console.error("Erro de conexão com serviço de placas:", error);
      return null;
    }
  },

  /**
   * Consulta dados de CNPJ no backend.
   */
  async fetchCNPJ(cnpj: string): Promise<{name?: string, fantasy?: string, city?: string, email?: string, phone?: string} | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await fetch(`${API_BASE}/cnpj/lookup?cnpj=${cleanCnpj}`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Erro de conexão com serviço de CNPJ:", error);
      return null;
    }
  }
};
