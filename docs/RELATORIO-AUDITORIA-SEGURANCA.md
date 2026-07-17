# 🔐 EventsCar — Auditoria de Segurança Supabase
**Data:** 2026-07-17  
**Project ID:** yxawavenbognqiihaesh  
**Status:** ACTIVE_HEALTHY (PostgreSQL 17, us-east-1)

---

## ✅ O QUE ESTÁ BOM

| Item | Detalhe |
|------|---------|
| RLS habilitado | Todas as 31 tabelas públicas têm RLS ON |
| Proteção anon | Nenhuma tabela expõe dados sem autenticação |
| Tenant isolation | Maioria das tabelas usa `get_my_tenant_ids()` |
| Super Admin hardcoded | Só `devgpesc@gmail.com` pode promover super_admin |
| accept_invite | Valida e-mail do convite vs. usuário logado |
| SECURITY DEFINER | Funções críticas com `SET search_path TO public` |

---

## 🚨 BRECHAS CRÍTICAS

### BRECHA 1 — `items` e `quotes`: RLS ON mas SEM NENHUMA POLICY
**Risco: CRÍTICO**

RLS habilitado + zero policies = deny-all total no PostgreSQL.
Nenhum usuário consegue ler/escrever nessas tabelas via API — funcionalidades quebradas silenciosamente.

```sql
CREATE POLICY "Tenant scoped access" ON public.items
  FOR ALL TO authenticated
  USING (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()))
  WITH CHECK (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()));

CREATE POLICY "Tenant scoped access" ON public.quotes
  FOR ALL TO authenticated
  USING (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()))
  WITH CHECK (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()));
```

---

### BRECHA 2 — `security_email_queue`: RLS ON mas SEM POLICY
**Risco: CRÍTICO**

Nenhum registro pode ser inserido/lido. Alertas de segurança nunca chegam.
Como `enqueue_security_email` é SECURITY DEFINER, ela deveria funcionar — mas precisa de policy ou usar service_role explicitamente.

---

### BRECHA 3 — `financial_transactions`: qualquer autenticado vê dados de QUALQUER empresa
**Risco: ALTO**

Policy atual: `auth.role() = 'authenticated'` sem filtro de tenant.

```sql
DROP POLICY "Enable all access for auth users" ON public.financial_transactions;

CREATE POLICY "Tenant scoped access" ON public.financial_transactions
  FOR ALL TO authenticated
  USING (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()))
  WITH CHECK (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()));
```

---

### BRECHA 4 — `purchase_order_items`: sem isolamento de tenant
**Risco: ALTO**

Qualquer usuário logado lê e manipula itens de OC de qualquer empresa.

```sql
DROP POLICY "Auth Users Read PO Items" ON public.purchase_order_items;
DROP POLICY "Auth Users Insert PO Items" ON public.purchase_order_items;
DROP POLICY "Auth Users Update PO Items" ON public.purchase_order_items;
DROP POLICY "Auth Users Delete PO Items" ON public.purchase_order_items;

CREATE POLICY "Tenant scoped access" ON public.purchase_order_items
  FOR ALL TO authenticated
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
```

---

### BRECHA 5 — `service_orders`: acesso total sem filtro de tenant
**Risco: ALTO**

```sql
DROP POLICY "Enable all access for auth users" ON public.service_orders;

CREATE POLICY "Tenant scoped access" ON public.service_orders
  FOR ALL TO authenticated
  USING (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()))
  WITH CHECK (is_platform_super_admin(auth.uid()) OR tenant_id IN (SELECT get_my_tenant_ids()));
```
*(Verificar se `service_orders` tem coluna `tenant_id` — se não tiver, adicionar e popular)*

---

### BRECHA 6 — `saas_plans`: qualquer autenticado cria/edita/deleta planos SaaS
**Risco: ALTO**

Usuário comum pode alterar os planos de pricing de toda a plataforma.

```sql
DROP POLICY "Acesso total logado" ON public.saas_plans;

CREATE POLICY "Apenas super_admin gerencia planos" ON public.saas_plans
  FOR ALL TO authenticated
  USING (is_platform_super_admin(auth.uid()))
  WITH CHECK (is_platform_super_admin(auth.uid()));
```

---

### BRECHA 7 — Trigger `guard_purchase_order_mutations` NÃO EXISTE no banco
**Risco: ALTO**

A documentação menciona esse trigger mas ele não foi encontrado.
As regras de negócio críticas (exigir `approve_purchases` para aprovar/cancelar OC) não estão sendo aplicadas no banco — apenas no front-end, o que é insuficiente.

Precisa ser criado o trigger + função.

---

## ⚠️ RISCOS MÉDIOS

| # | Problema |
|---|---------|
| 8 | `financial_view` flag checada só no front-end, não nas RLS policies |
| 9 | `is_platform_super_admin` checa só `profiles.role` — proteção em chain |
| 10 | `delete_tenant_cascade` faz deleção massiva sem soft-delete ou confirmação |

---

## 📋 RESUMO DE PRIORIDADES

| # | Tabela/Item | Problema | Prioridade |
|---|-------------|----------|------------|
| 1 | `items`, `quotes` | RLS sem policy | 🔴 CRÍTICO |
| 2 | `security_email_queue` | RLS sem policy | 🔴 CRÍTICO |
| 3 | `financial_transactions` | Cross-tenant | 🔴 ALTO |
| 4 | `purchase_order_items` | Cross-tenant | 🔴 ALTO |
| 5 | `service_orders` | Cross-tenant | 🔴 ALTO |
| 6 | `saas_plans` | Edição irrestrita | 🔴 ALTO |
| 7 | `purchase_orders` | Trigger guard ausente | 🔴 ALTO |
| 8 | `financial_view` | Flag só no front | 🟡 MÉDIO |
| 9 | `profiles` | Proteção em chain | 🟡 MÉDIO |

---

## 📎 PRÓXIMOS PASSOS

1. Aplicar migration SQL com todas as correções de RLS
2. Criar trigger `guard_purchase_order_mutations` completo
3. Gerar prompts prontos para o Cursor implementar as correções
4. Conectar GitHub para revisar o front-end
