
-- MIGRATION: BULLETPROOF UPDATE (Users + Catalog + Matrix)
-- Execute no SQL Editor do Supabase

-- ==============================================================================
-- 1. CORREÇÃO DEFINITIVA DE USUÁRIOS (Handle Nulls & Roles)
-- ==============================================================================

-- Garante que a coluna 'name' não seja obrigatória (causa comum de erro)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
        ALTER TABLE public.profiles ALTER COLUMN "name" DROP NOT NULL;
    END IF;
END $$;

-- Recria a função de trigger com tratamento robusto de NULL e Role padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
  v_meta jsonb;
BEGIN
  v_meta := new.raw_user_meta_data;
  
  -- Tenta extrair nome de múltiplas fontes, fallback para parte do email
  v_name := COALESCE(
    v_meta->>'full_name', 
    v_meta->>'name', 
    v_meta->>'nome',
    split_part(new.email, '@', 1)
  );

  -- Insere ou Atualiza (Idempotente)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, permissions, updated_at)
  VALUES (
    new.id,
    new.email,
    v_name,
    v_meta->>'avatar_url',
    'Usuário', -- Role padrão segura
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reconecta o gatilho
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 2. INTEGRAÇÃO CATÁLOGO -> COTAÇÕES (Base Inteligente)
-- ==============================================================================

-- Adiciona catalog_item_id em quotation_items se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_items' AND column_name = 'catalog_item_id') THEN
        ALTER TABLE public.quotation_items 
        ADD COLUMN catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;
    END IF;

    -- Garante colunas auxiliares para rastreabilidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_items' AND column_name = 'unit') THEN
        ALTER TABLE public.quotation_items ADD COLUMN unit text DEFAULT 'UN';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_items' AND column_name = 'category') THEN
        ALTER TABLE public.quotation_items ADD COLUMN category text;
    END IF;
END $$;

-- Índice para busca rápida e autocomplete
CREATE INDEX IF NOT EXISTS idx_quotation_items_catalog_id ON public.quotation_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_search_vector ON public.catalog_items USING gin(to_tsvector('portuguese', name || ' ' || code));


-- ==============================================================================
-- 3. INTEGRAÇÃO CATÁLOGO -> COMPRAS (Rastreabilidade)
-- ==============================================================================

-- Só aplica se a tabela purchase_order_items existir (para não quebrar migração)
-- Se o sistema ainda usa JSONB em purchase_orders, isso fica preparado para o futuro.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'catalog_item_id') THEN
            ALTER TABLE public.purchase_order_items 
            ADD COLUMN catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Atualiza cache do Supabase
NOTIFY pgrst, 'reload config';
