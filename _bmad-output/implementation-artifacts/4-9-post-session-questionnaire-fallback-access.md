# Story 4.9: Post-Session Questionnaire — Fallback Access via /hoje and Phase-Aware Guard

**Status:** done

**Story ID:** 4.9
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)
**Criado:** 2026-05-24
**Story anterior:** 4-8-pre-post-session-push-notifications-with-configurable-x-y

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que a Story 4.8 esteja **done** antes de começar.
> A Story 4.8 criou: `notification_log`, `notification_settings`, Edge Functions `schedule-session-pushes` + `send-push` com deep links `/questionario/<sessionId>/post`.

---

## Contexto de Produto

A Story 4.8 implementou a infraestrutura de push notifications que envia um deep link para `/questionario/<sessionId>/post` após a sessão terminar. Esse deep link é o **caminho principal** para o jogador responder ao questionário pós-sessão.

**Gap identificado durante o code review de 4.8:**

1. **Bug latente:** A página `/questionario/[sessionId]/[phase]` verifica `session.status !== 'scheduled'` e devolve erro para qualquer outro status. Se a sessão passar a `completed`, o deep link da notificação push **falha com erro visível ao jogador**.

2. **Sem fallback UI:** Se o jogador dispensar ou não receber a notificação (status `'failed'`/`'skipped'`), não existe nenhum caminho na UI para aceder ao questionário pós-sessão:
   - `/hoje` mostra apenas a próxima sessão agendada, sempre com link para `/pre` (hardcoded em `SessionCard`)
   - `/historico` apenas lista respostas já submetidas — sem CTA para responder

Esta story resolve os dois gaps: corrige o guard da página do questionário e adiciona uma secção "Sessão recente" em `/hoje` com o CTA de pós-sessão.

---

## Story

As a Jogador,
I want to access the post-session questionnaire from the /hoje page when I miss or dismiss the push notification,
So that I can always fulfill my contribution to the team's data even without push notifications.

---

## Acceptance Criteria

---

### AC #1 — Questionnaire Page: Phase-Aware Session Status Guard

**Given** the route `/questionario/[sessionId]/[phase]`

**When** `phase = 'post'`

**Then** the page accepts sessions with `status IN ('scheduled', 'completed')` — not only `'scheduled'`

**And** if `session.status = 'cancelled'`, the page shows an error "Sessão cancelada" (same error pattern as existing) and does NOT redirect (consistent with current behaviour for invalid status)

**When** `phase = 'pre'`

**Then** the page continues to require `status = 'scheduled'` (unchanged)

**Implementation note:** Change the existing check:
```typescript
// Before (Story 4.2 simplification — only scheduled):
if (sessionResult.data.status !== "scheduled") { ... }

// After (phase-aware):
const isValidStatus =
  phase === "post"
    ? sessionResult.data.status === "scheduled" || sessionResult.data.status === "completed"
    : sessionResult.data.status === "scheduled";
if (!isValidStatus) { ... }
```

---

### AC #2 — New Server Action: `getSessionFatigueStatus`

**Given** Server Action `getSessionFatigueStatus(sessionId: string)` in `lib/actions/fatigue.ts`

**When** called by an authenticated player

**Then** it returns `Result<{ pre: boolean; post: boolean }, AppError>` where each boolean is `true` if a `fatigue_responses` row exists for the current player + that session + that phase

**And** uses RLS — the player can only see their own rows (no explicit `player_id` filter needed beyond RLS, but defence-in-depth requires adding `.eq("player_id", player.id)`)

**And** performs a single query selecting `phase` from `fatigue_responses` WHERE `player_id = player.id AND session_id = sessionId`

**And** never returns health data — only booleans (NFR21)

**Given** no rows exist for the session

**When** `getSessionFatigueStatus` is called

**Then** returns `{ pre: false, post: false }`

**Given** both phases answered

**When** `getSessionFatigueStatus` is called

**Then** returns `{ pre: true, post: true }`

---

### AC #3 — `/hoje` Page: Secção "Sessão Recente" com CTA Pós-Sessão

**Given** a player navigates to `/hoje`

**When** the page loads

**Then** the page continues to show "Próxima sessão" (existing behaviour, unchanged)

**And** additionally queries sessions from the **last 24 hours** where `status IN ('scheduled', 'completed')` and `scheduled_at >= now() - interval '24 hours'` and `scheduled_at < now()`

**And** if such a session exists **AND** `getSessionFatigueStatus(session.id).post = false`

**Then** renders a "Sessão recente" section below the "Próxima sessão" section with a `<SessionCard>` linking to `/questionario/${session.id}/post`

**And** if `getSessionFatigueStatus(session.id).post = true` (already answered)

**Then** the "Sessão recente" section is NOT rendered (no need to show a completed item)

**When** no session exists in the last 24h

**Then** the "Sessão recente" section is not rendered (no empty state — page stays clean)

**And** the "Próxima sessão" `<EmptyState>` remains unchanged when there is also no upcoming session

---

### AC #4 — `SessionCard`: Phase-Aware Deep Link

**Given** `<SessionCard>` receives a new optional prop `phase?: 'pre' | 'post'`

**When** `phase = 'post'`

**Then** the card's `href` links to `/questionario/${session.id}/post`

**When** `phase = 'pre'` or `phase` is undefined (default)

**Then** the card's `href` links to `/questionario/${session.id}/pre` (existing behaviour, backward compatible)

**And** existing callers that don't pass `phase` continue to work unchanged (default = pre for staff routes not applicable, player href was always pre)

**Note:** Staff (`userRole !== 'player'`) always use `/sessoes/${session.id}` regardless of `phase` prop (existing logic preserved).

---

### AC #5 — Cobertura de Testes

**Given** unit + integration tests

**When** tests run

**Then** coverage includes (≥80%):

- `getSessionFatigueStatus`: unanswered (returns false/false), pre-only answered (true/false), both answered (true/true), player sees only own data (mock different player_id → still false)
- Questionnaire page guard: `phase='post'` + `status='completed'` → renders form (not error); `phase='post'` + `status='cancelled'` → shows error; `phase='pre'` + `status='completed'` → still shows error (unchanged)
- `/hoje` page: upcoming session shown; recent session with unanswered post → shows "Sessão recente" section; recent session with answered post → "Sessão recente" hidden; no recent session → clean page
- `SessionCard`: `phase='post'` generates `/post` href; default (undefined) generates `/pre` href; staff role always goes to `/sessoes/[id]`

---

## Technical Context — Dev Notes

### Ficheiros a modificar (UPDATE)

| Ficheiro | Natureza | O que muda |
|---|---|---|
| `sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx` | UPDATE | AC #1: phase-aware status guard |
| `sparta/src/lib/actions/fatigue.ts` | UPDATE | AC #2: adicionar `getSessionFatigueStatus()` |
| `sparta/src/app/(player)/hoje/page.tsx` | UPDATE | AC #3: query de sessões recentes + passe de props |
| `sparta/src/components/app/today-page-content.tsx` | UPDATE | AC #3: renderizar secção "Sessão recente" |
| `sparta/src/components/ui/session-card.tsx` | UPDATE | AC #4: prop `phase?: 'pre' | 'post'` |

### Ficheiros de testes (NEW ou UPDATE)

| Ficheiro | Natureza |
|---|---|
| `sparta/src/lib/actions/__tests__/fatigue.test.ts` | UPDATE — adicionar testes para `getSessionFatigueStatus` |
| `sparta/src/__tests__/questionnaire-phase-guard.test.tsx` | NEW — ou adicionar ao ficheiro de testes existente da página |
| `sparta/src/__tests__/today-page.test.tsx` | NEW — ou UPDATE se existir |

### Sem migração SQL necessária

Esta story não cria tabelas novas. Usa apenas `fatigue_responses` (Story 4.1) e `sessions` (Story 2.x) já existentes.

---

### Estado Actual da Página do Questionário

```typescript
// sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx
// Linha ~94 — guard ACTUAL (só aceita 'scheduled'):
if (sessionResult.data.status !== "scheduled") {
  const errMsg = `session status is '${sessionResult.data.status}', expected 'scheduled'`;
  // renderiza página de erro
}
```

**Problema:** Se a sessão passou a `completed` (ex: staff marcou como concluída), o jogador que clicar no deep link da notificação `post` vê um ecrã de erro.

**Fix:**
```typescript
// NOVO guard phase-aware:
const isValidForPhase =
  phase === "post"
    ? sessionResult.data.status !== "cancelled"  // aceita 'scheduled' E 'completed'
    : sessionResult.data.status === "scheduled";  // pre: só 'scheduled'

if (!isValidForPhase) {
  const errMsg = phase === "post"
    ? `sessão cancelada — não é possível responder ao questionário`
    : `session status is '${sessionResult.data.status}', expected 'scheduled'`;
  // renderiza página de erro (mesmo padrão existente)
}
```

---

### Estado Actual do `/hoje` Page

```typescript
// sparta/src/app/(player)/hoje/page.tsx
// Query ACTUAL — apenas sessões futuras, apenas 'scheduled':
const result = await getSessionsForClub({
  from: now.toISOString(),
  to: sevenDaysLater.toISOString(),
  status: "scheduled",
});
const nextSession = result.ok ? (result.data?.[0] ?? null) : null;
```

**O que adicionar:**

```typescript
// Query para sessões recentes (últimas 24h):
const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const recentResult = await getSessionsForClub({
  from: twentyFourHoursAgo.toISOString(),
  to: now.toISOString(),
  // Sem filtro de status — aceitar 'scheduled' e 'completed'
  // NOTA: getSessionsForClub sem `status` retorna todas.
  // Filtrar manualmente para excluir 'cancelled'.
});
const recentSessions = recentResult.ok
  ? (recentResult.data ?? []).filter(s => s.status !== "cancelled")
  : [];
const recentSession = recentSessions[recentSessions.length - 1] ?? null; // a mais recente
```

**ATENÇÃO:** Verificar a assinatura actual de `getSessionsForClub` em `sparta/src/lib/actions/sessions.ts`:
- Se o filtro `status` é obrigatório, passar `undefined` ou omitir para não filtrar.
- Se `getSessionsForClub` sempre filtra por status, é necessário passar `status: undefined` ou adicionar suporte a `status?: SessionStatus`.
- Verificar o código actual antes de implementar — não assumir.

Em seguida, verificar status de fadiga da sessão recente:
```typescript
let recentSessionPostAnswered = false;
if (recentSession) {
  const statusResult = await getSessionFatigueStatus(recentSession.id);
  recentSessionPostAnswered = statusResult.ok ? statusResult.data.post : false;
}
const showRecentSession = recentSession !== null && !recentSessionPostAnswered;
```

---

### Estado Actual do `SessionCard`

```typescript
// sparta/src/components/ui/session-card.tsx — ACTUAL
// href hardcoded para 'pre':
const href =
  userRole === "player"
    ? `/questionario/${session.id}/pre`   // ← sempre pre
    : `/sessoes/${session.id}`;
```

**Fix:**
```typescript
// Adicionar prop:
interface SessionCardProps {
  session: Session;
  userRole?: "player" | "staff" | "analyst" | "coach";
  phase?: "pre" | "post"; // NOVO — default 'pre' para backward compatibility
}

// href phase-aware:
const href =
  userRole === "player"
    ? `/questionario/${session.id}/${phase ?? "pre"}`
    : `/sessoes/${session.id}`;
```

---

### Nova Server Action: `getSessionFatigueStatus`

```typescript
// Adicionar a sparta/src/lib/actions/fatigue.ts

/**
 * getSessionFatigueStatus — Verifica se o jogador autenticado já respondeu ao questionário
 * de fadiga para uma dada sessão (pré e/ou pós-sessão).
 *
 * Retorna apenas booleans — nunca devolve dados de saúde (NFR21).
 * RLS garante que o player vê apenas os seus próprios rows.
 * Defence-in-depth: filtro explícito por player_id.
 */
export async function getSessionFatigueStatus(
  sessionId: string
): Promise<Result<{ pre: boolean; post: boolean }, AppError>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!player) return ok({ pre: false, post: false }); // jogador sem registo → nenhuma resposta

  // eslint-disable-next-line custom/no-direct-health-data-read -- player reads own boolean status only; no metric derived
  const { data: rows } = await supabase
    .from("fatigue_responses")
    .select("phase")
    .eq("session_id", sessionId)
    .eq("player_id", player.id);

  const phases = new Set((rows ?? []).map(r => r.phase));
  return ok({ pre: phases.has("pre"), post: phases.has("post") });
}
```

**NOTA sobre eslint:** O rule `custom/no-direct-health-data-read` aplica-se a leituras de staff de dados de saúde de outros jogadores. Aqui o player lê apenas `phase` (uma string enum) dos seus próprios dados via RLS. Usar o inline disable com justificação.

---

### UX — Secção "Sessão Recente" em `/hoje`

A UI deve ser **discreta** e não alarmar o jogador. Sugestão de layout:

```
┌─────────────────────────────────────┐
│  Próxima sessão                      │  ← secção existente (inalterada)
│  [SessionCard → /pre]                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Sessão recente — pós-sessão         │  ← nova secção (só se houver sessão recente não respondida)
│  [SessionCard phase="post" → /post]  │
└─────────────────────────────────────┘
```

Heading da nova secção: `"Sessão recente"` — em `text-sm font-semibold text-muted-foreground uppercase tracking-wide` (mesmo estilo do "Próxima sessão" existente).

**Não mostrar** a secção se:
- Não há sessão nas últimas 24h
- O post já foi respondido
- A sessão foi cancelada

**Não mostrar EmptyState** para a secção — simplesmente não renderiza.

---

### RLS e Segurança

- `getSessionFatigueStatus` usa o cliente regular (não service role) — RLS aplica-se automaticamente
- O jogador nunca vê dados de outros jogadores
- A query só retorna `phase` (enum string) — nenhum dado de saúde exposto (NFR21)
- Filtro defence-in-depth `.eq("player_id", player.id)` além de RLS (padrão estabelecido na Story 4.6)

---

### Padrões a Seguir (Aprendizagens das Stories Anteriores)

**De Story 4.2 (página do questionário):**
- `await params` é obrigatório em Next.js 15 (ver comentário no topo do ficheiro existente)
- `.maybeSingle()` em vez de `.single()` para queries que podem retornar null
- Erro é renderizado como componente (não redirect) — manter este padrão

**De Story 4.6 (dados mediados):**
- Disable inline ESLint `custom/no-direct-health-data-read` com justificação quando o player lê os seus próprios dados raw
- `.eq("player_id", player.id)` como defence-in-depth mesmo com RLS activo

**De Story 4.8 (code review):**
- `getSessionsForClub` aceita `status?: SessionStatus` (verificar o código actual — pode já aceitar undefined para "sem filtro")
- `.filter(s => s.status !== "cancelled")` client-side como guard explícito

**De Story 3.11 (auditedRead):**
- Staff a ler dados de fadiga de outros jogadores DEVE usar `auditedRead()` — mas aqui é o **próprio jogador** a ler os seus dados. Não usar `auditedRead()` nem criar audit log (FR26 explícito: player self-reads não requerem auditoria).

---

### Verificações Antes de Implementar

1. **Ler `getSessionsForClub` completo** — confirmar comportamento quando `status` é `undefined` vs omitido. O filtro actual usa `.eq("status", validated.data.status)` — se `status` for `undefined`, pode não aplicar o filtro ou pode falhar.

2. **Verificar `TodayPageContent` props** — actualmente recebe `nextSession: Session | null` e `userRole`. Vai precisar de receber também `recentSession: Session | null` para a nova secção.

3. **Verificar se `today-page-content.tsx` é um client component** — é (`'use client'`). O fetch de dados continua no server component `/hoje/page.tsx`, que passa os dados como props. Não chamar Server Actions de dentro de `TodayPageContent`.

4. **`SessionCard` é um client component** — verificar se a prop `phase` precisa de ser serializable (é uma string — ok).

---

### Estrutura de Testes Recomendada

```typescript
// Exemplo: getSessionFatigueStatus
describe("getSessionFatigueStatus", () => {
  it("returns { pre: false, post: false } when no responses exist");
  it("returns { pre: true, post: false } when only pre answered");
  it("returns { pre: true, post: true } when both answered");
  it("returns { pre: false, post: false } when player has no player record");
  it("ignores responses from other players (defence-in-depth)");
});

// Exemplo: questionnaire page guard
describe("QuestionarioPage phase-aware guard", () => {
  it("renders form for phase=post + status=completed");
  it("renders form for phase=post + status=scheduled (backward compat)");
  it("renders error for phase=post + status=cancelled");
  it("renders form for phase=pre + status=scheduled (unchanged)");
  it("renders error for phase=pre + status=completed (unchanged)");
});

// Exemplo: SessionCard phase prop
describe("SessionCard phase prop", () => {
  it("links to /pre by default for player role");
  it("links to /post when phase='post' for player role");
  it("always links to /sessoes for staff regardless of phase");
});
```

---

## Review Findings

### Patches (4)

- [x] [Review][Patch] `getSessionFatigueStatus`: erro da query `fatigue_responses` descartado silenciosamente — quando Supabase retorna erro, a função retorna `ok({pre:false,post:false})` em vez de `err()`, mostrando ao jogador que o questionário está por responder durante falhas de DB [sparta/src/lib/actions/fatigue.ts]
- [x] [Review][Patch] `getSessionFatigueStatus`: sem verificação explícita de role — qualquer utilizador autenticado (coach/staff) obtém `{pre:false,post:false}` em vez de erro de autorização; spec requer "authenticated player only" [sparta/src/lib/actions/fatigue.ts]
- [x] [Review][Patch] Query "sessão recente" usa `lte` (<=) no limite superior — sessão com `scheduled_at === now` aparece simultaneamente em "Próxima sessão" e "Sessão recente"; corrigir com filtro `s.scheduled_at < now` client-side [sparta/src/app/(player)/hoje/page.tsx]
- [x] [Review][Patch] Mensagem de erro de fallback para status inválido está em inglês e é texto de debug visível ao jogador: `"session status is '...', expected 'scheduled'"` — substituir por mensagem em português; para phase=post o expected inclui 'scheduled' OU 'completed' [sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx]

### Deferred (2)

- [x] [Review][Defer] Padrão de renderização de erros usa `<p className="text-red-600 font-mono text-sm">` para todos os erros do questionário [sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx] — deferred, pre-existente da Story 4.2
- [x] [Review][Defer] Dois `Promise.all` sequenciais — as chamadas de fatigue status não podem correr em paralelo com as queries de sessões porque os IDs só são conhecidos após o primeiro await; constrangimento arquitectural [sparta/src/app/(player)/hoje/page.tsx] — deferred, constrangimento arquitectural reconhecido na spec

---

## Tasks/Subtasks

- [x] AC #1: Update questionnaire page with phase-aware status guard
- [x] AC #2: Create `getSessionFatigueStatus` Server Action
- [x] AC #3: Update `/hoje` page to query recent sessions (last 24h)
- [x] AC #3: Update `TodayPageContent` to render "Sessão recente" section
- [x] AC #4: Add `phase` prop to `SessionCard` component
- [x] AC #5: Write comprehensive unit tests
- [x] Run full test suite and validate all changes

## Dev Notes

### Implementation Summary

**Files Modified:**
1. `sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx` — Phase-aware status guard (AC #1)
2. `sparta/src/lib/actions/fatigue.ts` — New `getSessionFatigueStatus()` function (AC #2)
3. `sparta/src/app/(player)/hoje/page.tsx` — Query recent sessions and pass to component (AC #3)
4. `sparta/src/components/app/today-page-content.tsx` — Render "Sessão recente" section (AC #3)
5. `sparta/src/components/ui/session-card.tsx` — Added `phase?: 'pre' | 'post'` prop (AC #4)

**Test Files Created:**
1. `sparta/src/lib/actions/__tests__/fatigue-session-status.test.ts` — 6 tests for `getSessionFatigueStatus()` (AC #2)
2. `sparta/src/components/ui/__tests__/session-card.test.tsx` — 5 tests for phase prop behavior (AC #4)
3. `sparta/src/app/(player)/questionario/[sessionId]/[phase]/__tests__/page.test.tsx` — 6 tests for guard logic (AC #1)

### Test Results
- ✅ All new tests passing (17 tests)
- ✅ All existing tests still passing (1291 tests)
- ✅ Build successful
- ✅ Lint: 0 errors (77 warnings, all pre-existing)
- ✅ Typecheck: passed

### Key Implementation Details

**AC #1 — Phase-aware Guard:**
- Post phase now accepts `status IN ('scheduled', 'completed')` instead of just `'scheduled'`
- Pre phase still requires `status = 'scheduled'` (unchanged)
- Cancelled sessions show specific error message for post phase

**AC #2 — `getSessionFatigueStatus`:**
- Returns only booleans `{ pre: boolean; post: boolean }` (NFR21)
- Uses RLS with defence-in-depth `.eq("player_id", player.id)` filter
- Returns `{ pre: false, post: false }` when player has no record

**AC #3 — Recent Session Section:**
- Queries sessions from last 24 hours where `status IN ('scheduled', 'completed')`
- Filters out cancelled sessions
- Only shows section if recent session exists AND post hasn't been answered yet

**AC #4 — SessionCard Phase Prop:**
- Defaults to `'pre'` for backward compatibility
- Staff/analyst roles always use `/sessoes/[id]` regardless of phase

### Patterns Applied
- Follows Story 4.2 guard pattern (await params, .maybeSingle())
- Follows Story 4.6 defence-in-depth with `.eq("player_id", player.id)`
- ESLint disable with justification for player self-reads
- Fire-and-forget operations pattern established in earlier stories
- Mock structure follows fatigue-srpe.test.ts conventions
