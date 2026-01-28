
import { supabase, mockStorage } from './supabaseClient';
import { Event, Vehicle, Associate } from '../types';

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
    // VALIDAÇÃO DE REGRA DE NEGÓCIO: VÍNCULO OBRIGATÓRIO
    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo para criar um sinistro.');
    }

    // Verificar se Veículo pertence ao Associado (Integridade)
    // Em produção, isso seria uma query ou constraint do banco. Aqui simulamos com storage.
    const vehicles = mockStorage.get('vehicles') as Vehicle[] || [];
    const targetVehicle = vehicles.find(v => v.id === eventData.vehicleId);
    
    if (!targetVehicle) {
        throw new Error('Veículo selecionado não encontrado na base.');
    }

    if (targetVehicle.associateId !== eventData.associateId) {
        throw new Error('Inconsistência: O veículo selecionado não pertence ao associado informado.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    // Preparar payload limpando campos de relacionamento que não são colunas da tabela events
    const { attachments, history, ...cleanEventData } = eventData;

    const payload = {
      ...cleanEventData,
      id: eventData.id || Math.random().toString(36).substr(2, 9),
      created_by: user?.id || 'system',
      created_at: eventData.createdAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;
    
    // Tratamento de Attachments e History (Deveriam ser inserts separados em tabelas relacionadas)
    // Em mock/local storage, mantemos a estrutura aninhada para compatibilidade de visualização
    const fullPayload = {
        ...payload,
        attachments: attachments || [],
        history: history || [{
            id: Math.random().toString(36).substr(2, 9),
            fromStatus: 'Criação',
            toStatus: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user: user?.email || 'Sistema',
            timestamp: new Date().toISOString()
        }]
    };
    
    // Atualiza Mock Storage Local (para garantir que a UI reflita a mudança imediatamente em modo offline)
    const currentEvents = mockStorage.get('events') || [];
    // Remove se for update, adiciona novo
    const filtered = currentEvents.filter((e: Event) => e.id !== payload.id);
    mockStorage.set('events', [fullPayload, ...filtered]);

    return data || fullPayload;
  }
};
