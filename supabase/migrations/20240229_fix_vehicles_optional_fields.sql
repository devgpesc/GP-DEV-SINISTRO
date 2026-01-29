
-- CORREÇÃO PARA VEÍCULOS (Tornar Chassi e Renavam Opcionais)
-- Executar no SQL Editor do Supabase

ALTER TABLE public.vehicles ALTER COLUMN renavam DROP NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN chassi DROP NOT NULL;

-- Recarregar cache de esquema
NOTIFY pgrst, 'reload config';
