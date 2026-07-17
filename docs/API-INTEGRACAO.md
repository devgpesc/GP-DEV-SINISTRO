# EventsCar — Documentação de Integração via API (v1)

Guia técnico para conectar sistemas externos ao EventsCar (GP-DEV-SINISTRO).

## Visão geral

| Item | Valor |
|------|-------|
| **Versão** | v1 |
| **Base URL (produção)** | `https://eventos.escsistemas.com/api/v1` |
| **Autenticação** | API Key (Bearer ou header) |
| **Formato** | JSON |
| **Charset** | UTF-8 |

## Autenticação

### Gerar chave

1. Acesse **Configurações → API / Integrações** (perfil Admin/Gerente).
2. Informe um nome descritivo (ex: `ERP Matriz`).
3. Clique em **Gerar chave**.
4. Copie a chave imediatamente — ela **não é exibida novamente**.

Formato da chave:

```text
evsc_live_<64 caracteres hexadecimais>
```

### Enviar a chave nas requisições

**Opção 1 — Authorization Bearer (recomendado)**

```http
GET /api/v1/events HTTP/1.1
Host: eventos.escsistemas.com
Authorization: Bearer evsc_live_...
Accept: application/json
```

**Opção 2 — Header dedicado**

```http
X-Api-Key: evsc_live_...
```

### Escopos

| Escopo | Descrição |
|--------|-----------|
| `read` | Leitura de sinistros e ordens de compra |
| `admin` | Reservado para expansões futuras |

Chaves revogadas retornam `401`.

---

## Endpoints

### Health check (público)

```http
GET /api/v1/health
```

**Resposta 200**

```json
{
  "ok": true,
  "service": "EventsCar API",
  "version": "v1",
  "timestamp": "2026-07-17T03:00:00.000Z"
}
```

### Metadados da API

```http
GET /api/v1
```

Lista endpoints disponíveis e formas de autenticação.

---

### Sinistros (Events)

```http
GET /api/v1/events
Authorization: Bearer evsc_live_...
```

**Query params**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `limit` | number | Máx. 200 (padrão 50) |
| `status` | string | Filtra por status (`Aguardando`, `Em Cotação`, etc.) |

**Resposta 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "protocol": "EVT-2026-0004",
      "type": "Colisão",
      "category": "Colisão",
      "status": "Aprovado",
      "priority": "Média",
      "associateId": "uuid",
      "vehicleId": "uuid",
      "participation_quota": 200,
      "created_at": "2026-07-16T12:00:00.000Z",
      "tenant_id": "uuid"
    }
  ],
  "meta": {
    "count": 1,
    "tenant_id": "uuid"
  }
}
```

---

### Cotações (Quotations)

```http
GET /api/v1/quotations
Authorization: Bearer evsc_live_...
```

**Query params:** `limit`, `code`, `status`, `id` (detalhe com itens)

---

### Entregas (Deliveries)

```http
GET /api/v1/deliveries
Authorization: Bearer evsc_live_...
```

**Query params:** `limit`, `status` (`Pendente`, `Entregue`), `po` (código OC)

---

### Associados (Associates)

```http
GET /api/v1/associates
Authorization: Bearer evsc_live_...
```

**Query params:** `limit`, `document` (CPF/CNPJ sem máscara)

---

### Ordens de compra (Purchase Orders)

#### Listar OCs

```http
GET /api/v1/purchase-orders
Authorization: Bearer evsc_live_...
```

**Query params**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `limit` | number | Máx. 200 (padrão 50) |
| `code` | string | Filtra por código (`OC-2026-12345`) |
| `status` | string | `Gerada`, `Aprovada`, `Recebida`, `Cancelada` |

**Resposta 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "OC-2026-58658",
      "status": "Aprovada",
      "total": 400,
      "created_at": "2026-07-16T12:00:00.000Z",
      "approval_note": "Aprovado conforme cotação vencedora.",
      "approved_at": "2026-07-16T14:00:00.000Z",
      "quotation_id": "uuid",
      "event_id": "uuid",
      "supplier_id": "uuid",
      "suppliers": { "name": "Fornecedor XYZ", "city": "Goiânia" },
      "purchase_order_items": [
        {
          "name": "Lanterna traseira LD",
          "quantity": 1,
          "unit": "UN",
          "unit_price": 200,
          "total_price": 200
        }
      ]
    }
  ],
  "meta": { "count": 1, "tenant_id": "uuid" }
}
```

#### Detalhe com histórico de auditoria

```http
GET /api/v1/purchase-orders?id=<uuid-da-oc>
Authorization: Bearer evsc_live_...
```

**Resposta 200** — inclui array `history`:

```json
{
  "data": {
    "id": "uuid",
    "code": "OC-2026-58658",
    "status": "Aprovada",
    "history": [
      {
        "id": "uuid",
        "action": "created",
        "from_status": null,
        "to_status": "Gerada",
        "comment": null,
        "user_id": "uuid",
        "created_at": "2026-07-16T12:00:00.000Z"
      },
      {
        "id": "uuid",
        "action": "approved",
        "from_status": "Gerada",
        "to_status": "Aprovada",
        "comment": "Aprovado por escrito.",
        "created_at": "2026-07-16T14:00:00.000Z"
      }
    ]
  }
}
```

**Ações de auditoria**

| action | Descrição |
|--------|-----------|
| `created` | OC gerada a partir da cotação |
| `approved` | Aprovação por escrito |
| `cancelled` | OC cancelada |
| `received` | Recebida / entregue |
| `updated` | Outras alterações |
| `deleted` | Registro excluído |

---

## Códigos HTTP

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 204 | OPTIONS (CORS preflight) |
| 400 | Parâmetro inválido |
| 401 | Chave ausente, inválida ou revogada |
| 405 | Método não permitido |
| 500 | Erro interno |

---

## Exemplos

### cURL — listar sinistros

```bash
curl -s "https://eventos.escsistemas.com/api/v1/events?limit=10" \
  -H "Authorization: Bearer evsc_live_SUA_CHAVE_AQUI" \
  -H "Accept: application/json"
```

### cURL — OC com auditoria

```bash
curl -s "https://eventos.escsistemas.com/api/v1/purchase-orders?id=UUID_DA_OC" \
  -H "Authorization: Bearer evsc_live_SUA_CHAVE_AQUI"
```

### JavaScript (fetch)

```javascript
const API_KEY = process.env.EVENTSCAR_API_KEY;
const BASE = 'https://eventos.escsistemas.com/api/v1';

async function listPurchaseOrders() {
  const res = await fetch(`${BASE}/purchase-orders?status=Aprovada`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Python (requests)

```python
import os
import requests

API_KEY = os.environ["EVENTSCAR_API_KEY"]
BASE = "https://eventos.escsistemas.com/api/v1"

response = requests.get(
    f"{BASE}/events",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"limit": 20},
    timeout=30,
)
response.raise_for_status()
print(response.json())
```

---

## Segurança e permissões (aplicação web)

### Modelo de acesso

| Camada | Descrição |
|--------|-----------|
| **Tenant** | Cada empresa (`saas_tenants`) isola dados via RLS |
| **Membership** | `organization_members.role`: owner, admin, member, observer |
| **Profile** | `profiles.role`: Admin, Gerente, Usuário, super_admin |
| **Permissões granulares** | JSON em `profiles.permissions` |

### Permissões disponíveis

| Chave | Efeito |
|-------|--------|
| `approve_purchases` | Aprovar e cancelar OCs |
| `delete_records` | Excluir OCs e registros |
| `financial_view` | Ver valores financeiros detalhados |
| `view_reports` | Acessar relatórios BI |
| `manage_users` | Gerenciar equipe e convites |

Administradores da empresa (Admin/Gerente ou owner/admin) possuem todas as permissões operacionais.

### Regras enforced no banco

- Aprovação de OC exige `approval_note` e permissão `approve_purchases` (trigger PostgreSQL).
- Exclusão de OC exige permissão `delete_records` ou perfil gerencial.
- Itens de OC (`purchase_order_items`) isolados por tenant via ordem pai.
- API Keys armazenadas apenas como hash SHA-256.

### Variáveis de ambiente (servidor Vercel)

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Validação de API keys e queries server-side |
| `VITE_SUPABASE_URL` | Fallback | Usado se `SUPABASE_URL` não estiver definida |

---

## Limitações v1

- Apenas **leitura** (`GET`) via API pública.
- Escrita (criar sinistro, aprovar OC) permanece no app autenticado ou via Supabase direto com JWT do usuário.
- Rate limiting: aplicar no gateway (Vercel/WAF) conforme volume.

---

## Suporte

- Repositório: `devgpesc/GP-DEV-SINISTRO`
- Migration relacionada: `supabase/migrations/20260717030000_po_history_api_keys_security.sql`
