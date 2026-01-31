
import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
  
  /**
   * Obtém metadados do cliente (IP, Local, Device)
   * Tenta usar uma API pública para IP, com fallback silencioso.
   */
  async getClientMetadata() {
    let metadata = {
        ip: 'Desconhecido',
        location: 'Desconhecido',
        userAgent: window.navigator.userAgent,
        os: 'Desconhecido',
        browser: 'Desconhecido'
    };

    // Parse básico de User Agent
    try {
        const ua = metadata.userAgent;
        if (ua.indexOf("Win") !== -1) metadata.os = "Windows";
        if (ua.indexOf("Mac") !== -1) metadata.os = "MacOS";
        if (ua.indexOf("Linux") !== -1) metadata.os = "Linux";
        if (ua.indexOf("Android") !== -1) metadata.os = "Android";
        if (ua.indexOf("like Mac") !== -1) metadata.os = "iOS";

        if (ua.indexOf("Chrome") !== -1) metadata.browser = "Chrome";
        else if (ua.indexOf("Safari") !== -1) metadata.browser = "Safari";
        else if (ua.indexOf("Firefox") !== -1) metadata.browser = "Firefox";
        else if (ua.indexOf("Edge") !== -1) metadata.browser = "Edge";
    } catch (e) { console.warn("Erro parse UA", e); }

    // Captura de IP e Geolocalização (Via API pública para evitar backend)
    // Nota: Em produção corporativa, o IP idealmente vem do header da requisição no backend.
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            metadata.ip = data.ip;
            metadata.location = `${data.city}, ${data.region} - ${data.country_code}`;
        }
    } catch (e) {
        console.warn("[Audit] Falha ao obter IP/Geo (Blocker de Ads ou Offline)", e);
    }

    return metadata;
  },

  /**
   * Registra uma ação no log de auditoria com metadados ricos
   */
  async log(action: string, entity: string, entityId: string, details: any = {}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Coleta metadados enriquecidos
        const meta = await this.getClientMetadata();

        // Mescla detalhes do negócio com metadados técnicos
        const finalDetails = {
            ...details,
            ...meta
        };

        const { error } = await supabase.from('audit_logs').insert([{
            action,
            entity,
            entity_id: entityId,
            details: finalDetails,
            user_id: user.id
        }]);

        if (error) {
            console.warn('[Audit] Falha ao registrar no banco:', error.message);
        } else {
            console.log(`[Audit] ${action} em ${entity} registrado com sucesso.`);
        }
    } catch (e) {
        console.error('[Audit] Erro crítico:', e);
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
