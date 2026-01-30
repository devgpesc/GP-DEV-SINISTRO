
-- MIGRATION: REAL NOTIFICATIONS
-- Cria tabela para armazenar histórico de alertas

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text,
    type text DEFAULT 'info', -- 'info', 'warning', 'success', 'error', 'action'
    read boolean DEFAULT false,
    link text,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;

-- Usuário vê apenas as suas
CREATE POLICY "Users read own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

-- Usuário pode marcar como lida (update)
CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- Permitir inserção (pode ser restrito depois, por enquanto aberto para funções do sistema)
CREATE POLICY "System insert notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- Recarrega schema
NOTIFY pgrst, 'reload config';
