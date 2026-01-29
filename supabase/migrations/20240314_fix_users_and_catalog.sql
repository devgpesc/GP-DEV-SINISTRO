
-- MIGRATION: FIX USERS & INTEGRATE CATALOG (SAFE VERSION)
-- Execute no SQL Editor do Supabase

-- 1. CORREÇÃO DEFINITIVA DO ERRO DE CADASTRO DE USUÁRIO
-- Recria a função handle_new_user para ser à prova de falhas (null safety)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
BEGIN
  -- Tenta obter nome de metadados ou do email
  v_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- Insere o perfil com segurança
  INSERT INTO public.profiles (id, email, full_name, role, permissions, updated_at)
  VALUES (
    new.id,
    new.email,
    v_name,
    'Usuário', -- Role padrão segura
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reconecta o gatilho
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. INTEGRAÇÃO CATÁLOGO -> COTAÇÕES
-- Adiciona referência ao item do catálogo na tabela de itens da cotação (se a tabela existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotation_items') THEN
        ALTER TABLE public.quotation_items 
        ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

        ALTER TABLE public.quotation_items 
        ADD COLUMN IF NOT EXISTS unit text DEFAULT 'UN';
        
        -- Cria índice se a tabela existir
        CREATE INDEX IF NOT EXISTS idx_quotation_items_catalog ON public.quotation_items(catalog_item_id);
    END IF;
END $$;


-- 3. INTEGRAÇÃO CATÁLOGO -> COMPRAS (SAFE CHECK)
-- Só altera purchase_order_items se ela existir (para sistemas normalizados)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
        ALTER TABLE public.purchase_order_items 
        ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;
    ELSE
        -- Opcional: Se quiser criar a estrutura agora para uso futuro (sem quebrar o app atual que usa JSONB)
        /*
        CREATE TABLE public.purchase_order_items (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
            catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
            name text,
            quantity numeric,
            price numeric,
            total numeric
        );
        */
        RAISE NOTICE 'Tabela purchase_order_items não existe. Pulando alteração.';
    END IF;
END $$;


-- 4. ÍNDICES GERAIS E OTIMIZAÇÃO
-- Cria índice de busca textual no catálogo se a tabela existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_items') THEN
        CREATE INDEX IF NOT EXISTS idx_catalog_items_search ON public.catalog_items USING gin(to_tsvector('portuguese', name || ' ' || code));
    END IF;
END $$;

-- Recarregar cache
NOTIFY pgrst, 'reload config';
