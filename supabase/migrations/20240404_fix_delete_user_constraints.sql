
-- MIGRATION: FIX DELETE USER CONSTRAINTS (SAFE MODE)
-- Data: 2024-04-04
-- Objetivo: Permitir a exclusão de usuários do auth.users sem violação de Foreign Key.
-- Verifica se as tabelas existem antes de aplicar as alterações.

BEGIN;

-- 1. AUDIT LOGS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
        ALTER TABLE public.audit_logs
        ADD CONSTRAINT audit_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 2. PROFILES
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. SAAS TENANTS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_tenants') THEN
        ALTER TABLE public.saas_tenants DROP CONSTRAINT IF EXISTS saas_tenants_owner_id_fkey;
        ALTER TABLE public.saas_tenants
        ADD CONSTRAINT saas_tenants_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. PURCHASE ORDERS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
        ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
        ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 5. EVENTS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
        ALTER TABLE public.events
        ADD CONSTRAINT events_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 6. INVITATIONS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
        ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_created_by_fkey;
        ALTER TABLE public.invitations
        ADD CONSTRAINT invitations_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 7. ORGANIZATION MEMBERS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
        ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
        ALTER TABLE public.organization_members
        ADD CONSTRAINT organization_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 8. SUPPLIER REVIEWS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_reviews') THEN
        ALTER TABLE public.supplier_reviews DROP CONSTRAINT IF EXISTS supplier_reviews_user_id_fkey;
        ALTER TABLE public.supplier_reviews
        ADD CONSTRAINT supplier_reviews_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 9. NOTIFICATIONS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
        ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- Recarrega cache
NOTIFY pgrst, 'reload config';
