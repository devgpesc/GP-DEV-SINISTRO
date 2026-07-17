# EventsCar — Segurança, Login e Permissões

## Fluxo de autenticação

1. **Login** (`/login`) — e-mail/senha ou Google OAuth.
2. **Registro** (`/register`) — empresa nova (`complete_registration`) ou convite (`accept_invite`).
3. **Callback** (`/auth/callback`) — confirma e-mail, OAuth PKCE, finaliza convite.
4. **Sessão** — Supabase Auth com PKCE; tenant ativo em `localStorage` (`sb-autoclaims-tenant-id`).

Usuário **sem membership** em nenhuma empresa é deslogado automaticamente (exceto `super_admin` ou fluxo de convite).

## Camadas de permissão

| Nível | Onde | Valores |
|-------|------|---------|
| Papel global | `profiles.role` | `super_admin`, `Admin`, `Gerente`, `Usuário` |
| Papel na empresa | `organization_members.role` | `owner`, `admin`, `member`, `observer` |
| Flags | `profiles.permissions` (JSON) | Ver tabela abaixo |

### Flags granulares

| Flag | Uso no sistema |
|------|----------------|
| `approve_purchases` | Aprovar e cancelar ordens de compra |
| `delete_records` | Excluir OCs e registros permanentes |
| `financial_view` | Valores financeiros detalhados |
| `view_reports` | Rota `/relatorios` |
| `manage_users` | Equipe, convites, aba Usuários |

Gerentes (`Admin`/`Gerente`) e `owner`/`admin` da empresa herdam permissões operacionais completas.

## Rotas protegidas

| Rota | Requisito |
|------|-----------|
| `/*` (app) | Sessão válida + membership ou super_admin |
| `/configuracoes` | `canManageSettings` |
| `/relatorios` | `canViewReports` |
| `/saas-admin` | `super_admin` |

## Ordens de compra — regras no banco

Triggers PostgreSQL (`guard_purchase_order_mutations`):

- **Aprovar** → exige `approve_purchases` + `approval_note` preenchido.
- **Cancelar** → exige `approve_purchases`.
- **Excluir** → exige `delete_records` ou perfil gerencial.

Histórico automático em `purchase_order_history` (trigger `log_purchase_order_history`).

## Gestão de equipe

- Listar/editar: RPC `get_tenant_members`, `update_tenant_member_profile`.
- Remover da empresa: `detach_tenant_member` (não apaga conta auth).
- Convites: tabela `invitations` com token; aceite valida e-mail.

## Boas práticas

- Não compartilhar chaves de API — revogar em Configurações → API / Integrações.
- Conceder `delete_records` apenas a perfis de confiança.
- Revisar aba **Auditoria** periodicamente (`audit_logs`).
