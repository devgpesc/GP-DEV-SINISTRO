
import { createClient } from '@supabase/supabase-js';

const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!envUrl || !envKey) {
  console.error('[CRITICAL] Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.');
}

// Exporta status da configuração real para a UI saber se deve bloquear ou mostrar erro
export const isSupabaseConfigured = !!(envUrl && envKey);

// Usa valores placeholder se as variáveis não existirem para evitar crash do app (Uncaught Error: supabaseUrl is required)
// Isso permite que a UI carregue e mostre a mensagem de erro apropriada em vez de uma tela branca.
const supabaseUrl = envUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = envKey || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Usa localStorage APENAS para o token JWT do Supabase Auth
  },
  global: {
    headers: { 'x-application-name': 'autoclaims-pro' },
  },
});

export const checkSupabaseConnection = async () => {
  // Se não estiver configurado (sem variáveis), retorna false imediatamente
  if (!isSupabaseConfigured) return false;
  
  try {
    // Timeout de 5s para não prender a UI
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    // Tenta uma query leve em uma tabela que certamente existe (events)
    // Usamos 'head: true' para não baixar dados, apenas verificar existência/acesso
    const queryPromise = supabase.from('events').select('id', { count: 'exact', head: true });

    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
        // Se tem 'code', é um erro do Postgres/Supabase (Ex: 42P01 tabela não existe, 401 permissão)
        // Isso significa que CONECTAMOS ao servidor com sucesso.
        if (error.code) {
            console.warn('[Connection Check] Conectado com erro SQL:', error.code, error.message);
            return true;
        }

        const msg = error.message?.toLowerCase() || '';
        // Se for erro de rede (fetch failed, network error), aí sim é Offline
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('failed')) {
            console.error('[Connection Check] Falha de Rede:', error);
            return false;
        }
    }
    return true;
  } catch (e: any) {
    console.error('[Connection Check] Exceção:', e);
    return false;
  }
};
