
-- MIGRATION: FIX AI SETTINGS SCHEMA
-- Data: 2024-03-30
-- Objetivo: Adicionar colunas ai_provider e ai_model para corrigir erro de salvamento nas Configurações.

DO $$
BEGIN
    -- 1. Adicionar coluna ai_provider (google, openai, etc)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_provider') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_provider text DEFAULT 'google';
    END IF;

    -- 2. Adicionar coluna ai_model (versão do modelo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_model') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_model text DEFAULT 'gemini-3-pro-preview';
    END IF;

    -- 3. Garantir que as colunas de chaves existam (caso a migration anterior tenha falhado)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'openai_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN openai_key text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'gemini_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN gemini_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'anthropic_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN anthropic_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'groq_key') THEN
        ALTER TABLE public.saas_settings ADD COLUMN groq_key text;
    END IF;

END $$;

-- Forçar recarregamento do schema cache para a API reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload config';
