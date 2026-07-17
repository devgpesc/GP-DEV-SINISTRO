# Prompt Cursor — Módulo de Anexos com Vídeo (Supabase Storage + React)

Use este prompt na sua IDE Cursor para implementar em outro sistema a mesma funcionalidade de anexos multimídia com visualização no navegador.

---

## Prompt

```
Implemente um módulo completo de anexos de evidências em um sistema React + Supabase com os requisitos abaixo.

### Stack
- React + TypeScript + Vite
- Supabase (PostgreSQL + Storage)
- Tailwind CSS (opcional, mas recomendado)

### Objetivo
Permitir upload, listagem, remoção e visualização no navegador de arquivos anexados a um registro pai (ex: sinistro, chamado, processo).

### Formatos suportados
- Imagens: jpg, png, gif, webp
- Vídeos: mp4, mov, webm, avi, mkv
- Documentos: pdf, doc, docx, xls, xlsx, txt, zip, rar

### Banco de dados
Crie tabela `event_attachments` (ou equivalente genérica):
- id uuid PK
- parent_id uuid FK (ex: event_id)
- url text NOT NULL
- name text
- type text
- created_at timestamptz default now()

### Supabase Storage
- Bucket público: `event-attachments` (ou nome genérico)
- Path: `{parent_id}/{timestamp}-{filename}`
- Policies: authenticated INSERT/UPDATE/DELETE; public SELECT

### Serviço `attachmentService.ts`
Funções:
1. `getAttachmentKind(mime, filename)` → 'image' | 'video' | 'pdf' | 'word' | 'file'
2. `uploadAttachments(parentId, attachments[])` → salva no Storage + insere linhas na tabela
3. `deleteAttachment(id, url?)` → remove registro + arquivo do Storage

Interface local antes do upload:
```ts
interface Attachment {
  id?: string;
  name: string;
  type: string;
  url: string;
  size?: string;
  file?: File;
  isNew?: boolean;
}
```

### Componente `FileViewerModal.tsx`
Modal fullscreen/lightbox que renderiza:
- **image** → tag `<img>`
- **video** → tag `<video controls autoPlay>`
- **pdf** → `<iframe src={url}>`
- **word/outros** → mensagem + botões Abrir/Baixar

Incluir botões: Baixar, Abrir em nova aba, Fechar.

### Formulário de upload
- Input file: `accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.mp4,.mov,.avi,.webm,.mkv"`
- Preview por tipo (thumbnail para imagem, ícone para vídeo/doc)
- Botão "Abrir" em cada anexo
- Botão remover

### Fluxo de persistência
1. Usuário seleciona arquivos → ficam em memória com `URL.createObjectURL` para preview
2. Ao salvar o registro pai → chama `uploadAttachments(parentId, newOnes)`
3. Ao editar → carregar anexos existentes via join/select
4. Remover anexo existente → `deleteAttachment`

### UX
- Não usar `window.open` direto para impressão; preferir modal interno
- Tratar erro de upload com toast/mensagem clara
- Limitar tamanho recomendado: aviso acima de 50MB

### Entregáveis
1. Migration SQL (tabela + bucket + policies)
2. `services/attachmentService.ts`
3. `components/FileViewerModal.tsx`
4. Integração em formulário de exemplo
5. README curto de configuração Supabase

Siga boas práticas: tipagem forte, sem expor service role no frontend, URLs públicas do bucket ou signed URLs se preferir bucket privado.
```

---

## Referência de implementação

No projeto GP-DEV-SINISTRO, os arquivos de referência são:
- `services/attachmentService.ts`
- `components/FileViewerModal.tsx`
- `utils/defaults.ts` (constante `ATTACHMENT_ACCEPT`)
- `supabase/migrations/20260716220000_sinistro_entregas_anexos.sql`
