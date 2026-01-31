
import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
  
  async getClientMetadata() {
    let metadata = {
        ip: 'Desconhecido',
        location: 'Desconhecido',
        userAgent: window.navigator.userAgent,
        os: 'Desconhecido',
        browser: 'Desconhecido',
        device: 'Desktop'
    };

    try {
        const ua = metadata.userAgent;
        if (ua.indexOf("Win") !== -1) metadata.os = "Windows";
        else if (ua.indexOf("Mac") !== -1) metadata.os = "MacOS";
        else if (ua.indexOf("Linux") !== -1) metadata.os = "Linux";
        else if (ua.indexOf("Android") !== -1) metadata.os = "Android";
        else if (ua.indexOf("like Mac") !== -1) metadata.os = "iOS";

        if (/Mobi|Android/i.test(ua)) metadata.device = 'Mobile';
    } catch (e) { console.warn("Erro parse UA", e); }

    // IP Fetch com Timeout Rígido (2s)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            metadata.ip = data.ip;
            metadata.location = `${data.city || ''}, ${data.region || ''} - ${data.country_code || ''}`;
        }
    } catch (e) {
        // Silently fail to default
    }

    return metadata;
  },

  async log(action: string, entity: string, entityId: string, details: any = {}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meta = await this.getClientMetadata();
        const finalDetails = { ...details, ...meta };

        // Tenta inserir sem travar se falhar (Fire & Forget)
        supabase.from('audit_logs').insert([{
            action,
            entity,
            entity_id: entityId,
            details: finalDetails,
            user_id: user.id
        }]).then(({ error }) => {
            if (error) console.warn('[Audit] Insert failed:', error.message);
        });

    } catch (e) {
        console.error('[Audit] System Error:', e);
    }
  },

  async getLogs(): Promise<AuditLog[]> {
    try {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        if (!logs || logs.length === 0) return [];

        const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

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
