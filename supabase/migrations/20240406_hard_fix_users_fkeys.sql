-- Migration to ensure all foreign keys referencing auth.users have ON DELETE CASCADE or SET NULL

BEGIN;

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu 
              ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu 
              ON ccu.constraint_name = tc.constraint_name 
        WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users' AND ccu.table_schema = 'auth'
    ) LOOP
        -- Remove the old constraint
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
        
        -- Default strategy: CASCADE for profiles and mapping tables, SET NULL for business entities creating records
        IF r.table_name IN ('profiles', 'organization_members', 'audit_logs', 'notifications', 'invitations') THEN
             EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE', r.table_name, r.constraint_name, r.column_name);
        ELSE
             EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.table_name, r.constraint_name, r.column_name);
        END IF;

    END LOOP;
END $$;

COMMIT;
