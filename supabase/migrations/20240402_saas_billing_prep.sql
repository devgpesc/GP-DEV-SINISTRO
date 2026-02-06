
-- MIGRATION: SAAS BILLING PREP & SELF-SERVICE RLS
-- Data: 2024-04-02
-- Objetivo: Preparar campos para futuro billing e permitir que usuários criem suas empresas.

BEGIN;

-- 1. ADICIONAR CAMPOS DE BILLING (Sem quebrar dados existentes)
-- Usamos IF NOT EXISTS para garantir idempotência

DO $$
BEGIN
    -- Status da Assinatura
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'subscription_status') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN subscription_status text DEFAULT 'trial';
    END IF;

    -- ID da Assinatura (Stripe/Asaas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'subscription_id') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN subscription_id text;
    END IF;

    -- Fim do Trial
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'trial_ends_at') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN trial_ends_at timestamp with time zone DEFAULT (now() + interval '14 days');
    END IF;

    -- Ciclo de Faturamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'billing_cycle') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN billing_cycle text DEFAULT 'monthly'; -- monthly, yearly
    END IF;

    -- Cancelamento Agendado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'cancel_at') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN cancel_at timestamp with time zone;
    END IF;
    
    -- Fim do Período Atual
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_tenants' AND column_name = 'current_period_end') THEN
        ALTER TABLE public.saas_tenants ADD COLUMN current_period_end timestamp with time zone;
    END IF;
END $$;

-- 2. AJUSTAR RLS PARA PERMITIR ONBOARDING (Self-Service)
-- O usuário autenticado precisa ter permissão para CRIAR um tenant.
-- Atualmente, as policies podem estar restritas apenas a leitura/update de tenants onde ele já é membro.

DROP POLICY IF EXISTS "Auth Users Create Tenants" ON public.saas_tenants;

CREATE POLICY "Auth Users Create Tenants" ON public.saas_tenants
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated' AND
    owner_id = auth.uid() -- Garante que ele só pode criar se ele for o dono
);

-- 3. AJUSTAR RLS PARA ORGANIZATION_MEMBERS (Self-Link)
-- O usuário precisa conseguir se inserir como membro do tenant que acabou de criar.

DROP POLICY IF EXISTS "Auth Users Create Memberships" ON public.organization_members;

CREATE POLICY "Auth Users Create Memberships" ON public.organization_members
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated' AND
    user_id = auth.uid() -- Só pode inserir a si mesmo (convites usam outra lógica ou function admin)
);

COMMIT;

NOTIFY pgrst, 'reload config';
