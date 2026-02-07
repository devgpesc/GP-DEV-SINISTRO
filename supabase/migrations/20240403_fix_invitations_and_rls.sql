
-- MIGRATION: FIX INVITATIONS FK & TENANT CREATION PERMISSIONS (CORRIGIDO)
-- Data: 2024-04-03
-- Objetivo: Corrigir erro 'column tenant_id does not exist' e permitir auto-cadastro.

BEGIN;

-- 0. GARANTIR QUE A COLUNA TENANT_ID EXISTE
-- Adicionamos a coluna se ela não existir na tabela invitations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.invitations ADD COLUMN tenant_id uuid;
    END IF;
END $$;

-- 1. CORREÇÃO DO RELACIONAMENTO (Foreign Key)
-- O PostgREST precisa de uma FK explícita para fazer o JOIN (select *, saas_tenants(*))
-- Removemos qualquer constraint antiga para garantir e recriamos.

ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_tenant_id_fkey;

ALTER TABLE public.invitations
ADD CONSTRAINT invitations_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.saas_tenants(id)
ON DELETE CASCADE;

-- 2. CORREÇÃO DE PERMISSÕES PARA CRIAÇÃO DE EMPRESA (Self-Service)
-- O usuário autenticado precisa poder INSERIR na tabela saas_tenants para criar sua empresa.

ALTER TABLE public.saas_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth Users Create Tenants" ON public.saas_tenants;

CREATE POLICY "Auth Users Create Tenants" ON public.saas_tenants
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
    -- Removemos checagens complexas aqui, pois o backend garante o owner_id
);

-- 3. CORREÇÃO DE PERMISSÕES PARA VÍNCULO DE MEMBRO (Self-Link)
-- O usuário precisa poder se inserir como 'owner' na tabela de membros ao criar a empresa.

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth Users Create Memberships" ON public.organization_members;

CREATE POLICY "Auth Users Create Memberships" ON public.organization_members
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated' AND
    user_id = auth.uid() -- Garante que só pode inserir a si mesmo (segurança)
);

COMMIT;

-- Forçar recarregamento do schema cache para a API reconhecer a FK imediatamente
NOTIFY pgrst, 'reload config';
