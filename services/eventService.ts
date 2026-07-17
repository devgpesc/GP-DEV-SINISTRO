
import { supabase } from './supabaseClient';
import { Event } from '../types';
import { uploadEventAttachments, deleteEventAttachment, EventAttachment, normalizeAttachmentRow } from './attachmentService';

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
    return (data || []).map((event: any) => ({
      ...event,
      attachments: (event.attachments || []).map(normalizeAttachmentRow),
    }));
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
          try {
            await uploadEventAttachments(data.id, attachments as EventAttachment[]);
          } catch (attachmentError) {
            await supabase.from('event_history').delete().eq('event_id', data.id);
            await supabase.from('events').delete().eq('id', data.id);
            throw attachmentError;
          }
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
  },

  async deleteEvent(id: string) {
    const { data, error } = await supabase.rpc('delete_event_cascade', { p_event_id: id });

    if (error) {
      const fallback = await supabase.from('events').delete().eq('id', id).select('id');
      if (fallback.error) throw fallback.error;
      if (!fallback.data?.length) {
        throw new Error('Não foi possível excluir o sinistro. Verifique permissões ou vínculos ativos.');
      }
      return fallback.data[0];
    }

    return data;
  }
};
