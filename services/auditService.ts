
import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
  /**
   * Registra uma ação no log de auditoria
   */
  async log(action: string, entity: string, entityId: string, details: any = {}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Tenta inserir. Se a tabela não existir, falha silenciosamente no console para não quebrar a app
        const { error } = await supabase.from('audit_logs').insert([{
            action,
            entity,
            entity_id: entityId,
            details,
            user_id: user.id
        }]);

        if (error) {
            console.warn('Falha ao registrar auditoria (verifique se a tabela existe):', error.message);
        }
    } catch (e) {
        console.error('Erro no serviço de auditoria:', e);
    }
  },

  /**
   * Busca logs (apenas para admins, garantido por RLS)
   */
  async getLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
        console.error('Erro ao buscar logs:', error);
        return [];
    }
    return data || [];
  }
};
