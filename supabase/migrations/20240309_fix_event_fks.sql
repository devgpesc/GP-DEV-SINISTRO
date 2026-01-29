
-- CORREÇÃO DE INTEGRIDADE REFERENCIAL (Eventos e Associados)
-- Execute este script no SQL Editor do Supabase

DO $$
BEGIN
    -- 1. REMOVER CONSTRAINTS ERRADAS
    -- Removemos possíveis nomes gerados automaticamente ou definidos anteriormente
    -- O erro indicava que associateId apontava para profiles, o que está incorreto.
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS "events_associateId_fkey";
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS "fk_event_associate";

    -- 2. CRIAR FK CORRETA PARA ASSOCIATEID
    -- Agora associateId aponta obrigatoriamente para a tabela associates
    ALTER TABLE public.events
    ADD CONSTRAINT "fk_events_associates_correct"
    FOREIGN KEY ("associateId")
    REFERENCES public.associates(id)
    ON DELETE RESTRICT; -- Impede deletar um cliente se ele tiver sinistros

    -- 3. VALIDAR CREATED_BY
    -- A coluna created_by já deve ter a FK para profiles. 
    -- Se não tiver, adicionamos. Se tiver, mantemos.
    -- O erro relatado "violates foreign key constraint events_created_by_fkey" ocorre 
    -- porque o código enviava 'system' (string) em vez de um UUID válido de perfil.
    
    -- Opcional: Garantir que a FK existe (caso tenha sido removida em testes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'events_created_by_fkey' 
        AND table_name = 'events'
    ) THEN
        ALTER TABLE public.events
        ADD CONSTRAINT "events_created_by_fkey"
        FOREIGN KEY (created_by)
        REFERENCES public.profiles(id);
    END IF;

END $$;

-- Recarrega configurações
NOTIFY pgrst, 'reload config';
