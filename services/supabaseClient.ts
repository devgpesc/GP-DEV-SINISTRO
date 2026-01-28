
import { createClient } from '@supabase/supabase-js';

// Helper seguro para ler variáveis de ambiente em diferentes ambientes
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key];
  } catch {
    return undefined;
  }
};

const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Log amigável para debug (não bloqueia execução nem assusta o usuário no console)
if (!envUrl || !envKey) {
  console.warn('[AutoClaims] Variáveis de ambiente Supabase não detectadas. O sistema operará em MODO DEMONSTRAÇÃO com dados locais.');
}

// Exporta status da configuração real para a UI saber se deve bloquear funcionalidades ou usar mocks
export const isSupabaseConfigured = !!(envUrl && envKey);

// Define valores de fallback seguros para evitar que o createClient lance erro "supabaseUrl is required"
const supabaseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) 
  ? envUrl 
  : 'https://demo.supabase.co'; // URL fictícia válida sintaticamente

const supabaseAnonKey = (envKey && typeof envKey === 'string' && envKey.trim().length > 0) 
  ? envKey 
  : 'demo-key';

// Inicializa o cliente com valores garantidos (nunca vazio)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  global: {
    headers: { 'x-application-name': 'autoclaims-pro' },
  },
});

export const checkSupabaseConnection = async () => {
  // Se não estiver configurado (usando placeholder), retorna false imediatamente para ativar o fallback visual
  if (!isSupabaseConfigured) return false;
  
  try {
    // Timeout estendido para 15s para conexões lentas ou "Cold Starts"
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
    );

    // Tenta query leve para verificar conexão
    const queryPromise = supabase.from('events').select('id', { count: 'exact', head: true });

    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
        // Se conecta mas dá erro de tabela não encontrada ou permissão, o banco ESTÁ acessível.
        if (error.code || error.status === 401 || error.status === 403) {
            return true;
        }

        const msg = error.message?.toLowerCase() || '';
        // Erros de rede indicam falha real de conexão
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('failed')) {
            return false;
        }
    }
    return true;
  } catch (e: any) {
    // Se for timeout, assumimos que está ONLINE mas lento, para não bloquear o usuário.
    // O carregamento real dos dados lidará com o erro se persistir.
    if (e.message === 'Timeout') {
        console.warn('[Connection Check] Timeout na verificação inicial (Internet lenta ou DB acordando). Assumindo online.');
        return true; 
    }
    console.warn('[Connection Check] Falha de conexão:', e);
    return false;
  }
};
