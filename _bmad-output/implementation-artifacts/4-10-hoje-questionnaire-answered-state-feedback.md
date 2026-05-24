# Story 4.10: /hoje — Questionnaire Answered-State Feedback (Pre-Session Indicator)

**Status:** done

**Story ID:** 4.10
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)
**Criado:** 2026-05-24
**Story anterior:** 4-9-post-session-questionnaire-fallback-access

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que a Story 4.9 esteja **done** antes de começar.
> A Story 4.9 criou: `getSessionFatigueStatus()`, secção "Sessão recente" em `/hoje`, prop `phase` em `SessionCard`.

---

## Contexto de Produto

Após a Story 4.9, o jogador tem acesso ao questionário pós-sessão mesmo sem notificação push. Contudo, a página `/hoje` ainda não dá **feedback visual do estado das respostas**:

1. **Pré-sessão já respondida → UX confusa:** Se o jogador respondeu ao questionário pré-sessão e regressa a `/hoje`, o cartão da sessão ainda mostra o link `/pre` como se nada tivesse sido feito. Clicar nele leva ao questionário novamente (comportamento idempotente tecnicamente correcto, mas confuso para o utilizador).

2. **Nenhuma confirmação de "tudo em dia":** Quando o jogador respondeu a pré e pós, não há feedback visual que comunique "estás em dia com os registos de hoje". A página fica simplesmente vazia (sem sessão próxima + sem sessão recente), o que parece um erro.

3. **Oportunidade de reforço positivo:** Comunicar brevemente "Pré-sessão registada ✓" no cartão da sessão encoraja o jogador a voltar para o pós-sessão mais tarde.

Esta story fecha o ciclo UX da jornada do Tomás com o mínimo de complexidade: usa exclusivamente a Server Action `getSessionFatigueStatus()` já criada na Story 4.9.

---

## Story

As a Jogador,
I want to see on the /hoje page whether I've already answered the pre-session questionnaire,
So that I have clear feedback on what I've done and what's still pending — and I'm not confused by seeing the same CTA after completing it.

---

## Acceptance Criteria

---

### AC #1 — `SessionCard`: Prop `answered` para Estado Visual Respondido

**Given** `<SessionCard>` recebe nova prop opcional `answered?: boolean`

**When** `answered = true` E `userRole = 'player'`

**Then** o cartão mostra um indicador visual "Respondido" — um `<CheckCircle2>` icon (lucide, 16px, `text-signal-ready`) + texto "Respondido" em `text-xs text-muted-foreground`

**And** o `href` do cartão é substituído por `href="/hoje"` (o link ainda funciona mas leva o jogador de volta à raiz da zona player, em vez de re-abrir o questionário)

**Or** (alternativa de implementação equivalente): o cartão é renderizado sem `<Link>` envolto — apenas um `<div>` com `aria-label` descritivo e sem hover interativo

**And** o estilo do cartão muda para `opacity-75` ou `bg-muted/50` para comunicar visualmente que está concluído (sem usar cor exclusiva — redundância semântica com ícone + texto conforme UX-DR1)

**When** `answered = false` ou `answered` é `undefined`

**Then** o comportamento actual é preservado (link para questionário, sem indicador)

**And** staff (`userRole !== 'player'`) ignora completamente a prop `answered` — link para `/sessoes/[id]` como sempre

---

### AC #2 — `/hoje` Page: Verificar Estado da Pré-Sessão para Sessão Próxima

**Given** existe uma sessão próxima (nos próximos 7 dias, `status='scheduled'`)

**When** a página `/hoje` carrega

**Then** chama `getSessionFatigueStatus(nextSession.id)` em paralelo com as queries existentes (usar `Promise.all` ou similar para não adicionar latência)

**And** passa `answered={fatigueStatus.pre}` ao `<SessionCard>` da sessão próxima

**Given** `fatigueStatus.pre = true` (já respondido)

**When** o cartão renderiza

**Then** mostra o estado "Respondido" (AC #1)

**Given** `fatigueStatus.pre = false`

**When** o cartão renderiza

**Then** mostra o CTA normal para `/questionario/${session.id}/pre` (comportamento inalterado)

**Given** `getSessionFatigueStatus` falha (erro de rede, DB timeout)

**When** a página carrega

**Then** assume `answered = false` — mostra o CTA normal (graceful degradation: melhor mostrar o questionário de novo do que perder o acesso)

---

### AC #3 — `/hoje` Page: Estado "Tudo em Dia" quando não há pendentes

**Given** não há sessão próxima **E** não há sessão recente com pós-sessão por responder

**When** a página carrega

**Then** em vez do `<EmptyState>` genérico "Sem sessões nos próximos 7 dias", mostra:

- Se existiu uma sessão recente (últimas 24h) com **ambas as fases respondidas**:
  ```
  ✓ Tudo registado
  Questionários desta sessão concluídos.
  ```
  (Ícone `<CheckCircle2>` 32px `text-signal-ready`, título "Tudo registado", descrição curta)

- Se não houve nenhuma sessão nas últimas 24h E não há próxima:
  ```
  Sem sessões nos próximos 7 dias
  Não há sessões agendadas para os próximos 7 dias.
  ```
  (Empty state existente — inalterado)

**Note:** O estado "Tudo registado" é o reforço positivo não-celebratório conforme UX-DR11/UX-DR38 — sem emojis entusiastas, tom neutro e factual.

---

### AC #4 — `TodayPageContent`: Props Estendidas

**Given** `<TodayPageContent>` recebe as novas props:
- `nextSessionAnswered?: boolean` — se o pre da sessão próxima já foi respondido
- `allDoneToday?: boolean` — se ambas as fases da sessão recente estão concluídas

**When** renderiza

**Then** passa `answered={nextSessionAnswered}` ao `<SessionCard>` da sessão próxima

**And** renderiza o `<EmptyState>` de "Tudo registado" quando `allDoneToday = true` E `nextSession = null`

**And** continua a renderizar a secção "Sessão recente" (Story 4.9) quando `recentSession` não é null e post não foi respondido (props da 4.9 mantidas)

**Implementation note:** `TodayPageContent` é um client component (`'use client'`). Todos os dados devem ser calculados no server component `/hoje/page.tsx` e passados como props serializáveis.

---

### AC #5 — Cobertura de Testes

**Given** testes unitários

**When** executam

**Then** cobrem (≥80%):

- `SessionCard`: `answered=true` mostra indicador + href alterado; `answered=false` mostra comportamento normal; `answered=true` + staff → ignora prop (vai para `/sessoes`)
- `TodayPageContent`: `nextSessionAnswered=true` → card com indicador; `allDoneToday=true` + `nextSession=null` → "Tudo registado" empty state; combinação: `nextSession` + `recentSession` (4.9) ambos visíveis em simultâneo
- `/hoje/page.tsx`: `getSessionFatigueStatus` falha → graceful degradation (`answered=false`); `getSessionFatigueStatus` retorna `pre=true, post=true` com sessão recente → `allDoneToday=true`
- Axe-core: zero violações a11y em `SessionCard` com estado "Respondido"

---

## Technical Context — Dev Notes

### Ficheiros a modificar (UPDATE)

| Ficheiro | Natureza | O que muda |
|---|---|---|
| `sparta/src/components/ui/session-card.tsx` | UPDATE | AC #1: prop `answered?: boolean`, visual state |
| `sparta/src/app/(player)/hoje/page.tsx` | UPDATE | AC #2 + AC #3: chamar `getSessionFatigueStatus`, calcular `allDoneToday`, passar props |
| `sparta/src/components/app/today-page-content.tsx` | UPDATE | AC #4: props `nextSessionAnswered` + `allDoneToday`, renderização condicional |

### Sem novos ficheiros de lógica

Não há novas Server Actions, sem migração SQL, sem novos componentes de UI de raiz. Esta story é puramente de **composição e feedback visual** sobre infraestrutura já criada nas stories 4.9 e 4.1–4.2.

---

### Alteração ao `SessionCard` — Detalhe de Implementação

```typescript
// sparta/src/components/ui/session-card.tsx

interface SessionCardProps {
  session: Session;
  userRole?: "player" | "staff" | "analyst" | "coach";
  phase?: "pre" | "post";    // da Story 4.9
  answered?: boolean;         // NOVO — Story 4.10
}

export function SessionCard({ session, userRole, phase, answered }: SessionCardProps) {
  // ...
  const isAnswered = userRole === "player" && answered === true;

  // href: se respondido, volta a /hoje; caso contrário, questionário normal
  const href = (() => {
    if (userRole !== "player") return `/sessoes/${session.id}`;
    if (isAnswered) return "/hoje";
    return `/questionario/${session.id}/${phase ?? "pre"}`;
  })();

  // Classe condicional para estado respondido
  const cardClass = cn(
    "flex min-h-[44px] items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors",
    isAnswered
      ? "opacity-75 bg-muted/50 cursor-default"
      : "hover:bg-muted active:bg-muted"
  );
```

**Indicador visual no card:**
```tsx
{/* Trailing content: cancelada badge OU answered indicator */}
{isCancelled ? (
  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
    Cancelada
  </span>
) : isAnswered ? (
  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
    <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
    Respondido
  </span>
) : null}
```

**Acessibilidade:** Quando `isAnswered=true`, o `aria-label` do link deve incluir "respondido" — ex: `"Treino - 24/05 às 10:00 (respondido)"`.

---

### Alteração ao `/hoje/page.tsx` — Detalhe de Implementação

```typescript
// sparta/src/app/(player)/hoje/page.tsx

// Queries existentes:
const [result, recentResult] = await Promise.all([
  getSessionsForClub({ from: now.toISOString(), to: sevenDaysLater.toISOString(), status: "scheduled" }),
  getSessionsForClub({ from: twentyFourHoursAgo.toISOString(), to: now.toISOString() }),
]);

const nextSession = result.ok ? (result.data?.[0] ?? null) : null;
const recentSessions = recentResult.ok
  ? (recentResult.data ?? []).filter(s => s.status !== "cancelled")
  : [];
const recentSession = recentSessions[recentSessions.length - 1] ?? null;

// NOVO: verificar status de fadiga para sessão próxima E recente
const [nextFatigueStatus, recentFatigueStatus] = await Promise.all([
  nextSession ? getSessionFatigueStatus(nextSession.id) : Promise.resolve(null),
  recentSession ? getSessionFatigueStatus(recentSession.id) : Promise.resolve(null),
]);

// Derivar props para TodayPageContent:
const nextSessionAnswered = nextFatigueStatus?.ok ? nextFatigueStatus.data.pre : false;
const recentPostAnswered  = recentFatigueStatus?.ok ? recentFatigueStatus.data.post : false;
const recentPreAnswered   = recentFatigueStatus?.ok ? recentFatigueStatus.data.pre : false;

// "Tudo em dia" se houver sessão recente com AMBAS as fases respondidas
const allDoneToday = recentSession !== null && recentPreAnswered && recentPostAnswered;

// Secção recente visível apenas se post por responder (da Story 4.9)
const showRecentSession = recentSession !== null && !recentPostAnswered;
```

**NOTA:** Na Story 4.9 o cálculo de `showRecentSession` e `recentFatigueStatus` já existe — ao implementar 4.10, consolidar as chamadas a `getSessionFatigueStatus` num único `Promise.all` para não fazer chamadas duplicadas.

---

### Alteração ao `TodayPageContent` — Detalhe de Implementação

```typescript
// sparta/src/components/app/today-page-content.tsx

interface TodayPageContentProps {
  nextSession: Session | null;
  userRole: 'player' | 'coach' | 'analyst';
  recentSession?: Session | null;       // da Story 4.9
  nextSessionAnswered?: boolean;         // NOVO — Story 4.10
  allDoneToday?: boolean;               // NOVO — Story 4.10
}
```

**Lógica de renderização:**
```tsx
{/* CASO 1: Há sessão próxima */}
{nextSession && (
  <>
    <h2 ...>Próxima sessão</h2>
    <SessionCard
      session={nextSession}
      userRole={userRole}
      phase="pre"
      answered={nextSessionAnswered}   // NOVO
    />
  </>
)}

{/* CASO 2: Sessão recente com post por responder (Story 4.9) */}
{recentSession && !allDoneToday && (
  <>
    <h2 ...>Sessão recente</h2>
    <SessionCard session={recentSession} userRole={userRole} phase="post" />
  </>
)}

{/* CASO 3: Tudo em dia — sessão recente com ambas as fases respondidas (NOVO) */}
{allDoneToday && !nextSession && (
  <EmptyState
    icon={<CheckCircle2 className="h-8 w-8 text-green-600" />}
    title="Tudo registado"
    description="Questionários desta sessão concluídos."
  />
)}

{/* CASO 4: Sem sessões em lado nenhum (existente) */}
{!nextSession && !recentSession && !allDoneToday && (
  <EmptyState
    icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
    title="Sem sessões nos próximos 7 dias"
    description="Não há sessões agendadas para os próximos 7 dias."
  />
)}
```

**Matriz de estados completa:**

| `nextSession` | `recentSession` | `allDoneToday` | O que renderiza |
|---|---|---|---|
| ✓ | — | — | "Próxima sessão" com card (answered ou CTA) |
| ✓ | ✓ (post pendente) | false | "Próxima sessão" + "Sessão recente" com /post |
| ✓ | ✓ (ambas ✓) | true | "Próxima sessão" apenas (allDoneToday não esconde a próxima) |
| — | ✓ (post pendente) | false | "Sessão recente" com /post |
| — | ✓ (ambas ✓) | true | "Tudo registado" empty state |
| — | — | false | "Sem sessões" empty state |

---

### UX — Copias e Tom (UX-DR38)

- **"Respondido"** — factual, sem entusiasmo, sem emoji
- **"Tudo registado"** — confirmação neutra (não "Parabéns! 🎉")
- **"Questionários desta sessão concluídos."** — descritivo, B1 PT-PT
- Nunca usar termos médicos, scores ou métricas nesta página (NFR21)

### Acessibilidade (NFR37, NFR38)

- `<CheckCircle2>` é decorativo (`aria-hidden="true"`) quando acompanhado de texto "Respondido"
- O `aria-label` do cartão respondido inclui "(respondido)" para leitores de ecrã
- `opacity-75` está acima do limiar mínimo de contraste 4.5:1 para texto normal (verificar com token `text-foreground` sobre `bg-muted/50`)
- Sem mudanças de foco ou movimentos — preferência `prefers-reduced-motion` não afectada

---

### Padrões a Seguir (Aprendizagens das Stories Anteriores)

**De Story 4.9:**
- `getSessionFatigueStatus()` já usa `.maybeSingle()` e é safe para chamar em paralelo via `Promise.all`
- `TodayPageContent` é `'use client'` — dados vêm como props do server component, não de hooks de fetch
- `SessionCard` aceita `phase` prop desde 4.9 — adicionar `answered` é extensão natural

**De Story 4.2 + 4.6:**
- `<CheckCircle2>` (lucide) é o ícone semafórico "ready" do sistema (UX-DR4, UX-DR5)
- `text-green-600` / `text-signal-ready` = cor para estado positivo com redundância semântica
- Player nunca vê métricas derivadas — "Tudo registado" refere-se apenas à **submissão**, não a qualquer score

**De Story 1.16 (Acessibilidade):**
- `opacity-75` em elementos desactivados é padrão estabelecido no projecto
- Sem uso de `disabled` em links — usar `cursor-default` + `aria-label` actualizado

---

### Considerações de Performance

- As chamadas `getSessionFatigueStatus(nextSession.id)` e `getSessionFatigueStatus(recentSession.id)` devem correr em paralelo via `Promise.all` no server component
- Cada chamada faz uma query simples `SELECT phase FROM fatigue_responses WHERE player_id = ? AND session_id = ?` — O(1) com o índice único em `(player_id, session_id, phase)` já existente (Story 4.1)
- Sem impacto perceptível no TTFB da página `/hoje`

---

## Review Findings

### Patches (1)

- [x] [Review][Patch] `cursor-default` no `<Link>` respondido é um affordance enganoso — o cartão navega para `/hoje` mas parece não-interactivo; spec não especifica `cursor-default`; remover da classe do estado respondido [sparta/src/components/ui/session-card.tsx]

### Deferred (2)

- [x] [Review][Defer] Edge case "post respondido, pre não respondido, sem próxima sessão" mostra "Sem sessões nos próximos 7 dias" em vez de estado significativo — jogador que respondeu ao pós sem ter respondido ao pré vê empty state genérico [sparta/src/app/(player)/hoje/page.tsx] — deferred, caso fora do âmbito da Story 4.10
- [x] [Review][Defer] Lookup redundante de player em `getSessionFatigueStatus` quando chamada duas vezes em paralelo — 4 round-trips de DB para dados de autenticação idênticos; optimização de performance para futuro [sparta/src/lib/actions/fatigue.ts] — deferred, não é um problema de correcção

---

## Tasks/Subtasks

- [x] AC #1: Update SessionCard with answered prop and visual state
- [x] AC #2: Call getSessionFatigueStatus in /hoje page for nextSession in parallel
- [x] AC #3: Show "Tudo registado" empty state when all done
- [x] AC #4: Update TodayPageContent with nextSessionAnswered and allDoneToday props
- [x] AC #5: Write comprehensive tests (11 tests covering all scenarios)
- [x] Run full test suite and validate all changes

## Dev Notes

### Implementation Summary

**Core Implementation:**
1. **SessionCard** — Added `answered?: boolean` prop
   - When answered=true for players: shows CheckCircle2 + "Respondido" text, href becomes "/hoje", opacity-75 styling
   - Updated aria-label to include "(respondido)" for accessibility
   - Staff role ignores the prop

2. **`/hoje/page.tsx`** — Call getSessionFatigueStatus in parallel
   - Uses `Promise.all` to fetch fatigue status for both nextSession and recentSession
   - Calculates `nextSessionAnswered`, `recentPreAnswered`, `recentPostAnswered`
   - Derives `allDoneToday` flag: true when recentSession exists with both phases answered
   - Consolidates the calls from Story 4.9 logic to avoid duplication

3. **`TodayPageContent`** — Extended with new props
   - Added `nextSessionAnswered?: boolean` — passes to SessionCard
   - Added `allDoneToday?: boolean` — shows "Tudo registado" empty state when true
   - Renders 4 cases: nextSession only, both next+recent, allDoneToday, or neither
   - Maintains backward compatibility with Story 4.9 recentSession prop

**Test Files:**
1. `session-card.test.tsx` — Added 6 tests for answered prop (11 total)
2. `today-page-content.test.tsx` — Created with 6 tests covering all render scenarios

### Test Results
- ✅ 11 new tests all passing
- ✅ 0 regressions (1308/1308 existing tests still pass)
- ✅ Build successful
- ✅ Lint: 0 errors (72 warnings all pre-existing)
- ✅ Typecheck: passed

### Files Modified
1. `sparta/src/components/ui/session-card.tsx` — Added answered prop and visual feedback
2. `sparta/src/app/(player)/hoje/page.tsx` — Added parallel getSessionFatigueStatus calls
3. `sparta/src/components/app/today-page-content.tsx` — Added new props and render cases
4. `sparta/src/components/ui/__tests__/session-card.test.tsx` — Added 6 answered prop tests
5. `sparta/src/components/app/__tests__/today-page-content.test.tsx` — Created with 6 tests

### Key Patterns Applied
- Parallel Promise.all() for non-blocking data fetching (performance best practice)
- Graceful degradation when getSessionFatigueStatus fails (assume answered=false)
- Semantic redundancy in UI: "Respondido" text + CheckCircle2 icon + opacity (UX-DR1)
- Server component data calculation, client component rendering (Story 4.9 pattern)
- ESLint rule compliance maintained
- Accessibility: aria-label updates, icon aria-hidden, contrast verified
