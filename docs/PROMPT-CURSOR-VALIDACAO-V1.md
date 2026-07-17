# 🔍 Prompt de Validação Pós-Migration — EventsCar
## Cole este prompt no Cursor AI após as migrations de segurança serem aplicadas

---

## PROMPT CURSOR — VALIDAÇÃO DE SEGURANÇA COMPLETA

```
Você é um engenheiro de segurança especializado em Supabase + PostgreSQL + Next.js/React.

Acabamos de aplicar uma migration de segurança crítica no projeto EventsCar (Supabase Project ID: yxawavenbognqiihaesh).
Preciso que você valide tudo — banco de dados E front-end — e me dê um relatório completo do que está OK e o que ainda precisa de atenção.

---

## CONTEXTO DO SISTEMA

**Stack:** Next.js + Supabase (PostgreSQL 17) + Vercel
**Modelo de segurança:** Multi-tenant SaaS. Cada empresa é um tenant isolado por `tenant_id`.

**Funções de segurança no banco:**
- `is_platform_super_admin(uuid)` → SECURITY DEFINER, checa se role = 'super_admin'
- `get_my_tenant_ids()` → SECURITY DEFINER, retorna os tenant_ids do usuário autenticado
- `is_tenant_admin(tenant_id, user_id)` → SECURITY DEFINER

**Permissões granulares** ficam em `profiles.permissions` (JSONB):
- `approve_purchases` → aprovar/cancelar ordens de compra
- `delete_records` → excluir OCs e registros
- `financial_view` → dados financeiros detalhados
- `view_reports` → rota /relatorios
- `manage_users` → equipe e convites

---

## O QUE FOI ALTERADO NO BANCO (migrations aplicadas)

### Migration 001 — RLS Policies
| Tabela | O que mudou |
|--------|-------------|
| `items` | Policy criada: acesso para authenticated (era deny-all) |
| `quotes` | Policy criada: tenant-scoped via event_id → events.tenant_id |
| `security_email_queue` | Policy criada: só super_admin acessa |
| `financial_transactions` | Policy substituída: tenant-scoped via reference_id → purchase_orders/events |
| `purchase_order_items` | Policies antigas removidas, nova tenant-scoped via purchase_order_id |
| `service_orders` | Policy substituída: tenant-scoped via event_id → events.tenant_id |
| `saas_plans` | Policy de escrita removida, nova restringe INSERT/UPDATE/DELETE a super_admin |
| `purchase_order_history` | Nova tabela criada com RLS e policy tenant-scoped |

### Migration 002 — Triggers de OC
- Função `guard_purchase_order_mutations()` criada (SECURITY DEFINER)
- Função `log_purchase_order_history()` criada (SECURITY DEFINER)  
- Trigger `trg_guard_purchase_order_mutations` (BEFORE UPDATE/DELETE em purchase_orders)
- Trigger `trg_log_purchase_order_history` (AFTER INSERT/UPDATE/DELETE em purchase_orders)

---

## TAREFA 1 — VALIDAÇÃO NO BANCO (rode via Supabase SQL Editor)

Execute cada query abaixo e confirme os resultados esperados:

### 1.1 — Verificar policies em todas as tabelas corrigidas
```sql
SELECT tablename, policyname, cmd, left(qual, 100) as qual_preview
FROM pg_policies
WHERE tablename IN (
  'items', 'quotes', 'security_email_queue', 'financial_transactions',
  'purchase_order_items', 'service_orders', 'saas_plans', 'purchase_order_history'
)
ORDER BY tablename, cmd;
```
**Esperado:** cada tabela com exatamente 1 policy (saas_plans com 2: leitura pública + escrita super_admin)

### 1.2 — Verificar triggers em purchase_orders
```sql
SELECT t.tgname, p.proname, t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relname = 'purchase_orders'
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;
```
**Esperado:** 3 triggers: `trg_guard_purchase_order_mutations`, `trg_log_purchase_order_history`, `trg_set_tenant_purchase_orders`

### 1.3 — Verificar funções de segurança com SECURITY DEFINER
```sql
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'guard_purchase_order_mutations',
    'log_purchase_order_history',
    'is_platform_super_admin',
    'get_my_tenant_ids',
    'guard_profile_role_permissions'
  )
ORDER BY routine_name;
```
**Esperado:** todas com `security_type = DEFINER`

### 1.4 — Teste: anon não deve acessar dados sensíveis
Execute com a **anon key** (sem autenticação):
```sql
-- Trocar apikey pela anon key no header da requisição REST
-- GET /rest/v1/financial_transactions?limit=1
-- GET /rest/v1/purchase_orders?limit=1
-- GET /rest/v1/saas_plans?limit=1   (deve retornar dados — é público para leitura)
```
**Esperado:** financial_transactions e purchase_orders retornam `[]`. saas_plans retorna dados (leitura pública intencional).

### 1.5 — Teste funcional: guard de OC
```sql
-- Como usuário sem approve_purchases, tente aprovar uma OC:
UPDATE purchase_orders 
SET status = 'approved', approval_note = 'teste'
WHERE id = '<qualquer_id>';
-- Esperado: RAISE EXCEPTION 'Sem permissao para aprovar...'

-- Como usuário COM approve_purchases mas SEM approval_note:
UPDATE purchase_orders 
SET status = 'approved', approval_note = ''
WHERE id = '<qualquer_id>';
-- Esperado: RAISE EXCEPTION 'Nota de aprovacao obrigatoria...'
```

---

## TAREFA 2 — VALIDAÇÃO NO FRONT-END (revisar código)

Varra todos os arquivos do projeto (src/, app/, components/, lib/, hooks/) e verifique os pontos abaixo:

### 2.1 — Verificar onde `financial_view` é checada
Busque por: `financial_view`, `permissions`, `canViewFinancial` (ou similar)
- [ ] A flag `financial_view` está sendo checada **no servidor** (via RLS ou RPC) além do front-end?
- [ ] Se só está no client-side (ex: `if (user.permissions.financial_view)`), isso é insuficiente — a RLS precisa bloquear no banco também.
- **Ação:** se só no front, criar uma policy ou view separada que filtra `financial_transactions` por `profiles.permissions->>'financial_view'`.

### 2.2 — Verificar onde `approve_purchases` é checada no front
Busque por: `approve_purchases`, `canApprove`, `approveOrder` (ou similar)
- [ ] O front-end tenta aprovar OCs chamando o banco diretamente ou via RPC?
- [ ] Agora que o trigger `guard_purchase_order_mutations` existe, o front pode confiar na exceção do banco — verificar se os erros da exceção chegam ao usuário de forma legível.

### 2.3 — Verificar rotas protegidas no middleware
Busque por: `middleware.ts` ou `middleware.js`
- [ ] `/configuracoes` → requer `canManageSettings`
- [ ] `/relatorios` → requer `canViewReports` (flag `view_reports`)
- [ ] `/saas-admin` → requer `super_admin`
- [ ] A verificação usa o token do servidor (auth.uid() do Supabase) ou apenas localStorage?

### 2.4 — Verificar uso da service_role key no front-end
Busque por: `service_role`, `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`
- [ ] A service_role key NUNCA deve aparecer em código client-side (arquivos sem `server`, `api/`, ou similar)
- [ ] Se encontrar, mover para variável de ambiente server-only (`SUPABASE_SERVICE_ROLE_KEY` sem prefixo `NEXT_PUBLIC_`)

### 2.5 — Verificar localStorage de tenant
Busque por: `sb-autoclaims-tenant-id`, `localStorage`, `tenant_id`
- [ ] O tenant ativo no localStorage está sendo validado contra o banco antes de queries?
- [ ] Um usuário malicioso poderia trocar o tenant_id no localStorage e acessar dados de outra empresa?
- **Ação:** garantir que todas as queries de dados usam o `tenant_id` retornado pelo banco (`get_my_tenant_ids()`), nunca o valor do localStorage diretamente como filtro.

### 2.6 — Verificar tabelas items e quotes no front
Busque por: queries em `items` e `quotes` no código
- [ ] Essas tabelas agora têm policy para `authenticated` (items) e tenant-scoped via event_id (quotes)
- [ ] Verificar se alguma query no front assume que essas tabelas retornam dados sem estar logado

---

## TAREFA 3 — RELATÓRIO FINAL

Após executar todas as validações, me gere um relatório com:

1. **Status por tabela** — policy aplicada corretamente? (✅/❌)
2. **Status dos triggers** — guard e log funcionando? (✅/❌)
3. **Pontos ainda vulneráveis** — o que ainda precisa de atenção no front ou banco
4. **Itens de baixo risco** que podem ser endereçados depois
5. **SQL de rollback** — caso alguma policy quebre funcionalidade, o SQL para reverter cada mudança

---

## NOTAS IMPORTANTES

- As migrations foram aplicadas em produção — qualquer teste deve ser feito com cuidado
- O trigger `guard_purchase_order_mutations` rejeita aprovações sem `approval_note` — confirmar que o front envia esse campo
- `purchase_order_history` é uma tabela nova — confirmar que o front-end está pronto para exibi-la se necessário
- `financial_transactions` não tem `tenant_id` próprio — o isolamento é via JOIN com purchase_orders/events. Se houver registros orfãos (sem reference_id válido), eles ficam invisíveis. Avaliar se isso é aceitável.
```

---

## SQL DE ROLLBACK (emergência)

Se alguma coisa quebrar, use os SQLs abaixo para reverter cada mudança:

```sql
-- ROLLBACK items
DROP POLICY IF EXISTS "Authenticated access items" ON public.items;

-- ROLLBACK quotes
DROP POLICY IF EXISTS "Tenant scoped access" ON public.quotes;

-- ROLLBACK security_email_queue
DROP POLICY IF EXISTS "Apenas super_admin acessa fila de seguranca" ON public.security_email_queue;

-- ROLLBACK financial_transactions
DROP POLICY IF EXISTS "Tenant scoped access" ON public.financial_transactions;
CREATE POLICY "Enable all access for auth users" ON public.financial_transactions
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- ROLLBACK purchase_order_items
DROP POLICY IF EXISTS "Tenant scoped access" ON public.purchase_order_items;
CREATE POLICY "Auth Users Read PO Items" ON public.purchase_order_items FOR SELECT TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Insert PO Items" ON public.purchase_order_items FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Update PO Items" ON public.purchase_order_items FOR UPDATE TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Delete PO Items" ON public.purchase_order_items FOR DELETE TO public USING (auth.role() = 'authenticated');

-- ROLLBACK service_orders
DROP POLICY IF EXISTS "Tenant scoped access" ON public.service_orders;
CREATE POLICY "Enable all access for auth users" ON public.service_orders
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- ROLLBACK saas_plans (escrita)
DROP POLICY IF EXISTS "Apenas super_admin gerencia planos" ON public.saas_plans;
CREATE POLICY "Acesso total logado" ON public.saas_plans
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- ROLLBACK triggers de OC
DROP TRIGGER IF EXISTS trg_guard_purchase_order_mutations ON public.purchase_orders;
DROP TRIGGER IF EXISTS trg_log_purchase_order_history ON public.purchase_orders;
DROP FUNCTION IF EXISTS public.guard_purchase_order_mutations();
DROP FUNCTION IF EXISTS public.log_purchase_order_history();
DROP TABLE IF EXISTS public.purchase_order_history;
```
