
import { supabase, isSupabaseConfigured, mockStorage } from './supabaseClient';
import { Vehicle } from '../types';
import { MOCK_VEHICLES } from '../constants';

export const vehicleService = {
  async getVehicles(): Promise<Vehicle[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) return data || [];
    }
    
    // Fallback para LocalStorage se offline ou Supabase não configurado
    return mockStorage.get('vehicles') || MOCK_VEHICLES;
  },

  async checkDuplicity(field: 'plate' | 'renavam' | 'chassi', value: string): Promise<boolean> {
    const formattedValue = value.toUpperCase().trim();
    if (!formattedValue) return false;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id')
        .eq(field, formattedValue)
        .maybeSingle();
      
      if (!error && data) return true;
    }
    
    // Verificação local no LocalStorage
    const localVehicles: Vehicle[] = mockStorage.get('vehicles') || MOCK_VEHICLES;
    return localVehicles.some(v => (v[field] as string)?.toUpperCase() === formattedValue);
  },

  async createVehicle(vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    const payload = {
      id: Math.random().toString(36).substr(2, 9),
      ...vehicleData,
      plate: vehicleData.plate?.toUpperCase().trim(),
      renavam: vehicleData.renavam?.trim(),
      chassi: vehicleData.chassi?.toUpperCase().trim(),
      createdAt: new Date().toISOString()
    } as Vehicle;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([payload])
          .select()
          .single();
        if (!error) return data;
      } catch (e) {
        console.warn("Falha ao salvar no Supabase, salvando localmente...");
      }
    }

    // Persistência robusta no LocalStorage
    const currentVehicles = mockStorage.get('vehicles') || MOCK_VEHICLES;
    const updatedVehicles = [payload, ...currentVehicles];
    mockStorage.set('vehicles', updatedVehicles);
    
    return payload;
  }
};
