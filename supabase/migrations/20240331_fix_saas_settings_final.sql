
-- MIGRATION: FINAL FIX FOR SAAS SETTINGS
-- Data: 2024-03-31
-- Objetivo: Garantir colunas de IA e permissões de escrita (Upsert).

DO $$
BEGIN
    -- 1. Criar tabela se não existir
    CREATE TABLE IF NOT EXISTS public.saas_settings (
        id integer PRIMARY KEY DEFAULT 1,
        company_name text,
        logo_url text,
        updated_at timestamp with time zone,
        -- Chaves e Configs
        ai_provider text DEFAULT 'google',
        ai_model text DEFAULT 'gemini-3-pro-preview',
        openai_key text,
        gemini_key text,
        anthropic_key text,
        groq_key text
    );

    -- 2. Garantir colunas (Add if not exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_provider') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_provider text DEFAULT 'google';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_model') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_model text DEFAULT 'gemini-3-pro-preview';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'openai_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN openai_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'gemini_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN gemini_key text;
    END IF;

END $$;

-- 3. Resetar e Corrigir RLS (Policies)
ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.saas_settings;
DROP POLICY IF EXISTS "Enable insert/update for all users" ON public.saas_settings;
DROP POLICY IF EXISTS "Secure: Authenticated Read Only" ON public.saas_settings;
DROP POLICY IF EXISTS "Secure: Authenticated Update Only" ON public.saas_settings;
DROP POLICY IF EXISTS "Secure: Authenticated Insert Only" ON public.saas_settings;

-- Política ÚNICA e PERMISSIVA para usuários autenticados (Leitura e Escrita)
-- Isso resolve problemas de bloqueio ao salvar configurações.
CREATE POLICY "Authenticated Users Full Access Settings" 
ON public.saas_settings 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
