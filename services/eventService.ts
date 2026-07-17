
import { supabase } from './supabaseClient';
import { Event } from '../types';
import { uploadEventAttachments, deleteEventAttachment, EventAttachment } from './attachmentService';

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
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser();
    
    if (authError || !user || !user.id) {
        throw new Error('Sessão inválida. É necessário estar logado para registrar um sinistro.');
    }

    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo.');
    }

    const { attachments, history, id, ...cleanEventData } = eventData;

    const payload = {
      ...cleanEventData,
      created_by: user.id, 
      created_at: eventData.createdAt || new Date().toISOString(),
      vehicleId: eventData.vehicleId,
      associateId: eventData.associateId
    };

    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    
    if (data && data.id) {
        await supabase.from('event_history').insert([{
            event_id: data.id,
            from_status: 'Criação',
            to_status: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user_id: user.id,
            created_at: new Date().toISOString()
        }]);

        if (attachments?.length) {
          await uploadEventAttachments(data.id, attachments as EventAttachment[]);
        }
    }

    return data;
  },

  async updateEvent(id: string, eventData: Partial<Event>) {
    const { attachments, history, id: _id, ...cleanEventData } = eventData;

    const { error } = await supabase
      .from('events')
      .update(cleanEventData)
      .eq('id', id);

    if (error) throw error;

    if (attachments) {
      const incoming = attachments as EventAttachment[];
      const newOnes = incoming.filter(a => a.isNew && a.file);
      if (newOnes.length) {
        await uploadEventAttachments(id, newOnes);
      }
    }
  },

  async removeAttachment(id: string, url?: string) {
    await deleteEventAttachment(id, url);
  }
};
