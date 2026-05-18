# Story 2.6: Session Management — Create/Edit/Cancel (Treino, Jogo, Amigável)

**Status:** ready-for-dev

**Story ID:** 2.6
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-18

---

## Story

Como Treinador,
Quero criar, editar e cancelar sessões (treino, jogo, jogo amigável) com data, hora e tipo,
Para que o calendário seja um plano preciso que os fluxos subsequentes (fadiga, performance, prontidão) se possam anexar.

---

## Acceptance Criteria

### AC #1: Migração `000120_sessions.sql`

**Given** a migração `000120_sessions.sql` é aplicada
**When** `supabase db push` (ou `supabase db reset` em local) corre sem erros
**Then** a tabela `sessions` existe com:
- `id uuid PRIMARY KEY DEFAULT public.uuidv7()`
- `club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`
- `season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE`
- `type text NOT NULL CHECK (type IN ('training','match','friendly'))`
- `scheduled_at timestamptz NOT NULL`
- `duration_min int NOT NULL DEFAULT 90 CHECK (duration_min BETWEEN 15 AND 240)`
- `location text` (nullable)
- `status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','completed'))`
- `notes text` (nullable)
- `created_by uuid NOT NULL REFERENCES profiles(id)`
- `created_at timestamptz NOT NULL DEFAULT now()`

**And** existe um índice de performance `idx_sessions_club ON sessions(club_id)` (NFR1)

**And** existe um índice `idx_sessions_season ON sessions(season_id)` para queries filtradas por época

**And** existe um índice `idx_sessions_scheduled ON sessions(scheduled_at)` para listagem por data

**And** RLS está activo com políticas de isolamento por clube:
- SELECT: `club_id = auth.club_id()` (todos os utilizadores autenticados do clube)
- INSERT: `club_id = auth.club_id() AND auth.user_role() = 'coach'` (apenas treinador pode criar)
- UPDATE: `club_id = auth.club_id() AND auth.user_role() = 'coach'` (apenas treinador pode editar)

---

### AC #2: Criar sessão via `/calendario/nova`

**Given** Treinador acede a `/calendario/nova`
**When** clica "Nova sessão" (ou similarmente abre a página)
**Then** um formulário abre (DrillDownSheet) com:
- Campo "Tipo de sessão" obrigatório (dropdown: "Treino", "Jogo", "Jogo amigável")
- Campo "Data" obrigatório (date input)
- Campo "Hora" obrigatório (time input ou datetime picker)
- Campo "Duração (minutos)" obrigatório (number, default 90)
- Campo "Local" opcional (text, max 100 chars)
- Campo "Notas" opcional (textarea, max 500 chars)

**When** o formulário é submetido com dados válidos
**Then** a sessão é inserida na tabela `sessions` com `status='scheduled'`
**And** `season_id` é derivado da época actual (AC #5 da Story 2.5 — obter via `getCurrentSeason()`)
**And** `created_by` é preenchido com `auth.uid()`
**And** é criado um registo em `audit_logs` com `action='session.created'`, `target_kind='session'`, `target_id=session.id`
**And** `<CalmConfirmation message="Sessão criada" />` é mostrado
**And** o utilizador é redirecionado para `/calendario`

**When** `scheduled_at < now() - 1 day` (passado a mais de 1 dia)
**Then** Zod rejeita com mensagem "Data não pode ser passada (máx. retaguarda 24h)"

**When** `duration_min < 15 OR duration_min > 240`
**Then** Zod rejeita com mensagem "Duração deve estar entre 15 e 240 minutos"

**When** não há época actual definida
**Then** a página mostra alerta: "Sem época actual definida. Configure em /configuracoes/epocas."
**And** o formulário fica desabilitado até que uma época actual seja definida

---

### AC #3: Editar sessão existente via `/sessoes/[id]/editar`

**Given** Treinador acede a `/sessoes/[id]/editar`
**When** a página carrega
**Then** o formulário abre pré-preenchido com os dados actuais da sessão

**When** o formulário é submetido com dados válidos
**Then** o registo é actualizado na tabela `sessions`
**And** é criado um registo em `audit_logs` com `action='session.updated'`, `target_kind='session'`, `target_id=session.id`
**And** `<CalmConfirmation message="Sessão actualizada" />` é mostrado
**And** o utilizador é redirecionado para `/calendario`

**When** a sessão tem `status='cancelled'` ou `status='completed'`
**Then** a página mostra aviso: "Esta sessão não pode ser editada (cancelada/concluída)"
**And** o formulário é desabilitado (read-only)

**Note:** Validação da data/hora e duração segue as mesmas regras que AC #2.

---

### AC #4: Cancelar sessão via `/sessoes/[id]`

**Given** Treinador em `/sessoes/[id]` (página de detalhes)
**When** existe um botão "Cancelar sessão" (visível apenas para sessões com `status='scheduled'`)
**When** clica o botão
**Then** uma `<Dialog>` destrutiva abre com cópia:
```
"Esta sessão vai ser cancelada. Já há respostas ou eventos associados?"
```

**When** o utilizador confirma
**Then** `status='cancelled'` é definido
**And** é criado um registo em `audit_logs` com `action='session.cancelled'`, `target_kind='session'`, `target_id=session.id`
**And** future automatic notifications para essa sessão são suprimidas (se houver; para Epic 4)
**And** historical fatigue/event rows para essa sessão continuam intactas (não são apagadas)
**And** a página retorna a `/calendario` com `<CalmConfirmation message="Sessão cancelada" />`

**When** o utilizador cancela o diálogo
**Then** nada acontece — o utilizador permanece em `/sessoes/[id]`

---

### AC #5: Visualização de datas e horas com locale PT-PT

**Given** uma sessão com `scheduled_at = 2026-05-07T16:00:00Z` (UTC)
**When** renderizada na UI
**Then** a data e hora são apresentadas em timezone Europe/Lisbon (timestamp PT-PT)
**And** usa `date-fns` com locale `pt-PT` (e.g., "07/05/2026 às 16:00" ou "terça-feira, 7 de maio às 16h")

**And** no servidor, `scheduled_at` é sempre armazenado em UTC

---

### AC #6: Listagem de sessões em `/calendario`

**Given** Treinador em `/calendario`
**When** a página carrega
**Then** as sessões do clube (ordenadas por `scheduled_at ASC`) são listadas por semana ou por data
**And** cada card de sessão mostra:
- Data (e.g., "07/05 às 16:00")
- Tipo de sessão (ícone + texto: "Treino", "Jogo", "Jogo amigável")
- Local (se preenchido)
- Status visual: sessões canceladas aparecem com strikethrough + badge "Cancelada"

**And** tap/click numa sessão abre `/sessoes/[id]`

**And** existe um botão primário "Nova sessão" (1 por ecrã, top-level) que abre `/calendario/nova`

---

### AC #7: Visualização de detalhes da sessão em `/sessoes/[id]`

**Given** Treinador em `/sessoes/[id]`
**When** a página carrega
**Then** mostra:
- Tipo (ícone + "Treino" / "Jogo" / "Jogo amigável")
- Data/Hora (PT-PT)
- Duração (em minutos)
- Local (se preenchido)
- Notas (se preenchidas)
- Status ("Agendada" / "Cancelada" / "Concluída")
- Botão "Editar" → `/sessoes/[id]/editar` (habilitado apenas se `status='scheduled'`)
- Botão "Cancelar sessão" → diálogo destructivo (habilitado apenas se `status='scheduled'`)

---

### AC #8: Cobertura de testes (NFR54)

**Given** os testes correm via `npm run test --run` a partir de `project-r/`
**When** executados
**Then** cobertura ≥80% para:
- Zod schema: `SessionCreateSchema` (validação de data, duração, tipo, timezone), `SessionUpdateSchema`
- Server Action `createSession`: sucesso, sem época actual (graceful), erro RLS (coach-only), isolamento multi-tenant
- Server Action `updateSession`: sucesso, sessão não encontrada, status bloqueado (cancelled/completed)
- Server Action `getSessionsForClub`: devolve lista ordenada, filtro por datas
- Server Action `getSessionById`: sucesso, erro RLS
- Componente `<SessionForm>`: renderiza, submete, mostra erros de validação, desabilita sem época
- Componente `<SessionCard>`: renderiza sessões normais e canceladas, ícones de tipo
- Página `/calendario`: lista, filtros, estado vazio

---

## Tasks / Subtasks

- [ ] Task 1: Criar migração `000120_sessions.sql` (AC #1)
  - [ ] 1.1 Criar `project-r/supabase/migrations/000120_sessions.sql`
  - [ ] 1.2 CREATE TABLE sessions com todos os campos e constraints (type CHECK, status CHECK, duration_min CHECK)
  - [ ] 1.3 CREATE INDEX `idx_sessions_club`, `idx_sessions_season`, `idx_sessions_scheduled`
  - [ ] 1.4 ALTER TABLE ENABLE ROW LEVEL SECURITY + 3 policies (SELECT, INSERT, UPDATE)
  - [ ] 1.5 Validar SQL por inspecção (nenhuma FK órfã, constraints correctas)

- [ ] Task 2: Actualizar `database.types.ts` (AC #1)
  - [ ] 2.1 Adicionar tipo `sessions` (Row, Insert, Update) a `Database["public"]["Tables"]`

- [ ] Task 3: Criar Zod schemas `src/lib/schemas/sessions.ts` (AC #2, #3)
  - [ ] 3.1 `SessionCreateSchema`: type (enum: 'training','match','friendly'), scheduledAt (z.string().datetime() ou z.coerce.date()), duration_min (number, min 15, max 240), location (string, max 100, optional), notes (string, max 500, optional) + `.refine(data => data.scheduledAt >= now() - 1d, ...)`
  - [ ] 3.2 `SessionUpdateSchema`: id (uuid) + campos do Create + validação de status bloqueado
  - [ ] 3.3 Exportar types `SessionCreate`, `SessionUpdate`, `Session` (Row equivalent)

- [ ] Task 4: Criar Server Actions `src/lib/actions/sessions.ts` (AC #2, #3, #4, #6)
  - [ ] 4.1 `getSessionsForClub(clubId?, filters?)`: SELECT sessions WHERE club_id = auth club, ORDER BY scheduled_at ASC, com suporte a filtros opcionais (season_id, status)
  - [ ] 4.2 `getSessionById(sessionId)`: SELECT single session, com RLS check
  - [ ] 4.3 `createSession(input: SessionCreateSchema)`: INSERT com season_id derivado via `getCurrentSeason()`, handle `null` season (graceful degrade), audit log, logAccess
  - [ ] 4.4 `updateSession(input: SessionUpdateSchema)`: UPDATE + blocagem de status cancelled/completed, audit log, logAccess
  - [ ] 4.5 `cancelSession(sessionId)`: UPDATE status='cancelled' + audit log com `action='session.cancelled'`, logAccess

- [ ] Task 5: Criar `<SessionForm>` component (AC #2, #3)
  - [ ] 5.1 Criar `project-r/src/app/(staff)/calendario/session-form.tsx` ("use client")
  - [ ] 5.2 Usar `<DrillDownSheet>` com react-hook-form + zodResolver(SessionCreateSchema | SessionUpdateSchema)
  - [ ] 5.3 Campos: `type` (select/dropdown), `scheduled_at` (date + time, ou datetime picker), `duration_min` (number input, default 90), `location` (text input), `notes` (textarea)
  - [ ] 5.4 Integração `useSeasonView()` — verificar se há época actual, mostrar alerta se não (AC #5)
  - [ ] 5.5 `useTransition()` para chamar server action (NÃO try/catch com redirect)
  - [ ] 5.6 Em sucesso: fechar sheet + mostrar `<CalmConfirmation>` + router.push('/calendario')
  - [ ] 5.7 Validação client-side: data não pode ser muito passada, duração válida

- [ ] Task 6: Criar página `/calendario/nova` para criar sessão (AC #2)
  - [ ] 6.1 Server Component `project-r/src/app/(staff)/calendario/nova/page.tsx`
  - [ ] 6.2 Auth check: `getUser()` → `getProfile()` → verificar role = 'coach'
  - [ ] 6.3 Renderizar `<SessionForm mode="create" />`
  - [ ] 6.4 `<StickyHeader title="Nova sessão" backHref="/calendario" />`

- [ ] Task 7: Criar página `/calendario` para listar sessões (AC #6)
  - [ ] 7.1 Server Component `project-r/src/app/(staff)/calendario/page.tsx`
  - [ ] 7.2 Auth check: `getUser()` → `getProfile()` → verificar role in ('coach', 'analyst')
  - [ ] 7.3 Chamar `getSessionsForClub()` para carregar lista
  - [ ] 7.4 Renderizar lista agrupada por semana ou por data
  - [ ] 7.5 Cada session exibe `<SessionCard>` com data, tipo (ícone), local, status visual
  - [ ] 7.6 Click numa sessão abre `/sessoes/[id]`
  - [ ] 7.7 Botão "Nova sessão" que navega para `/calendario/nova`
  - [ ] 7.8 `<EmptyState>` quando lista vazia
  - [ ] 7.9 `<StickyHeader title="Calendário" />` no topo

- [ ] Task 8: Criar page `/sessoes/[id]` para visualizar detalhes (AC #7)
  - [ ] 8.1 Server Component `project-r/src/app/(staff)/sessoes/[id]/page.tsx` (dynamic route com `generateStaticParams` optional)
  - [ ] 8.2 Auth check + RLS check (getSessionById)
  - [ ] 8.3 Renderizar detalhes: tipo, data/hora PT-PT, duração, local, notas, status
  - [ ] 8.4 Botões "Editar" (se status='scheduled') e "Cancelar sessão" (se status='scheduled')
  - [ ] 8.5 `<StickyHeader title="Detalhes da sessão" backHref="/calendario" />`

- [ ] Task 9: Criar page `/sessoes/[id]/editar` (AC #3)
  - [ ] 9.1 Server Component `project-r/src/app/(staff)/sessoes/[id]/editar/page.tsx`
  - [ ] 9.2 Auth check + RLS check
  - [ ] 9.3 Block editing se status='cancelled' ou 'completed' (mostrar aviso, read-only)
  - [ ] 9.4 Renderizar `<SessionForm mode="edit" session={session} />`
  - [ ] 9.5 `<StickyHeader title="Editar sessão" backHref="/calendario" />`

- [ ] Task 10: Criar `<SessionCard>` component (AC #6, #7)
  - [ ] 10.1 Criar `project-r/src/components/ui/session-card.tsx`
  - [ ] 10.2 Render: data (PT-PT), tipo (ícone + nome), local, status (strikethrough + badge se cancelada)
  - [ ] 10.3 Touch target ≥44×44px (NFR40)
  - [ ] 10.4 Onclick → navigate to `/sessoes/[id]`

- [ ] Task 11: Criar `<SessionDialog>` para cancelamento (AC #4)
  - [ ] 11.1 Criar `project-r/src/components/dialogs/cancel-session-dialog.tsx`
  - [ ] 11.2 Usar `<Dialog>` com cópia destrutiva
  - [ ] 11.3 Botão "Cancelar" (destrutivo, red) + "Fechar" (secondary)
  - [ ] 11.4 Em confirmação: chamar `cancelSession()` server action, mostrar `<CalmConfirmation>`, navegar

- [ ] Task 12: Atualizar navegação (AC #6)
  - [ ] 12.1 Adicionar link para `/calendario` na navbar/sidebar staff
  - [ ] 12.2 Garantir rota `/calendario` é acessível de todos os layouts staff

- [ ] Task 13: Escrever testes (AC #8)
  - [ ] 13.1 `project-r/src/__tests__/lib/schemas/sessions.test.ts` — Zod schemas (validação tipo, data, duração)
  - [ ] 13.2 `project-r/src/__tests__/lib/actions/sessions.test.ts` — server actions (create, update, cancel, RLS)
  - [ ] 13.3 `project-r/src/__tests__/components/session-form.test.tsx` — form (render, submit, error display)
  - [ ] 13.4 `project-r/src/__tests__/components/session-card.test.tsx` — card rendering
  - [ ] 13.5 Testes de RLS: coach-only INSERT/UPDATE, tenant isolation, cancelled/completed blocking

- [ ] Task 14: Verificação final (AC #1–#8)
  - [ ] 14.1 `npm run lint` — 0 novos erros
  - [ ] 14.2 `npm run typecheck` — zero erros
  - [ ] 14.3 `npm run test --run` a partir de `project-r/` — todos os testes passam (cobertura ≥80%)
  - [ ] 14.4 `npm run build` — build limpa ✅
  - [ ] 14.5 Validar migrations via `supabase db reset` sem erros

---

## Dev Notes

### 🏗️ Architecture Compliance

**Multi-tenant RLS:** Todas as policies usam `club_id = auth.club_id()` + `auth.user_role()` injectado pelo auth hook (Story 1.4). Sessions pode ser criada/editada apenas por coach (role='coach'), leitura por qualquer staff do clube (coach/analyst/player se FK valid).

**Migrations versioning:** Usar `000120_sessions.sql` (slot confirmado livre entre `000110_seasons.sql` e futuras migrações). Sem ORM — SQL puro, Supabase CLI `supabase migration new` auto-incrementa.

**Timezone handling:** Servidor armazena UTC sempre. Cliente renderiza via `date-fns` locale PT-PT + timezone Europe/Lisbon.

### 📂 File Structure Reference (Story 2.5 Learnings)

A Story 2.5 seguiu este padrão:

```
project-r/
├── supabase/migrations/
│   └── 000110_seasons.sql  ← Story 2.5
│   └── 000120_sessions.sql ← Story 2.6 (TU)
├── src/
│   ├── lib/
│   │   ├── schemas/
│   │   │   └── seasons.ts  ← Story 2.5
│   │   │   └── sessions.ts ← Story 2.6 (TU)
│   │   ├── actions/
│   │   │   └── seasons.ts  ← Story 2.5
│   │   │   └── sessions.ts ← Story 2.6 (TU)
│   │   └── supabase/
│   │       └── database.types.ts (atualizado)
│   ├── app/(staff)/
│   │   ├── calendario/
│   │   │   ├── page.tsx          ← Story 2.6 (TU)
│   │   │   ├── nova/
│   │   │   │   └── page.tsx      ← Story 2.6 (TU)
│   │   │   └── session-form.tsx  ← Story 2.6 (TU)
│   │   ├── sessoes/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx       ← Story 2.6 (TU)
│   │   │   │   └── editar/
│   │   │   │       └── page.tsx   ← Story 2.6 (TU)
│   ├── components/
│   │   ├── ui/
│   │   │   └── session-card.tsx   ← Story 2.6 (TU)
│   │   ├── dialogs/
│   │   │   └── cancel-session-dialog.tsx ← Story 2.6 (TU)
│   ├── __tests__/
│   │   ├── lib/
│   │   │   ├── schemas/
│   │   │   │   └── sessions.test.ts
│   │   │   └── actions/
│   │   │       └── sessions.test.ts
│   │   ├── components/
│   │   │   ├── session-form.test.tsx
│   │   │   └── session-card.test.tsx
```

### 🔄 Pattern Reuse from Story 2.5

**Server Actions com RLS:**
- `createSeason()` → `createSession()`
- `updateSeason()` → `updateSession()` + novo: `cancelSession()`
- Usar mesmo padrão: logAccess(), audit logs, await user check

**Form submission:**
- DrillDownSheet + react-hook-form + zodResolver
- `useTransition()` para chamar SA (não try/catch com redirect)
- Em sucesso: `router.refresh()` + router.push() ou `searchParams` trigger `<CalmConfirmation>`

**Zod schemas:**
- Sempre `.refine()` para validação cross-field
- Exportar types separados (Create, Update, Read)

### ⏰ Timezone & Locale Notes (AC #5)

**Stored in DB:** UTC sempre (Supabase default + explicit `TIMESTAMPTZ`)

**Rendered in UI:**
- Client component com `date-fns`
- Import: `import { format } from 'date-fns'; import { pt } from 'date-fns/locale';`
- Render: `format(scheduledAt, 'dd/MM/yyyy HH:mm', { locale: pt })`
- Timezone explicit: `new Date(timestamp)` (JavaScript cria Date in browser TZ automaticamente)

Alternativa: usar `date-fns-tz` se timing accuracy é crítica:
```ts
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
const pt_time = utcToZonedTime(utcDate, 'Europe/Lisbon');
```

### 🎯 Season Derivation (AC #2)

No `createSession()`:
```ts
const season = await getCurrentSeason();
if (!season) {
  // Graceful degradation: show UI alert, don't throw
  return { error: 'No current season set. Configure in /configuracoes/epocas.' };
}
const sessionData = { ...input, season_id: season.id };
```

### 🔒 RLS Policy Specifics

**INSERT policy:** Apenas coach (`auth.user_role() = 'coach'`)
- Racional: Treinadores criam calendário, analistas não têm autoridade

**UPDATE policy:** Apenas coach (mesmo)
- Racional: coerência

**SELECT policy:** `club_id = auth.club_id()` (todo staff + players later)
- Racional: visualizar calendário é necessário para fatiga/performance

### 🚨 Previous Story 2.5 Learnings & Bugs to Avoid

From git history (3e7755d):
- **Migration numbering:** `000030_seasons_sessions.sql` estava ocupado → usar `000110_seasons.sql`
- **Partial unique index:** `idx_seasons_one_current ON seasons(club_id) WHERE is_current = true` — necessário para constraint "apenas uma época por clube"
- **RPC com SECURITY DEFINER:** `set_current_season()` requer `SECURITY DEFINER` para mudar época (não chama direto com UPDATE, porque RLS bloquearia)
- **Audit logs:** Sempre criar entrada com `action='entity.operation'` (e.g., `'session.created'`, `'session.updated'`)

Este story seguirá o mesmo rigor:
- Migrations com schema completo (nenhuma evolução pós-create)
- RLS habilitada desde o início (não como "later refinement")
- Audit log entry para CADA operação (create, update, cancel)
- Testes de RLS bloqueando coach-only, tenant isolation, status blockers

### 🎨 Component Hierarchy & UX Patterns (Story 1.8 Learnings)

De Story 1.8 (design system foundation):
- `<DrillDownSheet>` para modal forms (não Dialog)
- `<CalmConfirmation>` para feedback pós-ação (auto-dismiss)
- `<StickyHeader>` no topo de pages com back link
- `<EmptyState>` para lista vazia

Esta story reutilizará:
- `<DrillDownSheet>` para form em `/calendario/nova` e `/sessoes/[id]/editar`
- `<CalmConfirmation>` após criação/atualização/cancelamento
- `<Dialog>` (não `<CalmConfirmation>`) para destructive cancel — requer confirmação explícita

### 🧪 Testing Patterns

Story 2.5 usou Vitest + React Testing Library. Manter:
- `@testing-library/react` para componentes
- `vitest` para server actions + schemas (sem mocking de DB; usar integration tests)
- ≥80% cobertura obrigatória (Story 2.5 fez 543 testes, 101 novos)

### 📝 Dates & Documentation Note

**Created date:** 2026-05-18 (primeira vez que esta story foi criada via BMad)

**Sprint context:** Sprint 1.6 (atualmente em desenvolvimento; Story 2-5 foi concluído em 2026-05-18)

---

## Decisões & Notas Importantes

### 1. Coach-only Create/Edit (AC #2, #3)

Apenas Treinador (`role='coach'`) pode criar/editar sessões. Analista visualiza (SELECT) mas não escreve.

**Justificação:** Calendário é responsabilidade do staff de treino. Analista regista eventos/resposta posteriores, não cria sesões.

Se Growth phase decide permitir Analista criar (p.ex., backfill), a RLS policy muda facilmente: `auth.user_role() IN ('coach', 'analyst')`.

### 2. Status Workflow (AC #4)

Sessions têm lifecycle simples: `scheduled` → `cancelled` ou `completed` (ou implícito).

**Não há transição automática `completed`.** Para Growth: automação via pg_cron quando `scheduled_at + duration_min < now()`, ou via admin/task runner.

Para MVP: UI permite apenas 'scheduled' → 'cancelled' (diálogo destructivo).

### 3. Historical Data Preservation (AC #4)

Quando sessão é cancelada:
- Fatiga responses já registadas (linked via session_id FK) **permanecem intactas** (NOT SET NULL, NOT DELETE)
- Match events já registados **permanecem intactos**
- UI mostra: "Já há respostas ou eventos associados?" (informativo, não bloqueante)

Esta decisão garante auditoria + relatórios históricos mesmo com cancelamentos.

### 4. Graceful Degradation sem Época Atual (AC #5)

Se `getCurrentSeason()` retorna `null`:
- **UI:** Mostra alerta em `/calendario/nova` e desabilita form
- **Não bloqueia:** A mesma alerta existe em Story 2.5 para futuras vistas que dependem de época
- **Resolução:** Utilizador navega a `/configuracoes/epocas`, cria/marca época, volta

Esta é a padrão estabelecida em Story 2.5.

### 5. Notification Suppression (AC #4)

"Future automatic notifications for that session are suppressed"

Epic 4 (fatiga) e Epic 6 (performance) enviarão notificações pré/pós-sessão.

Esta story prepara o groundwork: campo (talvez `notifications_suppressed: boolean` em futuro, ou implícito em `status='cancelled'`).

Para MVP: não há código de notificação ainda. A note é placeholder para que Dev esteja ciente quando Epic 4/6 implementam.

---

## Reference Documents

- **Epic 2 Spec:** `_bmad-output/planning-artifacts/epics.md` (lines 1323–1403)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (database schema, RLS patterns, file structure)
- **Story 2.5 (previous):** `_bmad-output/implementation-artifacts/2-5-season-management-epocas.md` (patterns, testing, form components)
- **UX Design:** `_bmad-output/planning-artifacts/ux-design-specification.md` (for component hierarchy, locale, touch targets)
- **Memory:** `[[App lives in project-r/ subfolder]]`, `[[nextjs16-proxy-breaking-change]]`

---

## Completion Status

**Status:** ready-for-dev

**Ultimate context engine analysis completed** — Comprehensive developer guide created with all AC, architecture compliance, patterns from Story 2.5, timezone handling, RLS specifics, and test strategy.

**Ready for:** `dev-story` implementation agent

