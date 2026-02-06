
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
    // 1. AUTENTICAÇÃO OBRIGATÓRIA
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser();
    
    if (authError || !user || !user.id) {
        throw new Error('Sessão inválida. É necessário estar logado para registrar um sinistro.');
    }

    // 2. VALIDAÇÃO
    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo.');
    }

    // 3. PREPARAR PAYLOAD LIMPO (Remove campos que não são colunas da tabela events)
    const { attachments, history, id, ...cleanEventData } = eventData;

    const payload = {
      ...cleanEventData,
      created_by: user.id, 
      created_at: eventData.createdAt || new Date().toISOString(),
      vehicleId: eventData.vehicleId,
      associateId: eventData.associateId
    };

    // 4. INSERT REAL
    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    
    // 5. INSERIR HISTÓRICO INICIAL
    if (data && data.id) {
        await supabase.from('event_history').insert([{
            event_id: data.id,
            from_status: 'Criação',
            to_status: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user_id: user.id,
            created_at: new Date().toISOString()
        }]);
    }

    return data;
  },

  async updateEvent(id: string, eventData: Partial<Event>) {
    // 1. LIMPEZA DE DADOS (CRÍTICO: Remove attachments para evitar erro de coluna inexistente)
    const { attachments, history, id: _id, ...cleanEventData } = eventData;

    // 2. UPDATE SEGURO
    const { error } = await supabase
      .from('events')
      .update(cleanEventData)
      .eq('id', id);

    if (error) throw error;

    // TODO: Implementar lógica de salvar anexos na tabela 'event_attachments' aqui se necessário
    // Por enquanto, apenas evita o crash da aplicação.
  }
};
