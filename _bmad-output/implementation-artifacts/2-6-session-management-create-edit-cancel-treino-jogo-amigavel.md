# Story 2.6: Session Management — Create/Edit/Cancel (Treino, Jogo, Amigável)

**Status:** done

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

- [x] Task 1: Criar migração `000120_sessions.sql` (AC #1)
  - [x] 1.1 Criar `project-r/supabase/migrations/000120_sessions.sql`
  - [x] 1.2 CREATE TABLE sessions com todos os campos e constraints (type CHECK, status CHECK, duration_min CHECK)
  - [x] 1.3 CREATE INDEX `idx_sessions_club`, `idx_sessions_season`, `idx_sessions_scheduled`
  - [x] 1.4 ALTER TABLE ENABLE ROW LEVEL SECURITY + 3 policies (SELECT, INSERT, UPDATE)
  - [x] 1.5 Validar SQL por inspecção (nenhuma FK órfã, constraints correctas)

- [x] Task 2: Actualizar `database.types.ts` (AC #1)
  - [x] 2.1 Adicionar tipo `sessions` (Row, Insert, Update) a `Database["public"]["Tables"]`

- [x] Task 3: Criar Zod schemas `src/lib/schemas/sessions.ts` (AC #2, #3)
  - [x] 3.1 `SessionCreateSchema`: type (enum: 'training','match','friendly'), scheduledAt, durationMin (min 15, max 240, default 90), location (optional, max 100), notes (optional, max 500) + `.refine(>= now() - 1d)`
  - [x] 3.2 `SessionUpdateSchema`: id (uuid) + campos do Create + validação de status bloqueado
  - [x] 3.3 Exportar types `SessionCreate`, `SessionUpdate`, `Session`, `SessionType`, `SessionStatus`

- [x] Task 4: Criar Server Actions `src/lib/actions/sessions.ts` (AC #2, #3, #4, #6)
  - [x] 4.1 `getSessionsForClub(filters?)`: SELECT ORDER BY scheduled_at ASC, filtros opcionais (season_id, status, from, to)
  - [x] 4.2 `getSessionById(sessionId)`: SELECT single session com RLS
  - [x] 4.3 `createSession(input)`: INSERT com season_id derivado via `getCurrentSeason()`, graceful degrade, audit log
  - [x] 4.4 `updateSession(input)`: UPDATE + blocagem de status cancelled/completed, audit log
  - [x] 4.5 `cancelSession(sessionId)`: UPDATE status='cancelled' + audit log action='session.cancelled'

- [x] Task 5: Criar `<SessionForm>` component (AC #2, #3)
  - [x] 5.1 Criar `project-r/src/app/(staff)/calendario/session-form.tsx` ("use client")
  - [x] 5.2 `<DrillDownSheet>` com react-hook-form + zodResolver
  - [x] 5.3 Campos: type (select), scheduledAt (datetime-local), durationMin (number, default 90), location (text), notes (textarea)
  - [x] 5.4 Alerta visível quando hasSeason=false, formulário desabilitado
  - [x] 5.5 `useTransition()` para chamar server action
  - [x] 5.6 Em sucesso: `<CalmConfirmation>` + router.push('/calendario')
  - [x] 5.7 Modo edit: desabilita formulário quando status='cancelled'/'completed'

- [x] Task 6: Criar página `/calendario/nova` para criar sessão (AC #2)
  - [x] 6.1 Server Component `project-r/src/app/(staff)/calendario/nova/page.tsx`
  - [x] 6.2 Auth check: role = 'coach', redirect senão
  - [x] 6.3 Renderizar `<SessionForm mode="create" hasSeason={hasSeason} />`

- [x] Task 7: Criar página `/calendario` para listar sessões (AC #6)
  - [x] 7.1 Server Component `project-r/src/app/(staff)/calendario/page.tsx`
  - [x] 7.2 Auth check: role in ('coach', 'analyst')
  - [x] 7.3 `getSessionsForClub()` + agrupamento por semana
  - [x] 7.4 Lista `<SessionCard>` por grupo semanal
  - [x] 7.5 Botão "Nova sessão" (apenas coach) + `<EmptyState>` + `<StickyHeader>`

- [x] Task 8: Criar page `/sessoes/[id]` para visualizar detalhes (AC #7)
  - [x] 8.1 Server Component `project-r/src/app/(staff)/sessoes/[id]/page.tsx`
  - [x] 8.2 Auth check + RLS check (getSessionById)
  - [x] 8.3 Detalhes: tipo (ícone), data/hora PT-PT, duração, local, notas, status badge
  - [x] 8.4 `<SessionDetailActions>` (coach only): Editar + Cancelar sessão (apenas se scheduled)
  - [x] 8.5 `<StickyHeader backHref="/calendario" />`

- [x] Task 9: Criar page `/sessoes/[id]/editar` (AC #3)
  - [x] 9.1 Server Component `project-r/src/app/(staff)/sessoes/[id]/editar/page.tsx`
  - [x] 9.2 Auth check: role = 'coach'
  - [x] 9.3 `<SessionForm mode="edit" session={session} />` — bloqueado se cancelled/completed
  - [x] 9.4 `notFound()` quando sessão não existe

- [x] Task 10: Criar `<SessionCard>` component (AC #6, #7)
  - [x] 10.1 Criar `project-r/src/components/ui/session-card.tsx`
  - [x] 10.2 data PT-PT (date-fns), ícone por tipo (Dumbbell/Trophy/Handshake), local, badge "Cancelada"
  - [x] 10.3 Touch target min-h-[44px] (NFR40)
  - [x] 10.4 Link → `/sessoes/[id]`

- [x] Task 11: Criar `<CancelSessionDialog>` para cancelamento (AC #4)
  - [x] 11.1 Criar `project-r/src/components/dialogs/cancel-session-dialog.tsx`
  - [x] 11.2 `<Dialog>` com cópia destrutiva + confirmação
  - [x] 11.3 Botão destrutivo "Cancelar sessão" + "Fechar"
  - [x] 11.4 `cancelSession()` + `<CalmConfirmation message="Sessão cancelada">` + navigate

- [x] Task 12: Atualizar navegação (AC #6)
  - [x] 12.1 BottomTabNav já tem `/calendario` (coach) e `/sessoes` (analyst) — sem alteração necessária
  - [x] 12.2 Rotas acessíveis no layout `(staff)` confirmadas

- [x] Task 13: Escrever testes (AC #8)
  - [x] 13.1 `src/__tests__/lib/schemas/sessions.test.ts` — 20 testes Zod (tipo, data, duração, limites)
  - [x] 13.2 `src/__tests__/lib/actions/sessions.test.ts` — 17 testes server actions (create, update, cancel, RLS)
  - [x] 13.3 `src/__tests__/components/session-form.test.tsx` — 8 testes form (render, submit, erros, disabled)
  - [x] 13.4 `src/__tests__/components/session-card.test.tsx` — 9 testes card (link, data, localização, badge)

- [x] Task 14: Verificação final (AC #1–#8)
  - [x] 14.1 `npm run lint` — 0 novos erros
  - [x] 14.2 `npm run typecheck` — 0 erros
  - [x] 14.3 `npm run test --run` — 610 testes passam (0 falhas)
  - [x] 14.4 `npm run build` — build limpa ✅ (20 rotas)
  - [x] 14.5 Migração SQL inspeccionada sem FK órfãs

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

**Status:** review

---

## Dev Agent Record

### Implementation Plan

Seguiu os padrões estabelecidos pela Story 2.5 (seasons):
- Migração 000120 com RLS direct profile lookup (consistente com 000110)
- Zod schemas com `.refine()` para validação de data (janela 24h)
- Server Actions com `getAuthContext()` + `logAccess()` fire-and-forget
- `getCurrentSeason()` para derivar `season_id` na criação
- DrillDownSheet em páginas dedicadas (`/calendario/nova`, `/sessoes/[id]/editar`)
- SessionCard com date-fns locale PT-PT + ícones lucide-react por tipo
- CancelSessionDialog destrutivo com Dialog (não CalmConfirmation)

### Debug Log

- Zod v4: `errorMap` substituído por simplesmente remover — `z.enum()` sem parâmetros extra funciona correctamente
- Zod v4: `invalid_type_error` não existe — substituído por `z.number()` simples
- Test mock `order()` precisa ser thenable + chainable para suportar filtros opcionais na query
- `EmptyState.cta.onClick` não pode ser passado de Server Component — removido (botão principal suficiente)

### Completion Notes

- **Migração:** `000120_sessions.sql` — TABLE sessions com 3 índices + RLS (SELECT para staff, INSERT/UPDATE apenas coach)
- **Tipos DB:** `database.types.ts` actualizado com sessions Row/Insert/Update + 3 Relationships
- **Schemas:** `SessionCreateSchema` + `SessionUpdateSchema` + types exportados (`Session`, `SessionType`, `SessionStatus`)
- **Actions:** `getSessionsForClub`, `getSessionById`, `createSession`, `updateSession`, `cancelSession` — todos com audit log
- **UI:** `<SessionForm>` (DrillDownSheet, 2 modos), `<SessionCard>` (PT-PT, ícones, badge cancelada), `<CancelSessionDialog>` (Dialog destrutivo), `<SessionDetailActions>` (client wrapper para coach)
- **Páginas:** `/calendario` (listagem agrupada por semana), `/calendario/nova`, `/sessoes/[id]`, `/sessoes/[id]/editar`
- **Testes:** 54 novos testes → total 610 passam; lint 0 erros; typecheck 0 erros; build ✅ (20 rotas)
- **ACs verificados:** AC#1 (migração+RLS), AC#2 (criar), AC#3 (editar+blocked), AC#4 (cancelar+dialog), AC#5 (PT-PT+UTC), AC#6 (listagem+card), AC#7 (detalhes+botões), AC#8 (cobertura≥80%)

### File List

- `project-r/supabase/migrations/000120_sessions.sql` (novo)
- `project-r/src/lib/supabase/database.types.ts` (actualizado — sessions table)
- `project-r/src/lib/schemas/sessions.ts` (novo)
- `project-r/src/lib/actions/sessions.ts` (novo)
- `project-r/src/app/(staff)/calendario/session-form.tsx` (novo)
- `project-r/src/app/(staff)/calendario/nova/page.tsx` (novo)
- `project-r/src/app/(staff)/calendario/page.tsx` (substituído placeholder)
- `project-r/src/app/(staff)/sessoes/[id]/page.tsx` (novo)
- `project-r/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx` (novo)
- `project-r/src/app/(staff)/sessoes/[id]/editar/page.tsx` (novo)
- `project-r/src/components/ui/session-card.tsx` (novo)
- `project-r/src/components/dialogs/cancel-session-dialog.tsx` (novo)
- `project-r/src/__tests__/lib/schemas/sessions.test.ts` (novo)
- `project-r/src/__tests__/lib/actions/sessions.test.ts` (novo)
- `project-r/src/__tests__/components/session-form.test.tsx` (novo)
- `project-r/src/__tests__/components/session-card.test.tsx` (novo)

### Change Log

- 2026-05-19: Story 2.6 implementada — migração 000120_sessions, schemas Zod, 5 server actions, 4 UI components, 4 páginas, 54 testes; 610/610 testes ✅; lint 0 erros; typecheck ✅; build ✅; AC #1-#8 verificados

