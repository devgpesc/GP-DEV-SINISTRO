# 🤖 EventsCar — Prompts para o Cursor AI
## Segurança, RLS e Correções de Permissão

Cada prompt abaixo é autossuficiente. Cole no Cursor e execute individualmente.

---

## PROMPT 1 — Aplicar Migration de Segurança no Supabase

```
Você é um engenheiro de banco de dados Supabase especializado em Row Level Security (RLS) com PostgreSQL 17.

Preciso que você aplique a migration de segurança abaixo no projeto Supabase `yxawavenbognqiihaesh`.

**Contexto do sistema:**
- É um SaaS multi-tenant chamado EventsCar
- Cada empresa é um "tenant" isolado por `tenant_id`
- Funções de segurança existentes: `is_platform_super_admin(uid)`, `get_my_tenant_ids()`, `is_tenant_admin(tenant_id, uid)`
- Perfis em `profiles.role`: super_admin, Admin, Gerente, Usuário
- Permissões granulares em `profiles.permissions` (JSONB): approve_purchases, delete_records, financial_view, view_reports, manage_users

**O que fazer:**
1. Abrir o arquivo `eventscar_migration_001_security_fix.sql` no workspace
2. Executar cada bloco SQL no Supabase SQL Editor (Dashboard > SQL Editor)
3. Após aplicar, verificar se as policies foram criadas corretamente com:
   ```sql
   SELECT tablename, policyname, cmd FROM pg_policies 
   WHERE tablename IN ('items','quotes','security_email_queue','financial_transactions',
                       'purchase_order_items','service_orders','saas_plans')
   ORDER BY tablename, policyname;
   ```
4. Confirmar que nenhuma dessas tabelas ficou com `rowsecurity = true` mas sem policy

**Não faça:**
- Não drop tables
- Não altere policies existentes que estejam corretas (Tenant scoped access nas outras tabelas)
- Não mude a função `is_platform_super_admin`
```

---

## PROMPT 2 — Criar Trigger guard_purchase_order_mutations

```
Você é um engenheiro de banco de dados Supabase especializado em triggers PostgreSQL e segurança multi-tenant.

Preciso que você aplique a migration abaixo que cria o sistema de guarda e histórico de Ordens de Compra.

**Contexto:**
- Tabela: `purchase_orders` com colunas: id, code, event_id, supplier_id, total, status, created_at, created_by, quotation_id, tenant_id, approval_note, approved_by, approved_at
- Status possíveis: 'pending', 'approved', 'cancelled', 'rejected'
- Regras de negócio críticas que DEVEM ser aplicadas no banco (não só no front):
  * Aprovar OC → exige flag `approve_purchases` OU perfil Admin/Gerente/owner
  * Aprovar OC → exige `approval_note` preenchida
  * Cancelar OC → exige flag `approve_purchases` OU perfil gerencial
  * Deletar OC → exige flag `delete_records` OU perfil gerencial

**O que fazer:**
1. Abrir o arquivo `eventscar_migration_002_purchase_order_guard.sql`
2. Executar no Supabase SQL Editor em ordem: Parte A → B → C → D
3. Verificar se os triggers foram criados:
   ```sql
   SELECT trigger_name, event_object_table, action_timing, event_manipulation
   FROM information_schema.triggers
   WHERE event_object_table = 'purchase_orders'
   ORDER BY trigger_name;
   ```
4. Testar aprovação sem nota (deve lançar exceção)
5. Testar aprovação sem permissão (deve lançar exceção)
6. Testar aprovação válida (deve passar e registrar em purchase_order_history)

**Não faça:**
- Não altere a tabela purchase_orders (só adicione triggers e tabela de histórico)
- Não remova triggers existentes além dos declarados no arquivo
```

---

## PROMPT 3 — Verificar e Corrigir Permissões no Front-End

```
Você é um desenvolvedor React/TypeScript especializado em segurança de aplicações SaaS multi-tenant.

Preciso que você faça uma varredura completa no código-fonte do EventsCar para garantir que as verificações de permissão estejam sendo feitas TANTO no banco (RLS) quanto no front-end.

**Contexto de permissões:**
O sistema tem dois níveis:
1. `profiles.role` (global): super_admin, Admin, Gerente, Usuário
2. `organization_members.role` (por empresa): owner, admin, member, observer  
3. `profiles.permissions` (JSONB flags): approve_purchases, delete_records, financial_view, view_reports, manage_users

**Regras que DEVEM estar implementadas no front-end:**

| Funcionalidade | Permissão necessária |
|---|---|
| Ver valores financeiros | `financial_view` flag OU Admin/Gerente |
| Aprovar/Cancelar OC | `approve_purchases` flag OU Admin/Gerente |
| Excluir OC/registros | `delete_records` flag OU Admin/Gerente |
| Rota /relatorios | `view_reports` flag OU Admin/Gerente |
| Rota /configuracoes | Admin/Gerente OU owner/admin da empresa |
| Rota /saas-admin | super_admin apenas |
| Gestão de usuários/equipe | `manage_users` flag OU Admin/Gerente |

**O que fazer:**
1. Buscar no código todos os usos de `approve_purchases`, `delete_records`, `financial_view`, `view_reports`, `manage_users`
2. Verificar se há botões/rotas que dependem APENAS de condições no front sem verificação no banco
3. Verificar o hook/context de autenticação — como `canViewReports`, `canManageSettings` são calculados
4. Para cada permissão não verificada no banco: criar um comentário `// TODO: RLS também implementado em migration_001`
5. Verificar se `financial_transactions` está sendo acessada por qualquer usuário sem checar `financial_view`

**Arquivos para revisar prioritariamente:**
- Hooks de autenticação/permissão (useAuth, usePermissions, AuthContext)
- Componentes de OC (purchase orders)
- Guard de rotas (ProtectedRoute, RouteGuard)
- Componente de relatórios
```

---

## PROMPT 4 — Adicionar tenant_id nas tabelas sem isolamento

```
Você é um engenheiro de banco de dados e desenvolvedor full-stack especializado em Supabase e sistemas multi-tenant.

As tabelas abaixo não têm coluna `tenant_id` direta, o que impede isolamento de tenant por RLS simples. 
Preciso que você crie uma migration para adicionar `tenant_id` onde faz sentido e ajuste as policies.

**Tabelas afetadas:**

1. `financial_transactions` — atualmente sem tenant_id, acesso via reference_id/reference_type
   - Colunas atuais: id, reference_id, reference_type, type, description, amount, status, created_at
   - Relaciona com purchase_orders (reference_type='purchase_order') ou events
   - Ação: adicionar coluna tenant_id uuid, criar trigger de preenchimento automático

2. `items` — tabela de catálogo sem tenant_id
   - Colunas atuais: id, description, category, quantity
   - Verificar se é catálogo global (compartilhado) ou por empresa
   - Se por empresa: adicionar tenant_id e migrar dados

**Para financial_transactions, criar:**
```sql
-- Adicionar coluna
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.saas_tenants(id);

-- Popular retroativamente via purchase_orders
UPDATE public.financial_transactions ft
SET tenant_id = po.tenant_id
FROM public.purchase_orders po
WHERE ft.reference_type = 'purchase_order'
  AND ft.reference_id = po.id;

-- Popular retroativamente via events
UPDATE public.financial_transactions ft
SET tenant_id = e.tenant_id
FROM public.events e
WHERE ft.reference_type = 'event'
  AND ft.reference_id = e.id;

-- Trigger para novos registros
CREATE OR REPLACE FUNCTION public.set_tenant_financial_transactions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.reference_type = 'purchase_order' THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.purchase_orders WHERE id = NEW.reference_id;
    ELSIF NEW.reference_type = 'event' THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.events WHERE id = NEW.reference_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_tenant_financial_transactions
  BEFORE INSERT ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_financial_transactions();
```

**Após adicionar tenant_id em financial_transactions:**
- Remover as policies atuais criadas na migration_001 (que usam profiles.role)
- Criar policy padrão tenant-scoped igual às outras tabelas
- Manter a verificação de financial_view só no front-end (UX) — o RLS isola por empresa

**Validação após aplicar:**
```sql
-- Checar quantos registros ficaram sem tenant_id
SELECT count(*) FROM public.financial_transactions WHERE tenant_id IS NULL;
```
```

---

## PROMPT 5 — Auditoria e Revisão Pós-Correção

```
Você é um engenheiro de segurança especializado em Supabase com PostgreSQL.

Após aplicar as migrations 001 e 002 do EventsCar, preciso que você faça uma auditoria final para confirmar que todas as brechas foram fechadas.

**Checklist a executar no Supabase SQL Editor:**

1. Verificar tabelas com RLS ON mas sem policies:
```sql
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;
```
Resultado esperado: vazio (zero linhas)

2. Verificar policies sem isolamento de tenant (apenas auth.role check):
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual LIKE '%authenticated%'
  AND qual NOT LIKE '%tenant_id%'
  AND qual NOT LIKE '%super_admin%'
  AND qual NOT LIKE '%event_id%'
  AND qual NOT LIKE '%purchase_order_id%';
```
Resultado esperado: apenas tabelas intencionalmente abertas (items, saas_plans SELECT)

3. Verificar triggers de purchase_orders:
```sql
SELECT trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders'
ORDER BY trigger_name;
```
Resultado esperado: trg_guard_purchase_order_mutations (BEFORE UPDATE/DELETE) + trg_log_purchase_order_history (AFTER INSERT/UPDATE/DELETE)

4. Verificar que purchase_order_history existe e tem RLS:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'purchase_order_history';
```

5. Testar cross-tenant (com usuário de empresa A tentando ver dados de empresa B):
- Fazer login como usuário de uma empresa
- Tentar acessar /rest/v1/purchase_orders de outra empresa via Supabase client
- Resultado esperado: array vazio []

**Reportar:** lista de qualquer item com resultado diferente do esperado com a sugestão de correção.
```

---

## 📋 ORDEM DE EXECUÇÃO RECOMENDADA

1. ▶️ **Prompt 2** — Aplicar migration_001 (RLS policies) primeiro
2. ▶️ **Prompt 3** — Aplicar migration_002 (trigger de OC) 
3. ▶️ **Prompt 4** — Revisar front-end (paralelo, não depende do banco)
4. ▶️ **Prompt 5** — Adicionar tenant_id em financial_transactions (opcional, mas recomendado)
5. ▶️ **Prompt 6** — Auditoria final pós-correção
