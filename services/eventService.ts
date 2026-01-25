import { supabase, mockStorage, isSupabaseConfigured } from './supabaseClient';
import { Event, EventStatus } from '../types';
import { MOCK_EVENTS } from '../constants';

export const eventService = {
  async getEvents(): Promise<Event[]> {
    if (!isSupabaseConfigured) return mockStorage.get('events') || MOCK_EVENTS;

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        history:event_history(*),
        attachments:event_attachments(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn("Erro Supabase, usando fallback:", error);
      return mockStorage.get('events') || MOCK_EVENTS;
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

    if (!isSupabaseConfigured) {
      // Fix: mockStorage does not have an 'append' method. Implementing append logic using get and set.
      const currentEvents = mockStorage.get('events') || MOCK_EVENTS;
      const newEvent = { 
        id: Math.random().toString(36).substr(2, 9), 
        ...payload 
      };
      const updatedEvents = [newEvent, ...currentEvents];
      mockStorage.set('events', updatedEvents);
      return newEvent as any;
    }

    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};