
-- MIGRATION: SECURITY HARDENING (Correção de Vulnerabilidades RLS)
-- Data: 2024-02-27
-- Objetivo: Revogar acesso público (Anon) a dados sensíveis e chaves de API.

-- =========================================================
-- 1. PROTEGER TABELA DE CONFIGURAÇÕES (CRÍTICO)
-- Contém chaves de API (OpenAI, Gemini, etc). NUNCA deve ser pública.
-- =========================================================

-- Remove políticas antigas inseguras (que usavam 'true' para todos)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.saas_settings;
DROP POLICY IF EXISTS "Enable insert/update for all users" ON public.saas_settings;

-- Novas políticas: Apenas usuários LOGADOS podem ler/editar
CREATE POLICY "Secure: Authenticated Read Only" 
ON public.saas_settings FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Secure: Authenticated Update Only" 
ON public.saas_settings FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Secure: Authenticated Insert Only" 
ON public.saas_settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- =========================================================
-- 2. PROTEGER DADOS PESSOAIS (ASSOCIADOS - LGPD)
-- Contém CPF, Email, Telefone.
-- =========================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON public.associates;

CREATE POLICY "Secure: Authenticated Read Only" 
ON public.associates FOR SELECT 
USING (auth.role() = 'authenticated');


-- =========================================================
-- 3. PROTEGER DADOS DE FROTA (VEÍCULOS)
-- Contém Placas e Renavam.
-- =========================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicles;

CREATE POLICY "Secure: Authenticated Read Only" 
ON public.vehicles FOR SELECT 
USING (auth.role() = 'authenticated');


-- =========================================================
-- 4. REFORÇO DE PERMISSÕES GERAIS
-- Garante que o RLS esteja ativo em todas as tabelas críticas
-- =========================================================

ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Nota: Para usuários novos (Super Admin), certifique-se de que a trigger
-- de criação de perfil (profiles) esteja funcionando para garantir acesso correto.
