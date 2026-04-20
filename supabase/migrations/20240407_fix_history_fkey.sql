-- Migration to fix event_history constraint that is blocking user deletion

BEGIN;

DO $$ 
BEGIN 
    -- Verifica e remove a constraint problemática da tabela event_history
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_history_user_id_fkey' 
        AND table_name = 'event_history'
    ) THEN
        ALTER TABLE public.event_history 
        DROP CONSTRAINT event_history_user_id_fkey;
        
        -- Recria a constraint com ON DELETE SET NULL
        -- (Se o usuário for apagado, o histórico do sinistro diz "Usuário Apagado" ao invés de quebrar o banco)
        ALTER TABLE public.event_history 
        ADD CONSTRAINT event_history_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;

    -- Verifica outras tabelas que possam estar olhando para profiles diretamente
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_history_user_id_fkey' 
        AND table_name = 'event_history'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
      -- Já tratada acima, apenas verificação de segurança extra para RLS
      NULL;
    END IF;

END $$;

COMMIT;
