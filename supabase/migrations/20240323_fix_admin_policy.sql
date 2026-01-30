
-- MIGRATION: CORRIGIR PERMISSÕES DE SUPER ADMIN
-- Data: 2024-03-23

DO $$
BEGIN
    -- Atualizar política para permitir que super_admin e Admin editem quaisquer perfis
    -- Isso é necessário para o Frontend promover novos usuários a Admin quando a Edge Function falha
    
    DROP POLICY IF EXISTS "Admins can update all" ON public.profiles;
    
    CREATE POLICY "Admins can update all" ON public.profiles
        FOR ALL USING (
            exists (
                select 1 from public.profiles
                where id = auth.uid() and role IN ('Admin', 'super_admin')
            )
        );
END $$;

-- Recarregar configurações
NOTIFY pgrst, 'reload config';
