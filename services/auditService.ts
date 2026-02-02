
import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
  
  async getClientMetadata() {
    let metadata = {
        ip: 'Indisponível',
        location: 'Indisponível',
        userAgent: window.navigator.userAgent,
        os: 'Desconhecido',
        browser: 'Desconhecido',
        device: 'Desktop'
    };

    try {
        const ua = metadata.userAgent;
        // OS Detection
        if (ua.indexOf("Win") !== -1) metadata.os = "Windows";
        else if (ua.indexOf("Mac") !== -1) metadata.os = "MacOS";
        else if (ua.indexOf("Linux") !== -1) metadata.os = "Linux";
        else if (ua.indexOf("Android") !== -1) metadata.os = "Android";
        else if (ua.indexOf("like Mac") !== -1) metadata.os = "iOS";

        // Browser Detection
        if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Edg") === -1 && ua.indexOf("OPR") === -1) metadata.browser = "Chrome";
        else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) metadata.browser = "Safari";
        else if (ua.indexOf("Firefox") !== -1) metadata.browser = "Firefox";
        else if (ua.indexOf("Edg") !== -1) metadata.browser = "Edge";
        else if (ua.indexOf("OPR") !== -1 || ua.indexOf("Opera") !== -1) metadata.browser = "Opera";

        // Device Type
        if (/Mobi|Android|iPhone/i.test(ua)) metadata.device = 'Mobile';
    } catch (e) { console.warn("Erro parse UA", e); }

    // IP Fetch com Multi-Provider Fallback
    try {
        // Tentativa 1: ipapi.co (Rico em dados: IP + Local)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            metadata.ip = data.ip || 'Detectado';
            metadata.location = `${data.city || ''}, ${data.region_code || ''}`;
        } else {
            throw new Error('ipapi limit/error');
        }
    } catch (e) {
        // Tentativa 2: ipify (Apenas IP, mais confiável)
        try {
            const res2 = await fetch('https://api.ipify.org?format=json');
            if (res2.ok) {
                const data2 = await res2.json();
                metadata.ip = data2.ip;
                // Localização fica como 'Indisponível'
            }
        } catch (e2) {
            console.warn('[Audit] Falha total na captura de IP.');
        }
    }

    return metadata;
  },

  async log(action: string, entity: string, entityId: string, details: any = {}) {
    try {
        // Casting supabase.auth to any to avoid missing getUser error
        const { data: { user } } = await (supabase.auth as any).getUser();
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
