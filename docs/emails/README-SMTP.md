# Configurar SMTP e e-mails no Supabase (EventsCar)

## Por que o e-mail nao chega hoje

O Supabase usa um SMTP interno limitado em projetos free/trial. Em producao, e obrigatorio configurar SMTP proprio (Gmail Workspace, SendGrid, Resend, Amazon SES, etc.).

Sem SMTP, o cadastro pede confirmacao, mas o e-mail nao chega — e o login fica bloqueado.

---

## Passo a passo — SMTP no Supabase

### 1. Abrir o projeto

1. Acesse: https://supabase.com/dashboard/project/yxawavenbognqiihaesh  
2. Menu lateral: **Project Settings** → **Authentication**  
   (ou **Authentication** → **Emails** / **SMTP Settings**, conforme a UI)

### 2. Desativar confirmacao obrigatoria (opcional, recomendado com convites)

Em **Authentication → Providers → Email**:

- **Confirm email**: pode deixar **OFF** se o acesso a empresa for so por convite  
  (o sistema ja vincula pelo token do convite)

Se preferir manter confirmacao **ON**, configure o SMTP abaixo.

### 3. Configurar SMTP

Em **Project Settings → Authentication → SMTP Settings**:

| Campo | Exemplo (Gmail / Google Workspace) | Exemplo (Resend) |
|-------|-------------------------------------|------------------|
| Enable Custom SMTP | ON | ON |
| Sender email | `noreply@escsistemas.com` | `noreply@escsistemas.com` |
| Sender name | `EventsCar` | `EventsCar` |
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `587` | `465` ou `587` |
| Username | seu e-mail Gmail/Workspace | `resend` |
| Password | senha de app do Google | API Key do Resend |

#### Opcao A — Google Workspace / Gmail

1. Conta Google → **Seguranca** → **Senhas de app**  
2. Gere uma senha de app para “Mail”  
3. Use essa senha no campo Password do Supabase (nao use a senha normal)

#### Opcao B — Resend (recomendado para producao)

1. Crie conta em https://resend.com  
2. Verifique o dominio `escsistemas.com` (DNS)  
3. Crie API Key  
4. SMTP: host `smtp.resend.com`, user `resend`, password = API Key

#### Opcao C — SendGrid

1. SendGrid → API Keys  
2. Host `smtp.sendgrid.net`, user `apikey`, password = API Key

### 4. URLs de redirecionamento (obrigatorio)

Em **Authentication → URL Configuration**:

- **Site URL:** `https://eventos.escsistemas.com`  
- **Redirect URLs** (adicione todas):
  - `https://eventos.escsistemas.com/**`
  - `https://eventos.escsistemas.com/auth/callback`
  - `https://eventos.escsistemas.com/auth/callback?**`
  - `http://localhost:5173/**` (dev local, se usar)

### 5. Testar

1. Convide um e-mail de teste  
2. Cadastre pelo link  
3. Confirme se o e-mail chega (e pasta spam)  
4. Clique no link e valide o login

---

## Layouts de e-mail (cole no Supabase)

Pasta deste repositorio:

`docs/emails/`

| Arquivo | Onde colar no Supabase |
|---------|-------------------------|
| `01-confirm-signup.html` | Authentication → Email Templates → **Confirm signup** |
| `02-magic-link.html` | **Magic Link** |
| `03-reset-password.html` | **Reset password** |
| `04-change-email.html` | **Change email address** |
| `05-invite-user.html` | **Invite user** (nativo Supabase; opcional) |

### Como colar

1. Supabase → **Authentication** → **Email Templates**  
2. Selecione o template  
3. Cole o HTML do arquivo correspondente  
4. No **Subject**, use o assunto sugerido no topo de cada arquivo  
5. **Save**

Variaveis oficiais do Supabase (nao altere os nomes):

- `{{ .ConfirmationURL }}` — link de confirmacao / magic link / reset  
- `{{ .Email }}` — e-mail do usuario  
- `{{ .Token }}` — OTP (se usar)  
- `{{ .SiteURL }}` — site configurado  
- `{{ .Data }}` — metadados (quando houver)

---

## Relacao com o convite da empresa (EventsCar)

O convite da **Esc Solutions** (ou qualquer outra empresa) e feito pelo sistema:

1. Admin logado na empresa X  
2. **Configuracoes → Equipe → Convidar**  
3. O convite grava `tenant_id` da empresa atual  
4. Ao aceitar, o usuario entra **somente naquela empresa**

Trocar de empresa no seletor do topo e gerar outro convite = outra empresa destino.

O e-mail SMTP do Supabase confirma a **conta Auth**.  
O e-mail do convite da empresa (mailto / futuro envio automatico) e separado.
