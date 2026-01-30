
-- MIGRATION: ADD MISSING AI COLUMNS TO SETTINGS
-- Data: 2024-03-30
-- Objetivo: Corrigir erro "Could not find the 'ai_model' column" ao salvar configurações.

DO $$
BEGIN
    -- 1. Adicionar coluna ai_provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_provider') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_provider text DEFAULT 'google';
    END IF;

    -- 2. Adicionar coluna ai_model
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_settings' AND column_name = 'ai_model') THEN
        ALTER TABLE public.saas_settings ADD COLUMN ai_model text DEFAULT 'gemini-3-pro-preview';
    END IF;

END $$;

-- Forçar recarregamento do schema cache para a API reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload config';
