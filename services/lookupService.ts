

import { Vehicle } from '../types';
import { supabase } from './supabaseClient';

/**
 * Serviço de Lookup Veicular
 * 
 * ATENÇÃO: Este serviço consome o backend local (/api/vehicles/lookup)
 * para evitar expor chaves de API no frontend.
 */

// URL Base do Backend (Vite Proxy ou URL direta)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export const normalizeVehiclePlate = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isValidVehiclePlate = (plate: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizeVehiclePlate(plate));

export const lookupService = {
  /**
   * Consulta placa no backend seguro.
   * Suporta strategy 'auto' (padrão), 'apibrasil', ou 'detran'.
   */
  async fetchPlate(plate: string, provider: 'auto' | 'apibrasil' | 'detran' = 'auto'): Promise<Partial<Vehicle>> {
    const cleanPlate = normalizeVehiclePlate(plate);
    if (!isValidVehiclePlate(cleanPlate)) throw new Error('Informe uma placa brasileira válida.');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Faça login para consultar uma placa.');

      // Chamada ao Backend (Não chama API externa direto)
      const response = await fetch(`${API_BASE}/vehicles/lookup?plate=${cleanPlate}&provider=${provider}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível consultar a placa.');
      }

      const returnedPlate = String(data.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (returnedPlate !== cleanPlate || data.provider === 'Mock/Fallback') {
        throw new Error('A consulta retornou dados de outra placa e foi descartada.');
      }
      if (!String(data.brand || '').trim() || !String(data.model || '').trim()) {
        throw new Error('A consulta não retornou marca e modelo confiáveis.');
      }

      // Mapeamento para o formato Vehicle do Frontend (Já normalizado pelo Backend, mas garantindo tipagem)
      return {
        plate: data.plate,
        brand: data.brand,
        model: data.model,
        version: data.version,
        year_fab: data.yearFab,
        year_model: data.yearModel,
        color: data.color,
        fuel: data.fuel,
        type: data.type,
        chassi: data.chassi,
        renavam: data.renavam,
        uf: data.uf,
        city: data.city,
      };

    } catch (error: any) {
      console.error("Erro de conexão com serviço de placas:", error);
      throw new Error(error?.message || 'Não foi possível consultar a placa.');
    }
  },

  /**
   * Consulta dados de CNPJ no backend ou API Pública.
   */
  async fetchCNPJ(cnpj: string): Promise<{name?: string, fantasy?: string, city?: string, email?: string, phone?: string, cep?: string, address?: string} | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      // 1. Tenta Backend Local (Prioridade para Cache e Chaves Privadas)
      // Usamos um timeout curto para não travar a UI se o backend não estiver rodando
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch(`${API_BASE}/cnpj/lookup?cnpj=${cleanCnpj}`, {
         signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
         return await response.json();
      }
      
      throw new Error('Backend inacessível ou erro na API local');

    } catch (error) {
      console.warn("Backend offline ou falha. Tentando API Pública (BrasilAPI)...", error);
      
      // 2. Fallback: BrasilAPI (Grátis, Pública, Sem Auth)
      try {
        const responsePublic = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (!responsePublic.ok) return null;

        const data = await responsePublic.json();
        
        return {
          name: data.razao_social,
          fantasy: data.nome_fantasia || data.razao_social,
          city: data.municipio,
          email: data.email,
          phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : '',
          cep: data.cep,
          address: data.logradouro ? `${data.logradouro}${data.numero ? `, ${data.numero}` : ''}` : undefined
        };
      } catch (e) {
        console.error("Erro definitivo na busca de CNPJ:", e);
        return null;
      }
    }
  },

  async fetchCEP(cep: string): Promise<{ address?: string; city?: string; cep?: string } | null> {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return null;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await response.json();
      if (data.erro) return null;
      return {
        cep: clean,
        address: `${data.logradouro || ''}${data.bairro ? `, ${data.bairro}` : ''}`.trim(),
        city: `${data.localidade || ''} - ${data.uf || ''}`.trim()
      };
    } catch {
      return null;
    }
  }
};
