-- =============================================================================
-- EventsCar — Migration 001: Security Fix
-- Data: 2026-07-17
-- Descrição: Correção de RLS policies e criação de triggers de segurança
-- Aplicar via: Supabase Dashboard > SQL Editor
-- =============================================================================

-- ===== PASSO 1: CORREÇÃO — items e quotes (RLS sem policy) ===================
-- Problema: tabelas com RLS ON mas zero policies = deny-all total

-- items não tem tenant_id — acesso via autenticação (tabela de catálogo genérico)
-- Verificar se items deve ser tenant-scoped; por ora: acesso para autenticados
CREATE POLICY "Authenticated access items"
  ON public.items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- quotes: acesso via event_id → tenant do evento
CREATE POLICY "Tenant scoped access"
  ON public.quotes
  FOR ALL
  TO authenticated
  USING (
    is_platform_super_admin(auth.uid())
    OR event_id IN (
      SELECT id FROM public.events
      WHERE tenant_id IN (SELECT get_my_tenant_ids())
    )
  )
  WITH CHECK (
    is_platform_super_admin(auth.uid())
    OR event_id IN (
      SELECT id FROM public.events
      WHERE tenant_id IN (SELECT get_my_tenant_ids())
    )
  );

-- ===== PASSO 2: CORREÇÃO — security_email_queue (RLS sem policy) =============
-- Problema: enqueue_security_email é SECURITY DEFINER então consegue inserir,
-- mas sem policy nenhum sistema externo consegue ler para processar a fila.
-- Solução: só super_admin lê/processa; inserts via trigger SECURITY DEFINER já funcionam.

CREATE POLICY "Apenas super_admin acessa fila de segurança"
  ON public.security_email_queue
  FOR ALL
  TO authenticated
  USING (is_platform_super_admin(auth.uid()))
  WITH CHECK (is_platform_super_admin(auth.uid()));

-- ===== PASSO 3: CORREÇÃO — financial_transactions (sem isolamento de tenant) =
-- Problema: sem tenant_id na tabela; acesso via reference_id/reference_type
-- Solução temporária segura: mover para acesso apenas com flag financial_view
-- (verificação de permissão granular via profiles.permissions)

DROP POLICY IF EXISTS "Enable all access for auth users" ON public.financial_transactions;

CREATE POLICY "Financial view permission required"
  ON public.financial_transactions
  FOR SELECT
  TO authenticated
  USING (
    is_platform_super_admin(auth.uid())
    OR (
      (SELECT (permissions->>'financial_view')::boolean
       FROM public.profiles
       WHERE id = auth.uid()) = true
    )
    OR (
      SELECT role IN ('super_admin', 'Admin', 'Gerente')
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Financial insert for admins"
  ON public.financial_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_platform_super_admin(auth.uid())
    OR (
      SELECT role IN ('super_admin', 'Admin', 'Gerente')
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Financial update for admins"
  ON public.financial_transactions
  FOR UPDATE
  TO authenticated
  USING (
    is_platform_super_admin(auth.uid())
    OR (
      SELECT role IN ('super_admin', 'Admin', 'Gerente')
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Financial delete for super_admin only"
  ON public.financial_transactions
  FOR DELETE
  TO authenticated
  USING (is_platform_super_admin(auth.uid()));

-- ===== PASSO 4: CORREÇÃO — purchase_order_items (sem isolamento de tenant) ===

DROP POLICY IF EXISTS "Auth Users Read PO Items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Auth Users Insert PO Items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Auth Users Update PO Items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Auth Users Delete PO Items" ON public.purchase_order_items;

CREATE POLICY "Tenant scoped access"
  ON public.purchase_order_items
  FOR ALL
  TO authenticated
  USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE is_platform_super_admin(auth.uid())
         OR tenant_id IN (SELECT get_my_tenant_ids())
    )
  )
  WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE is_platform_super_admin(auth.uid())
         OR tenant_id IN (SELECT get_my_tenant_ids())
    )
  );

-- ===== PASSO 5: CORREÇÃO — service_orders (sem isolamento de tenant) =========
-- service_orders não tem tenant_id — acesso via event_id

DROP POLICY IF EXISTS "Enable all access for auth users" ON public.service_orders;

CREATE POLICY "Tenant scoped access"
  ON public.service_orders
  FOR ALL
  TO authenticated
  USING (
    is_platform_super_admin(auth.uid())
    OR event_id IN (
      SELECT id FROM public.events
      WHERE tenant_id IN (SELECT get_my_tenant_ids())
    )
  )
  WITH CHECK (
    is_platform_super_admin(auth.uid())
    OR event_id IN (
      SELECT id FROM public.events
      WHERE tenant_id IN (SELECT get_my_tenant_ids())
    )
  );

-- ===== PASSO 6: CORREÇÃO — saas_plans (qualquer autenticado edita planos) ====

DROP POLICY IF EXISTS "Acesso total logado" ON public.saas_plans;
-- Mantém: "Planos visíveis para todos" (SELECT public = true) — correto

CREATE POLICY "Apenas super_admin gerencia planos"
  ON public.saas_plans
  FOR ALL
  TO authenticated
  USING (is_platform_super_admin(auth.uid()))
  WITH CHECK (is_platform_super_admin(auth.uid()));

-- =============================================================================
-- FIM DA MIGRATION 001
-- =============================================================================
