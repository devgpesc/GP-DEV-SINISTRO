import { supabase } from './supabaseClient';

export type ApiKeyRecord = {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
};

export type CreatedApiKey = ApiKeyRecord & { key: string };

export const apiKeyService = {
  async list(tenantId: string): Promise<ApiKeyRecord[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, tenant_id, name, key_prefix, scopes, created_at, last_used_at, revoked_at')
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      scopes: Array.isArray(row.scopes) ? row.scopes : ['read'],
    }));
  },

  async create(tenantId: string, name: string, scopes: string[] = ['read']): Promise<CreatedApiKey> {
    const { data, error } = await supabase.rpc('create_tenant_api_key', {
      p_tenant_id: tenantId,
      p_name: name,
      p_scopes: scopes,
    });

    if (error) throw error;
    return data as CreatedApiKey;
  },

  async revoke(keyId: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_tenant_api_key', { p_key_id: keyId });
    if (error) throw error;
  },
};
