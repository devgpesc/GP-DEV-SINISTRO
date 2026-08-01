
import { supabase } from './supabaseClient';
import { Event } from '../types';
import { uploadEventAttachments, deleteEventAttachment, EventAttachment, normalizeAttachmentRow } from './attachmentService';

const BUCKET = 'event-attachments';

async function rollbackCreatedEvent(eventId: string, uploadedPaths: string[]) {
  if (uploadedPaths.length) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await supabase.rpc('delete_event_cascade', { p_event_id: eventId });
}

export const eventService = {
  async getNextProtocol(tenantId?: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('next_event_protocol', {
      p_tenant_id: tenantId ?? null,
    });
    if (error) throw error;
    return String(data);
  },

  async getEvents(): Promise<Event[]> {
    const { error: escalationError } = await supabase.rpc('escalate_event_priorities');
    if (escalationError) {
      console.warn('[eventService] Falha ao escalar prioridades automaticamente:', escalationError);
    }

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

  async createEvent(eventData: Partial<Event>, options?: { tenantId?: string | null }) {
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser();
    
    if (authError || !user || !user.id) {
        throw new Error('Sessão inválida. É necessário estar logado para registrar um sinistro.');
    }

    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo.');
    }

    const { attachments, history, id, ...cleanEventData } = eventData;

    let protocol = cleanEventData.protocol;
    if (!protocol || String(protocol).startsWith('EVT-')) {
      protocol = await eventService.getNextProtocol(options?.tenantId);
    }

    const payload = {
      ...cleanEventData,
      protocol,
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
    
    if (data?.id) {
        const { error: historyError } = await supabase.from('event_history').insert([{
            event_id: data.id,
            from_status: 'Criação',
            to_status: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user_id: user.id,
            created_at: new Date().toISOString()
        }]);

        if (historyError) {
          await rollbackCreatedEvent(data.id, []);
          throw historyError;
        }

        if (attachments?.length) {
          try {
            await uploadEventAttachments(data.id, attachments as EventAttachment[]);
          } catch (attachmentError) {
            await rollbackCreatedEvent(data.id, []);
            throw attachmentError;
          }
        }
    }

    return data;
  },

  async updateEvent(id: string, eventData: Partial<Event>) {
    const { attachments, history, id: _id, ...cleanEventData } = eventData;
    const { data: before } = await supabase
      .from('events')
      .select('priority, priority_score')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('events')
      .update(cleanEventData)
      .eq('id', id);

    if (error) throw error;

    if (
      before &&
      ((cleanEventData as any).priority && (cleanEventData as any).priority !== before.priority ||
        (cleanEventData as any).priority_score && (cleanEventData as any).priority_score !== before.priority_score)
    ) {
      const { data: { user } } = await (supabase.auth as any).getUser();
      await supabase.from('event_history').insert([{
        event_id: id,
        from_status: `${before.priority || 'Sem prioridade'} (${before.priority_score || '-'})`,
        to_status: `${(cleanEventData as any).priority || before.priority} (${(cleanEventData as any).priority_score || before.priority_score || '-'})`,
        comment: 'Prioridade alterada manualmente.',
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      }]);
    }

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
