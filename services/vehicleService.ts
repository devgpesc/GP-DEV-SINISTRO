
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Vehicle } from '../types';

export const vehicleService = {
  async getVehicles() {
    if (!isSupabaseConfigured) return [];
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Verifica se um valor já existe em um campo específico
   * @returns true se existir duplicidade
   */
  async checkDuplicity(field: 'plate' | 'renavam' | 'chassi', value: string) {
    if (!isSupabaseConfigured || !value) return false;

    const formattedValue = value.toUpperCase().trim();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('id')
      .eq(field, formattedValue)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error(`Erro ao validar ${field}:`, error);
      return false;
    }
    
    return !!data;
  },

  async createVehicle(vehicleData: Partial<Vehicle>) {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

    const payload = {
      ...vehicleData,
      plate: vehicleData.plate?.toUpperCase().trim(),
      renavam: vehicleData.renavam?.trim(),
      chassi: vehicleData.chassi?.toUpperCase().trim(),
    };

    const { data, error } = await supabase
      .from('vehicles')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
