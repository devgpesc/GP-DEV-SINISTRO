
import { supabase } from './supabaseClient';
import { Event, EventStatus } from '../types';

export const eventService = {
  async getEvents() {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        history:event_history(*),
        attachments:event_attachments(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createEvent(eventData: Partial<Event>) {
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateStatus(eventId: string, currentStatus: EventStatus, nextStatus: EventStatus, comment: string) {
    const { data: userData } = await supabase.auth.getUser();
    
    // Iniciar transação lógica (updates em paralelo no Supabase)
    const updateEvent = supabase
      .from('events')
      .update({ status: nextStatus, updated_at: new Date() })
      .eq('id', eventId);

    const insertHistory = supabase
      .from('event_history')
      .insert([{
        event_id: eventId,
        from_status: currentStatus,
        to_status: nextStatus,
        comment: comment,
        user_id: userData.user?.id
      }]);

    const [resEvent, resHistory] = await Promise.all([updateEvent, insertHistory]);
    
    if (resEvent.error) throw resEvent.error;
    if (resHistory.error) throw resHistory.error;
    
    return true;
  },

  async uploadAttachment(eventId: string, file: File) {
    const { data: userData } = await supabase.auth.getUser();
    const filePath = `events/${eventId}/${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('event-attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('event-attachments')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('event_attachments')
      .insert([{
        event_id: eventId,
        file_name: file.name,
        file_type: file.type,
        file_path: urlData.publicUrl,
        uploaded_by: userData.user?.id
      }]);

    if (dbError) throw dbError;
    return urlData.publicUrl;
  }
};
