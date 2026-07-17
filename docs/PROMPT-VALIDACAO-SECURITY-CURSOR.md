# 🔍 Prompt de Validação Pós-Migration — EventsCar
## Cole este prompt no Cursor AI

---

```
Você é um engenheiro de segurança full-stack especializado em Supabase + PostgreSQL + React/TypeScript.

Acabamos de aplicar migrations de segurança críticas no projeto EventsCar.
Preciso que você faça uma validação completa em DOIS FRENTES: banco de dados e código-fonte.

---

## CONTEXTO DO SISTEMA

**Stack:** React + TypeScript + Vite + Vercel Serverless (api/) + Supabase (PostgreSQL 17)
**Projeto Supabase:** yxawavenbognqiihaesh
**Repositório:** devgpesc/GP-DEV-SINISTRO

---

## O QUE FOI APLICADO NO BANCO

### Migration 001 — RLS Policies
1. `items` → policy: `authenticated` com `USING (true)` (tabela sem tenant_id)
2. `quotes` → tenant-scoped via `event_id → events.tenant_id`
3. `security_email_queue` → bloqueada, só `super_admin`
4. `financial_transactions` → tenant-scoped via `reference_id → purchase_orders.tenant_id OR events.tenant_id`
5. `purchase_order_items` → tenant-scoped via `purchase_order_id → purchase_orders.tenant_id`
6. `service_orders` → tenant-scoped via `event_id → events.tenant_id`
7. `saas_plans` → leitura pública; escrita só `super_admin`

### Migration 002 — Triggers e Tabelas
- Tabela `purchase_order_history` criada com RLS tenant-scoped
- Função `guard_purchase_order_mutations()` — BEFORE UPDATE/DELETE em `purchase_orders`
  - Status `'Aprovada'`: exige `approve_purchases` + `approval_note` preenchida
  - Status `'Cancelada'`: exige `approve_purchases`
  - DELETE: exige `delete_records`
  - Usa `user_has_permission()` (nova função que checa profile + membership role)
- Função `log_purchase_order_history()` — AFTER INSERT/UPDATE/DELETE em `purchase_orders`
  - Grava em `purchase_order_history` com colunas: `from_status`, `to_status`, `comment`, `user_id`, `tenant_id`
- Triggers: `trg_guard_purchase_order_mutations` e `trg_log_purchase_order_history`

### Outras funções no banco
- `user_has_permission(perm text)` — centraliza checagem de permissão
- `create_tenant_api_key()`, `revoke_tenant_api_key()`, `validate_api_key()` — sistema de API keys
- `api_keys` table — com RLS (só tenant admins)

---

## VALIDAÇÃO 1 — BANCO DE DADOS

Execute cada query abaixo no **Supabase Dashboard → SQL Editor** e confirme os resultados esperados:

### V1.1 — Todas as tabelas corrigidas têm policies
```sql
SELECT tablename, policyname, cmd, left(qual, 60) as qual_preview
FROM pg_policies
WHERE tablename IN (
  'items', 'quotes', 'security_email_queue', 'financial_transactions',
  'purchase_order_items', 'service_orders', 'saas_plans', 'purchase_order_history'
)
ORDER BY tablename, cmd;
```
**Esperado:** cada tabela tem pelo menos 1 policy. `saas_plans` tem 2 (SELECT pública + ALL para super_admin).

### V1.2 — Triggers em purchase_orders
```sql
SELECT t.tgname, p.proname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relname = 'purchase_orders'
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;
```
**Esperado:**
- `trg_guard_purchase_order_mutations` → `guard_purchase_order_mutations`
- `trg_log_purchase_order_history` → `log_purchase_order_history`
- `trg_set_tenant_purchase_orders` → `set_default_tenant_id`
- **NÃO deve aparecer:** `trg_guard_po` ou `trg_po_history` (foram removidos)

### V1.3 — Colunas de purchase_order_history
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'purchase_order_history' AND table_schema = 'public'
ORDER BY ordinal_position;
```
**Esperado:** `id, purchase_order_id, tenant_id, action, from_status, to_status, comment, details, user_id, created_at`

### V1.4 — Funções de segurança existem
```sql
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'guard_purchase_order_mutations', 'log_purchase_order_history',
    'user_has_permission', 'validate_api_key',
    'create_tenant_api_key', 'revoke_tenant_api_key'
  );
```
**Esperado:** todas as 6 funções presentes, `security_type = DEFINER`.

### V1.5 — Teste comportamental: aprovar OC sem nota deve falhar
```sql
-- Executar como usuário sem approve_purchases para ver se o guard bloqueia
-- (apenas verificar se o trigger existe e está ativo)
SELECT tgname, tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'purchase_orders' AND tgname = 'trg_guard_purchase_order_mutations';
```
**Esperado:** `tgenabled = 'O'` (Origin — ativo).

### V1.6 — RLS sem policy (deve estar zerado agora)
```sql
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;
```
**Esperado:** resultado vazio `[]`. Se aparecer qualquer tabela, ela tem RLS sem policy (deny-all).

---

## VALIDAÇÃO 2 — CÓDIGO FRONT-END

Verifique os pontos abaixo no código-fonte:

### V2.1 — Verificar `services/purchaseOrderService.ts`
O serviço usa `purchase_order_history` com as colunas corretas do schema atual:
- ✅ Deve usar: `from_status`, `to_status`, `comment`, `user_id`
- ❌ NÃO deve usar: `old_status`, `new_status`, `changed_by`, `approval_note` (colunas antigas)

**Ação:** Se houver divergência, atualizar o tipo `PurchaseOrderHistoryEntry` e os selects para refletir o schema real:
```typescript
export type PurchaseOrderHistoryEntry = {
  id: string;
  purchase_order_id: string;
  tenant_id?: string | null;
  action: string;
  from_status?: string | null;  // era: old_status
  to_status?: string | null;    // era: new_status
  comment?: string | null;      // era: approval_note
  details?: Record<string, unknown>;
  user_id?: string | null;      // era: changed_by
  created_at: string;
  user_name?: string;
};
```

### V2.2 — Verificar `pages/Purchases.tsx`
Buscar por aprovação/cancelamento de OC e confirmar:
1. O campo `approval_note` está sendo enviado no UPDATE quando status = `'Aprovada'`
2. Nenhuma verificação de permissão está sendo feita APENAS no front-end sem validação no banco
3. O status usa os valores corretos em PT: `'Aprovada'`, `'Cancelada'`, `'Recebida'`

```bash
# Buscar no código:
grep -n "approval_note\|approve_purchases\|canApprovePurchases\|status.*Aprov\|status.*Cancel" pages/Purchases.tsx
```

### V2.3 — Verificar `services/accessControl.ts`
A função `resolveAccessProfile` está correta. Confirmar que:
- `canApprovePurchases` verifica `permissions?.approve_purchases || isTenantManager`
- `canDeleteRecords` verifica `permissions?.delete_records || isSuperAdmin`
- `canViewFinancial` verifica `permissions?.financial_view || isTenantManager`

Esses checks são apenas para UX (esconder botões). A validação real está nos triggers do banco — não remover nem confiar apenas neles para segurança.

### V2.4 — Verificar `context/AuthContext.tsx`
Confirmar que o `resolveAccessProfile` recebe os dados corretos:
```typescript
const access = resolveAccessProfile(profile, memberships, currentTenant);
```
- `profile.permissions` deve vir do banco (tabela `profiles.permissions jsonb`)
- NÃO deve ler permissions de localStorage ou de variável estática

### V2.5 — Verificar `api/_lib/supabase.js`
O backend Vercel usa `service_role` key APENAS no servidor, nunca exposta ao cliente:
```bash
grep -n "SERVICE_ROLE\|service_role\|SUPABASE_SERVICE" api/_lib/supabase.js
```
**Esperado:** usa `process.env.SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `VITE_`).
**CRÍTICO:** Se aparecer `VITE_SUPABASE_SERVICE_ROLE_KEY` ou se o arquivo for importado pelo front-end, é uma brecha grave.

### V2.6 — Verificar `.env` e `vercel.json`
Confirmar que:
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — OK para front-end
- `SUPABASE_SERVICE_ROLE_KEY` — só em variáveis de servidor (sem prefixo VITE_)
- Nenhuma chave LLM (OPENAI_API_KEY, GEMINI_API_KEY) tem prefixo `VITE_`

```bash
grep -n "VITE_.*KEY\|VITE_.*SECRET" .env .env.example vercel.json 2>/dev/null
```
**Esperado:** só `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` são aceitáveis com prefixo VITE_.

---

## VALIDAÇÃO 3 — TESTE COMPORTAMENTAL (opcional mas recomendado)

Com um usuário de teste sem `approve_purchases`:

```typescript
// Tentar aprovar uma OC — deve retornar erro do banco
const { error } = await supabase
  .from('purchase_orders')
  .update({ status: 'Aprovada', approval_note: 'Teste' })
  .eq('id', 'ID_DA_OC');

console.log(error); 
// Esperado: { message: 'Permissao negada para aprovar ordem de compra.' }

// Tentar sem nota — deve retornar erro diferente
const { error: error2 } = await supabase
  .from('purchase_orders')
  .update({ status: 'Aprovada', approval_note: '' })
  .eq('id', 'ID_DA_OC');

console.log(error2);
// Esperado: { message: 'Justificativa por escrito obrigatoria para aprovacao.' }
```

---

## RELATÓRIO ESPERADO

Ao final, me retorne:
1. ✅/❌ para cada validação (V1.1 a V2.6)
2. Lista de divergências encontradas com arquivo + linha
3. Lista de correções necessárias com o código exato a aplicar
4. Confirmação de que `services/purchaseOrderService.ts` usa as colunas certas do schema atual

---

## SCHEMA DE REFERÊNCIA (purchase_order_history atual)

| Coluna | Tipo | Observação |
|--------|------|------------|
| id | uuid | PK |
| purchase_order_id | uuid | FK → purchase_orders |
| tenant_id | uuid | FK → saas_tenants |
| action | text | created/approved/cancelled/received/updated/deleted |
| from_status | text | status anterior |
| to_status | text | status novo |
| comment | text | approval_note / observação |
| details | jsonb | payload adicional |
| user_id | uuid | FK → auth.users |
| created_at | timestamptz | auto |
```

---

## ⚠️ PONTO DE ATENÇÃO PRIORITÁRIO

O serviço `purchaseOrderService.ts` no repositório usa campos com nomes antigos
(`old_status`, `new_status`, `changed_by`) que NÃO existem na tabela real do banco
(`from_status`, `to_status`, `user_id`). Isso vai causar erro silencioso no histórico de OCs.

**Esta é a correção mais urgente no código-fonte.**
