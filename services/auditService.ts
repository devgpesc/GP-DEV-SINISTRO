
import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
  
  /**
   * Obtém metadados do cliente (IP, Local, Device)
   * Tenta usar múltiplas APIs públicas para IP com fallback robusto.
   */
  async getClientMetadata() {
    let metadata = {
        ip: 'Desconhecido',
        location: 'Desconhecido',
        userAgent: window.navigator.userAgent,
        os: 'Desconhecido',
        browser: 'Desconhecido',
        device: 'Desktop'
    };

    // Parse básico de User Agent
    try {
        const ua = metadata.userAgent;
        // OS
        if (ua.indexOf("Win") !== -1) metadata.os = "Windows";
        else if (ua.indexOf("Mac") !== -1) metadata.os = "MacOS";
        else if (ua.indexOf("Linux") !== -1) metadata.os = "Linux";
        else if (ua.indexOf("Android") !== -1) metadata.os = "Android";
        else if (ua.indexOf("like Mac") !== -1) metadata.os = "iOS";

        // Browser
        if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Edg") === -1 && ua.indexOf("OPR") === -1) metadata.browser = "Chrome";
        else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) metadata.browser = "Safari";
        else if (ua.indexOf("Firefox") !== -1) metadata.browser = "Firefox";
        else if (ua.indexOf("Edg") !== -1) metadata.browser = "Edge";
        else if (ua.indexOf("OPR") !== -1 || ua.indexOf("Opera") !== -1) metadata.browser = "Opera";

        // Device Type
        if (/Mobi|Android/i.test(ua)) metadata.device = 'Mobile';
    } catch (e) { console.warn("Erro parse UA", e); }

    // Captura de IP e Geolocalização (Multi-provider Fallback)
    try {
        // Tentativa 1: ipapi.co (Rico em detalhes, mas pode ser bloqueado)
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            metadata.ip = data.ip;
            metadata.location = `${data.city || ''}, ${data.region || ''} - ${data.country_code || ''}`;
        } else {
            throw new Error("ipapi failed");
        }
    } catch (e) {
        try {
            // Tentativa 2: ipify (Apenas IP)
            const res2 = await fetch('https://api.ipify.org?format=json');
            if (res2.ok) {
                const data2 = await res2.json();
                metadata.ip = data2.ip;
                metadata.location = 'Localização Indisponível (AdBlock/Privacy)';
            }
        } catch (e2) {
            console.warn("[Audit] Falha na captura de IP:", e2);
            metadata.ip = 'Oculto/VPN';
        }
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
            // Debug para desenvolvimento
            // console.log(`[Audit] ${action} em ${entity} registrado.`);
        }
    } catch (e) {
        console.error('[Audit] Erro crítico:', e);
    }
  },

  /**
   * Busca logs e popula manualmente os nomes de usuário para evitar problemas de FK
   */
  async getLogs(): Promise<AuditLog[]> {
    try {
        // 1. Busca os logs crus
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        if (!logs || logs.length === 0) return [];

        // 2. Extrai IDs de usuários únicos
        const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];

        // 3. Busca perfis manualmente (Manual Join)
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // 4. Mescla os dados
        return logs.map(log => ({
            ...log,
            profiles: profileMap.get(log.user_id) || { full_name: 'Usuário Desconhecido', email: 'N/A' }
        }));

    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        return [];
    }
  }
};
