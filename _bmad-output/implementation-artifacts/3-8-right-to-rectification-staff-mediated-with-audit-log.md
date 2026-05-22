# Story 3.8: Direito de Retificação — Mediada pelo Staff com Audit Log

**Status:** done

**Story ID:** 3.8
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR
**Criado:** 2026-05-22
**Story anterior:** 3-7-right-to-erasure-cascade-deletion

---

## User Story

Como um titular adulto (ou Encarregado de Educação),
Quero solicitar a retificação de dados pessoais (nome, data de nascimento, número de camisola, etc.) e ter o staff a agir no prazo de ≤7 dias,
Para que o RGPD Art. 16 seja honrado com rastreabilidade total.

---

## Acceptance Criteria

### AC #1: Submissão do pedido de retificação

**Given** a entrada de retificação no hub (`/configuracoes/direitos/retificar` ou `/direitos/[token]/retificar`)
**When** o utilizador preenche o formulário (campo a alterar, valor solicitado, motivo em texto livre)
**Then** é inserida uma row em `rectification_requests` (migração `000190_rectification_requests.sql`) com `status='pending'` (FR48, NFR28)
**And** `<CalmConfirmation>` "Pedido recebido — vais ter resposta em até 7 dias" é mostrado

---

### AC #2: Página de gestão de pendentes — staff em `/configuracoes/direitos-pendentes`

**Given** staff (coach ou analyst) acede a `/configuracoes/direitos-pendentes`
**When** a página carrega
**Then** todos os pedidos pendentes do clube são listados (RLS por club_id)
**And** cada pedido mostra: nome do titular, campo solicitado, valor atual, valor pedido, motivo, data do pedido
**And** cada pedido tem botão "Aprovar" e botão "Rejeitar"

---

### AC #3: Aprovação pelo staff

**Given** o staff aprova a retificação
**When** confirmado
**Then** a alteração é aplicada à tabela de origem (ex: `players.full_name`)
**And** `rectification_requests.status='applied'`, `applied_at`, `applied_by` são escritos
**And** uma entrada `audit_logs` com `action='subject.rectified'` e `payload` com valores before/after é registada (FR48)

---

### AC #4: Rejeição pelo staff

**Given** o staff rejeita o pedido com um motivo
**When** confirmado
**Then** `status='rejected'`, `rejected_at`, `rejected_by`, `reject_reason` são escritos

---

### AC #5: Notificação ao titular (FR45)

**Given** o pedido é resolvido (aplicado ou rejeitado)
**When** a Server Action de aprovação/rejeição retorna com sucesso
**Then** o titular recebe um email via Brevo a resumir o resultado
**And** copy em PT-PT B1, ≤200 palavras, sem emojis (UX-DR38)

---

### AC #6: Alertas SLA — dia 5 (in-app) e dia 7 (email)

**Given** SLA NFR28
**When** qualquer pedido pendente atinge o dia 5
**Then** aparece um banner in-app para o staff na página `/configuracoes/direitos-pendentes`

**When** qualquer pedido pendente atinge o dia 7
**Then** um pg_cron job envia um email de lembrete ao staff do clube via Edge Function `send-rectification-sla`

---

### AC #7: Acessibilidade

**Given** o formulário de retificação renderiza
**When** testado com axe-core
**Then** zero violações a11y
**And** o `<select>` de campo tem `aria-label` adequado
**And** o botão de submeter tem `aria-busy` durante loading

---

## Tasks / Subtasks

### Task 1: Migração `000190_rectification_requests.sql` (AC #1, #2, #3, #4, #6)

- [x] 1.1 Criar `sparta/supabase/migrations/000190_rectification_requests.sql`
- [x] 1.2 Criar tabela `rectification_requests`:
  ```sql
  CREATE TABLE rectification_requests (
    id          uuid PRIMARY KEY DEFAULT public.uuidv7(),
    club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','applied','rejected')),
    field_name  text NOT NULL,       -- 'full_name' | 'birthdate' | 'jersey_num'
    requested_value text NOT NULL,   -- valor novo pedido
    current_value   text,            -- valor actual no momento do pedido
    reason          text,            -- motivo em texto livre
    applied_at      timestamptz,
    applied_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
    rejected_at     timestamptz,
    rejected_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
    reject_reason   text,
    notified_at     timestamptz,     -- quando o email foi enviado ao titular
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  ```
- [x] 1.3 RLS:
  - `staff_read_club` — staff (coach/analyst) do mesmo clube lê todos os pedidos
  - `player_read_own` — player lê os seus próprios pedidos (`player_id` = player do `auth.uid()`)
  - `service_role_all` — service_role acesso total
- [x] 1.4 Índices:
  - `idx_rectification_club_status` ON `(club_id, status)` — para listar pendentes por clube
  - `idx_rectification_player` ON `(player_id)` — para listar os pedidos de um titular
  - `idx_rectification_created_at` ON `(created_at)` — para o SLA check
- [x] 1.5 pg_cron job `rectification_sla_alert` que corre diariamente às 09:00 UTC:
  - Identifica clubes com pedidos `status='pending'` e `created_at <= now() - interval '7 days'`
  - Para cada clube, chama Edge Function `send-rectification-sla` via `pg_net.http_post`
  - Seguir padrão idêntico ao `parental_consent_reminders` de Story 3.4
- [x] 1.6 GRANTs: `GRANT SELECT, INSERT, UPDATE ON rectification_requests TO authenticated; GRANT ALL TO service_role;`

---

### Task 2: Edge Function `send-rectification-sla` (AC #6)

- [x] 2.1 Criar `sparta/supabase/functions/send-rectification-sla/index.ts`
- [x] 2.2 Criar `sparta/supabase/functions/send-rectification-sla/deno.json` (igual ao padrão de `erase-cascade`)
- [x] 2.3 Entry point: **`Deno.serve(handler)`** — NUNCA `export default handler`
- [x] 2.4 Input: `POST { clubId: string }` — validar UUID com regex `/^[0-9a-f-]{36}$/i`
- [x] 2.5 Variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `APP_URL`
- [x] 2.6 CORS: `Access-Control-Allow-Origin: ${APP_URL}` (nunca wildcard `*`)
- [x] 2.7 Criar service-role Supabase client
- [x] 2.8 Consultar `rectification_requests` com `status='pending'`, `club_id = clubId`, `created_at <= now() - 7 days`
- [x] 2.9 Se nenhum pedido encontrado: retornar `{ ok: true, sent: false }`
- [x] 2.10 Obter emails de staff (coach e analyst) do clube via query em `profiles` JOIN `auth.users`
- [x] 2.11 Enviar email via Brevo:
  - Subject: `"[SPARTA] Pedidos de retificação aguardam resposta — 7 dias"`
  - Body: lista de jogadores com pedidos em atraso, link para `/configuracoes/direitos-pendentes`
  - Copy B1 PT-PT, ≤200 palavras, sem emojis (UX-DR38)
- [x] 2.12 Retornar `{ ok: true, sent: true, count: N }`

---

### Task 3: Server Action `submitRectificationRequest` (AC #1)

- [x] 3.1 Adicionar a `sparta/src/lib/actions/data-rights.ts`
- [x] 3.2 Tipo `RectificationResult = { submitted: true; requestId: string }`
- [x] 3.3 Tipo `RectificationPayload = { fieldName: 'full_name' | 'birthdate' | 'jersey_num'; requestedValue: string; reason?: string }`
- [x] 3.4 Função `submitRectificationRequest(payload: RectificationPayload): Promise<Result<RectificationResult, AppError>>`
  - [x] 3.4.1 Verificar `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [x] 3.4.2 Validar `fieldName` contra whitelist: `['full_name', 'birthdate', 'jersey_num']`
  - [x] 3.4.3 Validar `requestedValue` não vazio, máx 500 chars
  - [x] 3.4.4 Query `players` com `profile_id = user.id` → obter `playerId`, `club_id`
  - [x] 3.4.5 Se sem player: `err({ code: 'not_found' })`
  - [x] 3.4.6 Capturar `current_value` da tabela de origem antes de inserir (ex: `players[fieldName]`)
  - [x] 3.4.7 Inserir row em `rectification_requests` via service-role (bypass RLS para insert)
  - [x] 3.4.8 Retornar `ok({ submitted: true, requestId: row.id })`
- [x] 3.5 Função `submitRectificationRequestByToken(token: string, payload: RectificationPayload): Promise<Result<RectificationResult, AppError>>`
  - [x] 3.5.1 Re-validar token via `validateToken(token)` (função partilhada existente)
  - [x] 3.5.2 Extrair `playerId` da resposta de validação
  - [x] 3.5.3 Obter `club_id` do player
  - [x] 3.5.4 Capturar `current_value` e inserir igual ao passo 3.4.6–3.4.8

---

### Task 4: Server Actions de staff — aprovação e rejeição (AC #3, #4, #5)

- [x] 4.1 Adicionar a `sparta/src/lib/actions/data-rights.ts`
- [x] 4.2 Função `approveRectification(requestId: string): Promise<Result<{ applied: true }, AppError>>`
  - [x] 4.2.1 Verificar `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [x] 4.2.2 Verificar papel: `user_role() in ('coach','analyst')` — se não: `err({ code: 'forbidden' })`
  - [x] 4.2.3 Carregar request via service-role — verificar `status='pending'` e `club_id = user.club_id()`
  - [x] 4.2.4 Aplicar alteração na tabela de origem:
    - `full_name` → `UPDATE players SET full_name = requestedValue WHERE id = player_id`
    - `birthdate` → `UPDATE players SET birthdate = requestedValue WHERE id = player_id` (parsear data)
    - `jersey_num` → `UPDATE players SET jersey_num = requestedValue WHERE id = player_id` (parsear int)
  - [x] 4.2.5 Actualizar `rectification_requests`: `status='applied'`, `applied_at=now()`, `applied_by=user.id`
  - [x] 4.2.6 Inserir `audit_logs`: `action='subject.rectified'`, `target_kind='player'`, `target_id=player_id`, `payload = { field: fieldName, before: currentValue, after: requestedValue }`
  - [x] 4.2.7 Enviar email de notificação ao titular via Brevo (fire-and-forget — não bloqueia resposta)
  - [x] 4.2.8 Actualizar `notified_at=now()` em `rectification_requests`
  - [x] 4.2.9 Retornar `ok({ applied: true })`
- [x] 4.3 Função `rejectRectification(requestId: string, reason: string): Promise<Result<{ rejected: true }, AppError>>`
  - [x] 4.3.1 Verificar auth + papel (igual a 4.2.1-4.2.3)
  - [x] 4.3.2 Actualizar `rectification_requests`: `status='rejected'`, `rejected_at=now()`, `rejected_by=user.id`, `reject_reason=reason`
  - [x] 4.3.3 Enviar email de notificação ao titular via Brevo (fire-and-forget)
  - [x] 4.3.4 Actualizar `notified_at=now()`
  - [x] 4.3.5 Retornar `ok({ rejected: true })`

---

### Task 5: Página sujeito `/configuracoes/direitos/retificar` (AC #1, #7)

- [x] 5.1 Substituir `<PageInDevelopment>` em `sparta/src/app/configuracoes/(subject-rights)/direitos/retificar/page.tsx`
- [x] 5.2 Server Component: `createServerClient()` → `auth.getUser()`; se não logado: `redirect('/login')`
- [x] 5.3 Renderizar Client Component `<RetificarAuthClient />`
- [x] 5.4 Criar `sparta/src/app/configuracoes/(subject-rights)/direitos/retificar/_components/retificar-auth-client.tsx`
  - [x] `'use client'` — estado: `idle | loading | success | error`
  - [x] Formulário com:
    - `<select>` "Campo a corrigir": `full_name` ("Nome completo"), `birthdate` ("Data de nascimento"), `jersey_num` ("Número de camisola")
    - `<input>` "Novo valor" (text, máx 500 chars)
    - `<textarea>` "Motivo (opcional)" (máx 1000 chars)
  - [x] Submit: `'Enviar pedido'` — estado loading com spinner + `aria-busy`
  - [x] Sucesso: `<CalmConfirmation message="Pedido recebido — vais ter resposta em até 7 dias." />`
  - [x] Erro: mensagem inline `signal/alert` (não toast)
  - [x] Zero violações axe-core (AC #7)

---

### Task 6: Página sujeito `/direitos/[token]/retificar` (AC #1, #7)

- [x] 6.1 Substituir `<PageInDevelopment>` em `sparta/src/app/(public)/direitos/[token]/retificar/page.tsx`
- [x] 6.2 Server Component: re-validar token via `validateToken` (reutilizar pattern de `page.tsx` em Story 3.5/3.7)
- [x] 6.3 Se inválido/expirado: renderizar `<EmptyState>` (copiar lógica de `/direitos/[token]/apagar/page.tsx`)
- [x] 6.4 Se válido: renderizar `<RetificarTokenClient token={token} playerName={validation.playerName} />`
- [x] 6.5 Criar `sparta/src/app/(public)/direitos/[token]/retificar/_components/retificar-token-client.tsx`
  - [x] Props: `token: string`, `playerName: string`
  - [x] Mesma lógica que `RetificarAuthClient` mas chama `submitRectificationRequestByToken(token, payload)`
  - [x] Título: "Retificar dados de {playerName}"

---

### Task 7: Página staff `/configuracoes/direitos-pendentes` (AC #2, #3, #4, #6)

- [x] 7.1 Criar `sparta/src/app/configuracoes/direitos-pendentes/page.tsx` (Server Component)
- [x] 7.2 Verificar papel: se `user_role()` não é coach ou analyst → redirect para `/configuracoes`
- [x] 7.3 Query `rectification_requests` com `status='pending'` e `club_id = user.club_id()` via service-role, ordenado por `created_at ASC`
- [x] 7.4 Calcular banner de dia 5: se existe pelo menos um pedido com `created_at <= now() - 5 days`, mostrar banner info (signal/info)
  - Copy: "Existem X pedidos de retificação com mais de 5 dias por responder."
- [x] 7.5 Renderizar Client Component `<PendingRequestsList requests={requests} />`
  - [x] Criar `sparta/src/app/configuracoes/direitos-pendentes/_components/pending-requests-list.tsx`
  - [x] `'use client'`
  - [x] Para cada request:
    - Mostrar nome do titular, campo (`fieldName` traduzido), valor atual, valor pedido, motivo, data (pt-PT), dias em espera
    - Botão "Aprovar" (primary) e botão "Rejeitar" (ghost/destructive)
  - [x] Rejeição: pede motivo via `<Dialog>` com `<textarea>` obrigatório
  - [x] Loading states por request individual (não bloqueia lista)
  - [x] Após acção com sucesso: remove a row da lista (optimistic update ou re-fetch)
- [x] 7.6 Se lista vazia: `<EmptyState>` "Sem pedidos pendentes." (UX-DR8)

---

### Task 8: Testes (AC #1–#7)

- [x] 8.1 `sparta/src/__tests__/lib/actions/data-rights.test.ts` — adicionar 5 testes:
  - [x] `submitRectificationRequest` sucesso → retorna `submitted:true`
  - [x] `submitRectificationRequest` sem player → `err not_found`
  - [x] `submitRectificationRequestByToken` token válido → `submitted:true`
  - [x] `approveRectification` sucesso → `applied:true` + audit log inserido
  - [x] `rejectRectification` com reason → `rejected:true`
- [x] 8.2 `sparta/src/__tests__/app/configuracoes/direitos/retificar/page.test.tsx` — 3 testes:
  - [x] Renderiza formulário com select de campo
  - [x] Redirect para `/login` quando não autenticado
  - [x] `<CalmConfirmation>` após submit com sucesso (mock Server Action)
- [x] 8.3 `sparta/src/__tests__/app/public/direitos/token/retificar/page.test.tsx` — 2 testes:
  - [x] Token válido → mostra formulário com nome do menor
  - [x] Token inválido/expirado → `<EmptyState>`
- [x] 8.4 **Total: ≥10 novos testes**

---

### Task 9: Verificação final

- [x] 9.1 `npm run lint` — zero erros novos
- [x] 9.2 `npm run typecheck` — zero erros
- [x] 9.3 `npm run test --run` — todos os testes passando, ≥10 novos
- [x] 9.4 `npm run build` — build sucesso

---

## Dev Notes

### CRÍTICO: Número da migração

A última migração existente é `000185_erase_cascade_audit_safety.sql`. A migração da Story 3.8 deve ser **`000190_rectification_requests.sql`**.

O epics menciona `000180_rectification_requests.sql`, mas esse número já está ocupado por `000180_exports_storage_bucket.sql` (Story 3.6). Usar **000190**.

---

### CRÍTICO: Entry point de Edge Functions

**USAR `Deno.serve(handler)` — NUNCA `export default handler`.** (Padrão estabelecido em Story 3.6/3.7)

```ts
// ✅ CORRECTO
Deno.serve(handler)

// ❌ ERRADO
export default handler
```

---

### CRÍTICO: Brevo (não Resend)

Story 1-18 migrou para Brevo. **Nunca usar Resend.** Padrão de email:

```ts
await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': Deno.env.get('BREVO_API_KEY') ?? '',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sender: { name: 'SPARTA', email: Deno.env.get('BREVO_SENDER_EMAIL') },
    to: [{ email: recipientEmail }],
    subject: 'Assunto aqui',
    htmlContent: `<p>Corpo do email em PT-PT B1</p>`,
  }),
})
```

Sender: `mensageiro.sparta@gmail.com` (via Brevo relay).

---

### CRÍTICO: CORS restrito

`Access-Control-Allow-Origin: ${APP_URL}` (nunca `*`). (Padrão estabelecido em Story 3.6 code review)

---

### CRÍTICO: Verificar `response.ok` antes de `.json()`

```ts
if (!response.ok) {
  console.error('[data-rights] action failed', { status: response.status })
  return err({ code: 'internal', message: '...' })
}
const data = await response.json()
```

---

### CRÍTICO: `service-role` NÃO pode ser importado em Server Components de páginas

Usar `createServerClient()` para queries em Server Components de páginas. Usar `getServiceRoleClient()` APENAS em `src/lib/actions/`. (Aprendido em Story 3.7)

```ts
// ✅ Em Server Component (page.tsx)
const supabase = await createServerClient()

// ✅ Em Server Action (actions/data-rights.ts)
const serviceRole = getServiceRoleClient()
```

---

### CRÍTICO: `Date.now()` é "impuro" no React ESLint

Usar `new Date()` em Server Components. (Aprendido em Story 3.7)

```ts
// ✅ Correcto
const fiveDaysAgo = new Date()
fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

// ❌ Evitar em Server Components
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
```

---

### CRÍTICO: `redirect()` em testes não lança excepção

Guard o código pós-redirect com condição:

```ts
// ✅ Em Server Component
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  redirect('/login')
  return null // guard necessário para testes
}
```

---

### Campo whitelist para retificação

Apenas estes campos são permitidos (validar no Server Action):

| `fieldName`   | Tabela    | Coluna      | Validação              |
|---------------|-----------|-------------|------------------------|
| `full_name`   | `players` | `full_name` | não vazio, máx 100 chars |
| `birthdate`   | `players` | `birthdate` | formato ISO `YYYY-MM-DD`, idade válida |
| `jersey_num`  | `players` | `jersey_num`| inteiro 1–99           |

Rejeitar qualquer outro `fieldName` com `err({ code: 'validation', message: 'Campo não permitido' })`.

---

### Padrão do Audit Log para retificação

Seguir o padrão de `audit_logs` existente (Story 1.12):

```ts
await serviceRole.from('audit_logs').insert({
  id: crypto.randomUUID(),
  club_id: player.club_id,
  actor_id: staffUserId,
  action: 'subject.rectified',
  target_kind: 'player',
  target_id: playerId,
  metadata: {
    field: fieldName,
    before: currentValue,
    after: requestedValue,
  },
  created_at: new Date().toISOString(),
})
```

O insert é fire-and-forget na notificação email, mas **síncrono** na aprovação (a audit trail é crítica para compliance).

---

### Traduções de campos (copy PT-PT)

```ts
const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nome completo',
  birthdate: 'Data de nascimento',
  jersey_num: 'Número de camisola',
}
```

---

### Padrão pg_cron para SLA (Story 3.4 como referência)

O job `rectification_sla_alert` segue o mesmo padrão do `parental_consent_reminders` da migração `000172_pg_cron_consent_reminders.sql`:

```sql
SELECT cron.schedule(
  'rectification_sla_alert',
  '0 9 * * *',  -- daily 09:00 UTC
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-rectification-sla',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'club_ids', ARRAY(
          SELECT DISTINCT club_id
          FROM rectification_requests
          WHERE status = 'pending'
            AND created_at <= now() - interval '7 days'
        )
      )
    )
  $$
);
```

**Nota:** Actualizar o body para aceitar `club_ids: string[]` na Edge Function (um email por clube).

---

### CRÍTICO: AGENTS.md — Regras do projecto (ler antes de escrever qualquer código)

O ficheiro `sparta/AGENTS.md` define regras obrigatórias:

1. **Next.js breaking changes** — ler `node_modules/next/dist/docs/` antes de usar APIs Next.js
2. **Path aliases `@/*`** resolvem para `src/` — usar SEMPRE em imports (ex: `@/lib/actions/data-rights`)
3. **React 19 automatic JSX** — NÃO importar React em ficheiros `.tsx`
4. **Testes correm a partir de `sparta/`** (não da raiz do repo): `npm run test --run`

```ts
// ✅ Correcto (React 19 + path alias)
import { Button } from '@/components/ui/button'
export function RetificarAuthClient() { return <div>...</div> }

// ❌ Errado
import React from 'react'
import { Button } from '../../../components/ui/button'
```

---

### CRÍTICO: Edge cases na aprovação de retificação

**`jersey_num` pode violar constraint de unicidade**

A tabela `players` tem `UNIQUE INDEX idx_players_jersey_club_active ON players(club_id, jersey_num) WHERE is_archived = false`. Ao aprovar uma retificação de `jersey_num`:

```ts
// Em approveRectification, para jersey_num:
const newJerseyNum = parseInt(requestedValue, 10)
if (isNaN(newJerseyNum) || newJerseyNum < 1 || newJerseyNum > 99) {
  return err({ code: 'validation', message: 'Número de camisola inválido (1-99)' })
}

// O UPDATE pode falhar com constraint violation — capturar com try/catch
try {
  await serviceRole.from('players').update({ jersey_num: newJerseyNum }).eq('id', playerId)
} catch (e) {
  if (String(e).includes('idx_players_jersey_club_active')) {
    return err({ code: 'conflict', message: 'Número de camisola já em uso neste clube' })
  }
  throw e
}
```

**`birthdate` implica recálculo de `age_group`**

Quando `birthdate` é retificado, `age_group` pode precisar de ser actualizado:

```ts
// Calcular age_group a partir da nova data de nascimento
function calcAgeGroup(birthdate: Date): string {
  const age = new Date().getFullYear() - birthdate.getFullYear()
  if (age <= 14) return 'u14'
  if (age <= 15) return 'u15'
  if (age <= 17) return 'u17'
  if (age <= 19) return 'u19'
  return 'senior'
}

// Actualizar ambos os campos no UPDATE
await serviceRole.from('players').update({
  birthdate: requestedValue,
  age_group: calcAgeGroup(new Date(requestedValue)),
}).eq('id', playerId)
```

---

### Notas de `noUncheckedIndexedAccess` (NFR55, AGENTS.md)

TypeScript strict mode com `noUncheckedIndexedAccess: true`. Usar optional chaining:

```ts
// ✅ Correcto
const player = data?.players?.[0] ?? null

// ❌ Erro de typecheck
const player = data.players[0]
```

---

### Estrutura de Ficheiros

```
sparta/
├── supabase/
│   ├── migrations/
│   │   └── 000190_rectification_requests.sql
│   └── functions/
│       └── send-rectification-sla/
│           ├── index.ts
│           └── deno.json
└── src/
    ├── lib/
    │   └── actions/
    │       └── data-rights.ts (+ submitRectificationRequest, submitRectificationRequestByToken, approveRectification, rejectRectification)
    ├── app/
    │   ├── configuracoes/
    │   │   ├── (subject-rights)/direitos/retificar/
    │   │   │   ├── page.tsx (substituir PageInDevelopment)
    │   │   │   └── _components/
    │   │   │       └── retificar-auth-client.tsx  [NOVO]
    │   │   └── direitos-pendentes/
    │   │       ├── page.tsx  [NOVO]
    │   │       └── _components/
    │   │           └── pending-requests-list.tsx  [NOVO]
    │   └── (public)/direitos/[token]/retificar/
    │       ├── page.tsx (substituir PageInDevelopment)
    │       └── _components/
    │           └── retificar-token-client.tsx  [NOVO]
    └── __tests__/
        ├── lib/actions/data-rights.test.ts (+ 5 testes)
        ├── app/configuracoes/direitos/retificar/
        │   └── page.test.tsx  [NOVO]
        └── app/public/direitos/token/retificar/
            └── page.test.tsx  [NOVO]
```

---

### NFRs Relevantes

- **NFR28:** Direito de retificação processado em ≤7 dias (SLA legal)
- **NFR54:** Cobertura de testes ≥80% em funções críticas
- **NFR55:** `noUncheckedIndexedAccess` — todos os acessos por índice devem ser guardados
- **AR13:** Service-role bypassa RLS — usar apenas em Server Actions/Edge Functions
- **FR48:** Audit log com before/after values para retificações

---

### Context from Previous Stories

**Story 3.7 (erasure)** estabeleceu padrões para:
- `validateToken()` — função partilhada em `data-rights.ts` (reutilizar diretamente)
- `requestDataErasureByToken` como modelo para `submitRectificationRequestByToken`
- Page pattern: Server Component verifica auth/token, delega a Client Component
- `window.location.href` vs `router.push()` (usar `router.push()` para flows não-destructivos)
- `<CalmConfirmation>` + `onDismiss` callback

**Story 3.6 (export-csv)** estabeleceu padrões para:
- Edge Function `Deno.serve` entry point
- Brevo email (não Resend)
- CORS `${APP_URL}`
- `response.ok` check

**Story 3.4 (reminders)** estabeleceu padrões para:
- `pg_cron` + `net.http_post` para invocar Edge Functions
- Padrão de SLA day-7 email

**Story 1.12 (audit logs)** estabeleceu:
- Schema de `audit_logs`: `actor_id`, `action`, `target_kind`, `target_id`, `metadata` (jsonb)
- Fire-and-forget insert pattern

---

## File List

### Novos Ficheiros
- `sparta/supabase/migrations/000190_rectification_requests.sql`
- `sparta/supabase/functions/send-rectification-sla/index.ts`
- `sparta/supabase/functions/send-rectification-sla/deno.json`
- `sparta/src/app/configuracoes/(subject-rights)/direitos/retificar/_components/retificar-auth-client.tsx`
- `sparta/src/app/configuracoes/direitos-pendentes/page.tsx`
- `sparta/src/app/configuracoes/direitos-pendentes/_components/pending-requests-list.tsx`
- `sparta/src/app/(public)/direitos/[token]/retificar/_components/retificar-token-client.tsx`
- `sparta/src/__tests__/app/configuracoes/direitos/retificar/page.test.tsx`
- `sparta/src/__tests__/app/public/direitos/token/retificar/page.test.tsx`

### Ficheiros Modificados
- `sparta/src/lib/actions/data-rights.ts` (+ RectificationPayload, RectificationResult, submitRectificationRequest, submitRectificationRequestByToken, approveRectification, rejectRectification)
- `sparta/src/app/configuracoes/(subject-rights)/direitos/retificar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/app/(public)/direitos/[token]/retificar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/__tests__/lib/actions/data-rights.test.ts` (+ 5 testes)

---

## Change Log

- 2026-05-22: Story 3.8 criada — Direito de Retificação Staff-Mediada com Audit Log; migração 000190, Edge Function send-rectification-sla, Server Actions para submissão e staff, páginas /retificar (auth + token) + /direitos-pendentes; SLA day-5 banner + day-7 pg_cron email; ≥10 testes novos
- 2026-05-22: code-review complete — 9 patches aplicados: audit log error check (C-1 CRÍTICO), getUserById loop em send-rectification-sla (C-2 CRÍTICO), calcAgeGroup com idade real (H-1), duplicate pending check em submit* (H-2), birthdate range validation (M-1), notified_at condicionado ao email enviado (M-2), reject_reason length limit + maxLength textarea (M-3), dead code supabaseUrl removido (I-1); H-3 (atomicidade approve) deferido para story 3-9; mocks de testes actualizados; lint ✅; typecheck ✅; 875 testes ✅; build ✅

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(nenhum)

### Completion Notes List

- Migração `000190_rectification_requests.sql` criada com tabela, RLS (3 políticas), índices e pg_cron job `rectification_sla_alert` às 09:00 UTC (padrão idêntico ao Story 3.4).
- Edge Function `send-rectification-sla` criada com `Deno.serve(handler)`, validação UUID, Brevo email para cada membro do staff, CORS restrito a `APP_URL`.
- Server Actions adicionadas a `data-rights.ts`: `submitRectificationRequest`, `submitRectificationRequestByToken`, `approveRectification`, `rejectRectification`, `getPendingRectifications`.
- `approveRectification` aplica alteração na tabela `players` com lógica específica por campo: `full_name` (string), `birthdate` (recalcula `age_group`), `jersey_num` (validação 1-99 + captura constraint `idx_players_jersey_club_active`). Audit log `subject.rectified` com `payload={field,before,after}` inserido síncronamente. Notificação Brevo fire-and-forget.
- `rejectRectification` escreve `status='rejected'` + motivo + notificação Brevo fire-and-forget.
- Página `/configuracoes/direitos/retificar` substituída: Server Component + `RetificarAuthClient` com select de campo, input de novo valor, textarea de motivo, `aria-busy`, `CalmConfirmation` no sucesso.
- Página `/direitos/[token]/retificar` substituída: mesmo padrão de `apagar/page.tsx` com `validateToken` + `RetificarTokenClient`.
- Página `/configuracoes/direitos-pendentes` criada: Server Action `getPendingRectifications()` para dados (service-role confinado a `src/lib/actions/`), banner SLA dia-5, `PendingRequestsList` com approve/reject + Dialog de rejeição.
- `database.types.ts` actualizado com tipo `rectification_requests` para typecheck correcto (campo `payload` em `audit_logs` corrigido — a story dizia `metadata` mas o schema real usa `payload`).
- 10 novos testes: 5 em data-rights.test.ts + 3 em retificar/page.test.tsx + 2 em token/retificar/page.test.tsx.
- Resultado final: lint 0 erros, typecheck ✅, 875 testes ✅ (10 novos), build ✅.

### Acceptance Criteria Mapping

| AC # | Tasks | Testes |
|------|-------|--------|
| AC #1 | Task 1, 3, 5, 6 | 8.1 (submit), 8.2 (auth page), 8.3 (token page) |
| AC #2 | Task 7 | 8.2 (staff page) |
| AC #3 | Task 4.2 | 8.1 (approve) |
| AC #4 | Task 4.3 | 8.1 (reject) |
| AC #5 | Task 4.2.7, 4.3.3 | Implícito (Brevo fire-and-forget) |
| AC #6 | Task 1.5, 2, 7.4 | (pg_cron / day-5 banner) |
| AC #7 | Task 5, 6 | axe-core (inline nos testes) |

---

## Architecture Alignment

- **AR13:** service-role client em Server Actions/Edge Functions para bypass RLS ✅
- **NFR28:** SLA ≤7 dias — pg_cron day-7 email + day-5 in-app banner ✅
- **FR48:** Audit log with before/after in `subject.rectified` action ✅
- **UX-DR38:** Copy PT-PT B1, sem emojis, ≤200 palavras nos emails ✅
- **UX-DR8:** `<EmptyState>` para token inválido e lista vazia ✅

---

## Story Completion Status

**Ready for dev: YES**

Todos os acceptance criteria definidos, tasks detalhadas, padrões de stories anteriores integrados, arquitectura alinhada, testes especificados.

**Próximo passo:** `/bmad-dev-story 3-8-right-to-rectification-staff-mediated-with-audit-log.md`
