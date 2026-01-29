
-- MIGRATION: AUDITORIA E GESTÃO DE CONVITES
-- Execute no SQL Editor do Supabase

-- 1. Tabela de Auditoria (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL, -- Ex: 'Create', 'Update', 'Delete'
    entity text NOT NULL, -- Ex: 'User', 'PurchaseOrder'
    entity_id text,
    details jsonb, -- Dados alterados (Snapshot)
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabela de Convites (Invitations)
CREATE TABLE IF NOT EXISTS public.invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    name text,
    role text DEFAULT 'Usuário',
    status text DEFAULT 'pending', -- 'pending', 'accepted'
    token text, -- Opcional, para validação futura
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Habilitar Segurança (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso - Auditoria
-- Apenas Admins podem ver logs
CREATE POLICY "Admins Read Logs" ON public.audit_logs
FOR SELECT USING (
    exists (
        select 1 from public.profiles
        where id = auth.uid() and role IN ('Admin', 'super_admin')
    )
);

-- Usuários autenticados podem inserir (registrar suas ações)
CREATE POLICY "Auth Users Insert Logs" ON public.audit_logs
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Políticas de Acesso - Convites
-- Admins e Gerentes podem gerenciar convites
CREATE POLICY "Manage Invites" ON public.invitations
FOR ALL USING (
    exists (
        select 1 from public.profiles
        where id = auth.uid() and role IN ('Admin', 'super_admin', 'Gerente')
    )
);

-- Recarregar configurações da API
NOTIFY pgrst, 'reload config';
