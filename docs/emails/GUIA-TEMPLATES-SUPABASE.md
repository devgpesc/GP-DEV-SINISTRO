# Documentacao dos templates HTML — Supabase Auth (EventsCar)

SMTP: **ja configurado** (`mail.escsistemas.com`, porta `465`, remetente `noreply@escsistemas.com`).  
Esta pasta e so para **colar os HTMLs** em **Authentication → Emails → Templates**.

---

## Mapa arquivo → tela do Supabase

| Arquivo no projeto | Aba no Supabase | Assunto sugerido |
|---------------------|-----------------|------------------|
| `01-confirm-signup.html` | **Confirm sign up** | `Confirme seu acesso ao EventsCar` |
| `02-magic-link.html` | **Magic link or OTP** | `Seu link de acesso ao EventsCar` |
| `03-reset-password.html` | **Reset password** | `Redefinir senha — EventsCar` |
| `04-change-email.html` | **Change email address** | `Confirme a alteracao do seu e-mail` |
| `05-invite-user.html` | **Invite user** | `Voce foi convidado para o EventsCar` |
| `07-reauthentication.html` | **Reauthentication** | `Codigo de verificacao — EventsCar` |
| `06-company-invite-modelo.html` | **Nao cola no Supabase** | Modelo do convite da *empresa* (mailto / futuro envio) |

> O convite da **Esc Solutions** (Equipe → Convidar) **nao** usa o template "Invite user" do Supabase.  
> Esse template nativo e so se voce convidar pelo painel Auth do Supabase.  
> O modelo da empresa e o `06-company-invite-modelo.html`.

---

## Como configurar cada template (passo a passo)

Para **cada** linha da tabela acima (exceto o `06`):

1. Abra o arquivo `.html` no Bloco de Notas / VS Code / Cursor  
2. Selecione **tudo** (`Ctrl+A`) e copie (`Ctrl+C`)  
3. No Supabase: **Authentication → Emails → Templates**  
4. Clique no template correspondente (ex.: Confirm sign up)  
5. Em **Subject**, cole o assunto sugerido  
6. No editor, ative **Source**  
7. **Apague** o HTML antigo  
8. Cole o HTML do arquivo  
9. Clique em **Preview** para revisar  
10. Clique em **Save changes**

### Importante ao colar

- **Nao** deixe texto solto antes do `<!DOCTYPE html>` (ex.: titulo na linha 1 fora do HTML) — isso quebra o layout no e-mail  
- **Nao** renomeie as variaveis `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, etc.  
- Em **Reauthentication**, o codigo e `{{ .Token }}` (nao e link)

---

## Checklist do que voce ja tem vs o que falta

| Template | Status tipico na sua conta | Acao |
|----------|----------------------------|------|
| Confirm sign up | Parcial (Esc Solutions) | Substituir pelo `01-confirm-signup.html` |
| Invite user | Parcial | Substituir pelo `05-invite-user.html` (opcional) |
| Change email | Parcial | Substituir pelo `04-change-email.html` |
| Magic link or OTP | Padrao ingles | Substituir pelo `02-magic-link.html` |
| Reset password | (se ainda padrao) | Usar `03-reset-password.html` |
| Reauthentication | Padrao ingles | Usar `07-reauthentication.html` |

---

## Cadastros de usuarios — precisa alterar?

Tela: **Authentication → Entrar / Fornecedores → Cadastros de usuarios**

| Opcao | Seu estado atual | Recomendacao |
|-------|------------------|--------------|
| Permitir que novos usuarios se cadastrem | ON | **Manter ON** (cadastro via `/register` e convite) |
| Permitir vinculacao manual | OFF | **Manter OFF** (nao e o convite da empresa) |
| Permitir logins anonimos | OFF | **Manter OFF** |
| Confirmar e-mail | ON | **Manter ON** agora que o SMTP esta ok |

### Sobre "Confirmar e-mail"

- **ON** = usuario precisa clicar no e-mail antes do primeiro login (mais seguro)  
- Com SMTP proprio, o e-mail deve chegar  
- Se ainda nao chegar, teste spam e o botao do sistema **"Nao recebi o e-mail — ativar conta agora"**  
- **So desligue** se quiser liberar login imediato sem confirmacao (fluxo mais simples com convites)

**Nao e obrigatorio mudar nada** se o SMTP estiver enviando.

---

## Provedores de autenticacao — precisa alterar?

| Provedor | Seu estado | Recomendacao |
|----------|------------|--------------|
| E-mail | Habilitado | **Manter** |
| Google | Habilitado | **Manter** (login Gmail) |
| Telefone / outros | Desabilitado | **Manter** |

### Nao misturar com o convite da empresa

- **Google habilitado** = login/cadastro com Gmail no EventsCar  
- **Vinculacao manual OFF** = nao atrapalha o convite da Esc Solutions  
- O vinculo com a empresa vem do **token `?invite=`** no sistema, nao do Google Cloud

### Conferir no Google Cloud (se login Google falhar)

No console Google OAuth, Authorized redirect URIs deve incluir:

`https://yxawavenbognqiihaesh.supabase.co/auth/v1/callback`

(Isso e no Google Cloud, nao na lista de Redirect URLs do Supabase.)

---

## URLs — o que voce tem esta ok

**Site URL:** `https://eventos.escsistemas.com` → correto  

**Redirect URLs** (manter):

- `https://eventos.escsistemas.com`
- `https://eventos.escsistemas.com/**`
- `https://eventos.escsistemas.com/auth/callback`

Opcional (ja ajuda):

- `https://eventos.escsistemas.com/auth/callback?invite=*`

Nao precisa adicionar `/login?invite=...` na lista do Supabase: o redirect de e-mail Auth deve ir para `/auth/callback`. O link de convite da empresa (`/register?invite=` ou `/login?invite=`) e gerado pelo EventsCar.

---

## SMTP — nenhuma mudanca obrigatoria

Seu SMTP atual:

- Host: `mail.escsistemas.com`  
- Port: `465`  
- User/Sender: `noreply@escsistemas.com`  
- Sender name: `Esc Solutions` (pode trocar para `EventsCar` se preferir a marca do produto)

Apos colar os templates, teste:

1. Cadastro novo com e-mail real  
2. Verifique caixa de entrada + spam  
3. Clique no link e confirme se chega em `https://eventos.escsistemas.com/auth/callback`
