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
    // 1. VALIDAÇÃO DE VÍNCULO OBRIGATÓRIO
    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo para criar um sinistro.');
    }

    // 2. Verificar consistência no Banco de Dados
    const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('associateId')
        .eq('id', eventData.vehicleId)
        .single();
    
    if (vehicleError || !vehicle) {
        throw new Error('Veículo selecionado não encontrado na base de dados.');
    }

    if (vehicle.associateId !== eventData.associateId) {
        throw new Error('Inconsistência: O veículo selecionado não pertence ao associado informado.');
    }

    // Fix: Cast auth to any to support v2 methods despite v1 types
    const { data: { user } } = await (supabase.auth as any).getUser();
    
    // 3. Preparar payload (remove campos relacionais virtuais se existirem)
    const { attachments, history, ...cleanEventData } = eventData;

    const payload = {
      ...cleanEventData,
      created_by: user?.id || 'system',
      created_at: eventData.createdAt || new Date().toISOString(),
    };

    // 4. Insert Real
    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    
    // 5. Inserir Histórico Inicial (Se houver tabela event_history)
    // Ignoramos erro aqui para não bloquear o fluxo principal se a tabela não existir ainda
    if (data && data.id) {
        const { error: historyError } = await supabase.from('event_history').insert([{
            event_id: data.id,
            from_status: 'Criação',
            to_status: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user_id: user?.id,
            created_at: new Date().toISOString()
        }]);

        if (historyError) {
             console.warn('Histórico não persistido (tabela pode não existir):', historyError);
        }
    }

    return data;
  }
};