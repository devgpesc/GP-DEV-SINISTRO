
-- CORREÇÃO CRÍTICA: VALOR PADRÃO PARA ID DE EVENTOS
-- Execute este script no SQL Editor do Supabase para corrigir o erro "null value in column id violates not-null constraint"

DO $$
BEGIN
    -- 1. Garante que a extensão pgcrypto ou uuid-ossp esteja ativa para gerar UUIDs
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- 2. Altera a coluna ID da tabela events para ter um valor padrão automático
    -- Se o frontend não enviar o ID, o banco gera um novo UUID v4
    ALTER TABLE public.events 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

    -- 3. Verifica se existe alguma sequência órfã ou configuração errada e remove a obrigatoriedade temporariamente se necessário, 
    -- mas o ideal é manter NOT NULL e ter o DEFAULT.
    -- (O comando acima já resolve 99% dos casos)

END $$;

-- Recarrega configurações para garantir que a API reflita a mudança
NOTIFY pgrst, 'reload config';
