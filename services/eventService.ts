
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
    // 1. AUTENTICAÇÃO OBRIGATÓRIA (Critical Fix)
    // Não permite criação sem usuário real, pois viola FK created_by -> profiles
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser();
    
    if (authError || !user || !user.id) {
        throw new Error('Sessão inválida. É necessário estar logado para registrar um sinistro.');
    }

    // 2. VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
    if (!eventData.vehicleId || !eventData.associateId) {
        throw new Error('É obrigatório vincular um Associado e um Veículo para criar um sinistro.');
    }

    // 3. CONSISTÊNCIA DE DADOS (Veículo pertence ao Associado?)
    const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('associate_id') 
        .eq('id', eventData.vehicleId)
        .single();
    
    if (vehicleError || !vehicle) {
        console.error('Erro detalhado busca veículo:', vehicleError);
        throw new Error('Veículo selecionado não encontrado na base de dados.');
    }

    const dbOwnerId = vehicle.associate_id || (vehicle as any).associateId;

    if (dbOwnerId !== eventData.associateId) {
        throw new Error('Inconsistência: O veículo selecionado não pertence ao associado informado.');
    }

    // 4. PREPARAR PAYLOAD LIMPO
    // Removemos campos relacionais, IDs indefinidos e garantimos created_by correto
    const { attachments, history, id, ...cleanEventData } = eventData;

    const payload = {
      ...cleanEventData,
      // CORREÇÃO: Envia estritamente o UUID do usuário logado.
      // Isso satisfaz a constraint "events_created_by_fkey"
      created_by: user.id, 
      created_at: eventData.createdAt || new Date().toISOString(),
      // Garante que as chaves estrangeiras estejam explicitamente no payload
      vehicleId: eventData.vehicleId,
      associateId: eventData.associateId
    };

    // 5. INSERT REAL
    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    
    if (error) {
        console.error("Erro Supabase Insert:", error);
        // Tratamento de erro amigável para FKs
        if (error.message?.includes('violates foreign key constraint')) {
            if (error.message?.includes('created_by')) throw new Error('Erro de Permissão: Seu usuário não tem perfil válido no sistema.');
            if (error.message?.includes('associate')) throw new Error('Erro de Vínculo: O Associado informado não existe.');
            if (error.message?.includes('vehicle')) throw new Error('Erro de Vínculo: O Veículo informado não existe.');
        }
        throw error;
    }
    
    // 6. INSERIR HISTÓRICO INICIAL
    if (data && data.id) {
        const { error: historyError } = await supabase.from('event_history').insert([{
            event_id: data.id,
            from_status: 'Criação',
            to_status: 'Aguardando',
            comment: 'Evento registrado via Portal.',
            user_id: user.id,
            created_at: new Date().toISOString()
        }]);

        if (historyError) {
             console.warn('Aviso: Histórico inicial não persistido.', historyError);
        }
    }

    return data;
  }
};
