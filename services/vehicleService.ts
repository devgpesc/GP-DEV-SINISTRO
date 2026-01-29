import { supabase } from './supabaseClient';
import { Vehicle } from '../types';

export const vehicleService = {
  async getVehicles(): Promise<Vehicle[]> {
    const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erro ao buscar veículos:', error);
        throw error;
    }
    return data || [];
  },

  async checkDuplicity(field: 'plate' | 'renavam' | 'chassi', value: string): Promise<boolean> {
    const formattedValue = value.toUpperCase().trim();
    if (!formattedValue) return false;

    const { data, error } = await supabase
    .from('vehicles')
    .select('id')
    .eq(field, formattedValue)
    .maybeSingle();
    
    if (error) {
        console.error(`Erro ao verificar duplicidade de ${field}:`, error);
        return false;
    }
    return !!data;
  },

  async createVehicle(vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    const payload = {
      ...vehicleData,
      plate: vehicleData.plate?.toUpperCase().trim(),
      renavam: vehicleData.renavam?.trim(),
      chassi: vehicleData.chassi?.toUpperCase().trim(),
      createdAt: new Date().toISOString()
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