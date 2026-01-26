
import { supabase } from './supabaseClient';
import { Event } from '../types';

export const eventService = {
  async getEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        history:event_history(*),
        attachments:event_attachments(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar eventos no Supabase:", error);
      return [];
    }
    return data || [];
  },

  async createEvent(eventData: Partial<Event>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      ...eventData,
      created_by: user?.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
