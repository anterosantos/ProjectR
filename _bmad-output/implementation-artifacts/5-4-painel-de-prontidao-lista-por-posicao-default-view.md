# Story 5.4: Painel de Prontidão — Lista por Posição (Default View)

**Status:** done

**Story ID:** 5.4  
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)  
**Criado:** 2026-05-25  
**Story anterior:** 5-3-readiness-snapshots-materialized-source-for-the-painel

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que as Stories **5.1**, **5.2**, e **5.3** estejam **done** antes de começar.
>
> | Story | Cria | Necessário para |
> |-------|------|-----------------|
> | 5.1 | `session_metrics` table + `srpe_load` GENERATED STORED | Dados de carga por sessão |
> | 5.2 | `computeAcwr()` em `lib/readiness/acwr.ts` | Scores ACWR para cada jogador |
> | 5.3 | `readiness_snapshots` table + `getClubReadinessSnapshots()` | Fonte de dados materializada para Painel |
>
> Verificar antes de implementar:
> - `sparta/supabase/migrations/000250_readiness_snapshots.sql` existe
> - `sparta/src/lib/actions/readiness.ts` exporta `getClubReadinessSnapshots(sessionId)`
> - `sparta/src/lib/readiness/snapshot.ts` exporta tipos `ReadinessSnapshot`, `ReadinessState`

---

## Story

As a Treinador,
I want the Painel to show 3 aggregate numbers and the squad grouped by position with a semáforo per player,
So that I can glance the team's state in <3 seconds and identify candidates for drill-down.

---

## Acceptance Criteria

### AC #1 — Rota `/prontidao` com Server Component

**Given** a new route `/prontidao` in `sparta/src/app/(staff)/`

**When** a coach opens it (authenticated, role verified by middleware)

**Then** a Server Component `<ReadinessPanel view="list">` renders the page (Story 1.8 pattern: Server Component default, client opt-in)

**And** the page header shows:
- Breadcrumb "Prontidão" (Story 1.9 pattern)
- Toggle button "Formação" (Story 5.6; disabled in MVP with "Em breve" visual) to switch between "Lista" (default) and "Formação" views
- Sticky position during scroll (UX-DR12, UX-DR46)

**And** if no upcoming session within 7 days, the page renders `<EmptyState>` with:
- Icon: `<Calendar className="size-12" />`
- Title: "Sem sessão agendada nas próximas 7 dias"
- Description: "Cria uma para ver o painel"
- CTA button: links to `/calendario/nova` (UX-DR8)

---

### AC #2 — Agregados no Header (3 Números)

**Given** the page renders for a session with readiness snapshots

**When** the page loads

**Then** the header displays 3 large `display-1` 48px numbers:
- **Verde (Ready):** Count of players with `state='ready'`, color `#22c55e` (signal/ready)
- **Amarelo (Caution):** Count of players with `state='caution'`, color `#eab308` (signal/caution)
- **Vermelho (Alert):** Count of players with `state='alert'`, color `#ef4444` (signal/alert)
- Neutros (insufficient data) são **excluídos da contagem** (FR34, UX-DR12)

**And** below each number, a label in small text: "Prontos", "Cuidado", "Alerta" (PT-PT)

**And** the header background is `bg-surface-container` (Design tokens Story 1.8, UX-DR12)

---

### AC #3 — Agrupamento por Posição

**Given** the player list renders

**When** players are fetched from `readiness_snapshots`

**Then** they are grouped into sections:
- **GR** (Guarda-Redes / Goalkeepers)
- **DEF** (Defesa / Defense)
- **MED** (Meio-Campo / Midfield)
- **AVA** (Avançado / Forwards)

**And** each section header shows the position label with a subtle icon (from lucide-react):
- GR: `<Shield className="size-4" />`
- DEF: `<ShieldAlert className="size-4" />`
- MED: `<Zap className="size-4" />`
- AVA: `<Target className="size-4" />`

**And** position grouping is derived from `players.positions` table (Story 2.1, `is_primary=true`)

**And** if a player has multiple positions, they appear under the primary position (UX-DR13)

---

### AC #4 — PlayerRow per Player

**Given** each player in a position group

**When** the row renders

**Then** it displays:
- **Jersey number** (from `players.jersey_num`): small text, aligned left, `text-muted`
- **Player name** (from `players.name`): body text (Story 1.8 typography)
- **Semáforo badge** (from `readiness_snapshot.state`): `<SemaforoBadge state={state} size="md">` (Story 1.8, UX-DR5)
  - Redundant color + icon + shape per UX-DR5 (não é cor só)
  - Badge no final da row, alinhado à direita
- ACWR value (optional display, deferred to Story 5.5 drill-down): omitir desta view, mostrar apenas no drill-down

**And** each row is clickable with `cursor-pointer` hover state — tapping abre `<DrillDownSheet>` (Story 5.5)

**And** tapping ESC ou swipe-down fecha qualquer sheet aberta

---

### AC #5 — Ordenação dentro de cada Grupo (UX-DR35)

**Given** players within a position group are rendered

**When** they sort

**Then** order is:
1. **alert** (vermelho) — primeiro
2. **caution** (amarelo) — segundo
3. **ready** (verde) — terceiro
4. **neutral** (cinzento, dados insuficientes) — último

**And** within the same state, order by ACWR descending (higher load first), **NULLs last**

**Example:** Within "DEF" group, order might be:
```
🔴 #4 João (alert, ACWR=1.8)
🔴 #5 Pedro (alert, ACWR=1.7)
🟡 #3 Maria (caution, ACWR=1.4)
🟢 #6 Ana (ready, ACWR=0.9)
⚪ #7 X (neutral, ACWR=NULL)
```

---

### AC #6 — Performance (NFR1, UX-DR37)

**Given** the Painel loads on 4G mobile (iPhone 12 or slower)

**When** the page first paints

**Then**:
- **FCP (First Contentful Paint)** ≤ 1.5s
- **Aggregate numbers visible** ≤ 2s P95 (for 40 players)
- **Full list rendered** ≤ 3s P95 (per Lighthouse baseline NFR1)

**And** Server Component fetches `readiness_snapshots` via `getClubReadinessSnapshots(sessionId)` (Story 5.3)

**And** data is cached in TanStack Query with `staleTime: 30s` during the 4h pre-session window (Story 5.7)

**And** no re-renders on scroll (Server Component, no Client hooks except drill-down Sheet)

---

### AC #7 — Empty States & Neutral Badge

**Given** a player has `data_sufficient=false` (insufficient historical data for ACWR)

**When** the row renders

**Then**:
- Badge shows `<SemaforoBadge state="neutral" size="md">` — cinzento (signal/neutral)
- Inline `<TooltipExplain>` next to player name:
  - Icon: `<HelpCircle className="size-4" />`
  - Tooltip text: "Em construção. Precisa de 4 semanas de dados." (PT-PT B1, UX-DR9)
  - Trigger: hover on desktop, tap on mobile (UX-DR9, NFR42)

**And** neutral players are sorted last within their position group (AC #5)

---

### AC #8 — Accessibility (NFR37, UX-DR42)

**Given** axe-core test suite runs on the page

**When** checked

**Then** zero violations reported

**Specifics:**
- ✅ Color is NEVER the only signal — each state has icon + shape + color (UX-DR5, UX-DR42)
- ✅ Header numbers have `aria-label` for screen readers: e.g., "5 jogadores prontos"
- ✅ Position section headers have `role="heading" aria-level="2"`
- ✅ Each player row has `<button role="button" aria-label="...">` wrapping clickable area with full context: "Nome, Número X, Posição DEF, Estado Alerta"
- ✅ Badge has `aria-label` describing state in full: "Estado: Alerta"
- ✅ TooltipExplain has `role="tooltip"` and `aria-describedby` linking to explanation (Story 1.8)
- ✅ No focus traps; keyboard navigation works (Tab through rows, Enter to drill-down)
- ✅ Prefers reduced motion respected (Story 1.16, UX-DR41): no animations, just state changes

---

### AC #9 — Dark Mode Support

**Given** the user has `prefers-color-scheme: dark` in OS settings

**When** the page renders

**Then** all colors adapt via Tailwind dark mode utilities:
- Background: `dark:bg-surface-dark`
- Text: `dark:text-on-surface-dark`
- Badges and icons auto-adapt (Story 1.8 design tokens)

**And** Semáforo colors remain distinct in dark mode (signal tokens in Story 1.8 are WCAG AA compliant in both modes)

---

### AC #10 — Teste de Cobertura ≥80%

**Given** testes em:
- `sparta/src/__tests__/app/(staff)/prontidao.test.tsx` — renderização + integração

**When** `npm run test --run` executa

**Then** cobertura inclui (NFR54):
- ✅ Servidor Component: renderiza com session data
- ✅ Agregados: contagem correcta de ready/caution/alert (neutrals excluídos)
- ✅ Agrupamento: 4 grupos de posição, ordem correcta dentro
- ✅ PlayerRow: clickable, opens drill-down (mocked em testes unitários)
- ✅ TooltipExplain: renderiza com `data_sufficient=false`
- ✅ EmptyState: rende quando nenhuma sessão em 7 dias
- ✅ Acessibilidade: axe-core zero violations em snapshot

**And** cobertura ≥80% em lógica de renderização e agrupamento

---

## Tasks / Subtasks

- [x] **Task 1: Rota `/prontidao` com Server Component** (AC: #1)
  - [x] Criar `sparta/src/app/(staff)/prontidao/page.tsx` (Server Component)
  - [x] Importar `ReadinessPanel` de `@/components/domain/readiness/readiness-panel`
  - [x] Renderizar `<ReadinessPanel view="list" />`
  - [x] Implementar fallback `<Skeleton>` em `loading.tsx` (UX-DR44, NFR58)
  - [x] Implementar error boundary em `error.tsx` (Story 1.10)

- [x] **Task 2: Componente `ReadinessPanel` (wrapper)** (AC: #1)
  - [x] Criar `sparta/src/components/domain/readiness/readiness-panel.tsx` (Client Component, `"use client"`)
  - [x] Props: `view: 'list' | 'formation'` (formation deferred, disabled com "Em breve")
  - [x] Estado local: `view` persisted em `sessionStorage` (Story 1.8 UX-DR46, lazy initializer)
  - [x] Renderizar `<ReadinessPanelHeader>` (sticky)
  - [x] Renderizar `<ReadinessPanelList>` ou `<ReadinessPanelFormation>` consoante view (UX-DR12, UX-DR15)

- [x] **Task 3: Componente `ReadinessPanelHeader`** (AC: #2, #1)
  - [x] Criar `sparta/src/components/domain/readiness/readiness-panel-header.tsx`
  - [x] Props: `readyCount: number; cautionCount: number; alertCount: number; view: string; onViewChange: (v) => void`
  - [x] Renderizar 3 grandes números em `text-display-1` 48px
  - [x] Labels: "Prontos", "Cuidado", "Alerta"
  - [x] Toggle button "Formação" (disabled com aria-disabled em MVP)
  - [x] Sticky positioning: `sticky top-0 z-10 bg-surface-container`

- [x] **Task 4: Componente `ReadinessPanelList`** (AC: #3, #4, #5, #6)
  - [x] Criar `sparta/src/components/domain/readiness/readiness-panel-list.tsx` (Client Component)
  - [x] Props: `players: PlayerReadinessData[]; sessionId: string`
  - [x] Agrupar players por posição (GR, DEF, MED, AVA) via `getPositionKey()`
  - [x] Para cada grupo, renderizar `<PositionGroup>`
  - [x] Within each group, sort by state priority + ACWR DESC

- [x] **Task 5: Componente `PositionGroup`** (AC: #3, #4)
  - [x] Criar `sparta/src/components/domain/readiness/position-group.tsx`
  - [x] Props: `position: 'GR' | 'DEF' | 'MED' | 'AVA'; players: PlayerReadinessData[]`
  - [x] Header com icon + position label (UX-DR13)
  - [x] Lista `<PlayerRow>` para cada player no grupo

- [x] **Task 6: Componente `PlayerRow`** (AC: #4, #5, #8)
  - [x] Criar `sparta/src/components/domain/readiness/player-row.tsx`
  - [x] Props: `snapshot: PlayerReadinessData; position: string; onSelect?`
  - [x] Layout: jersey + name + semáforo badge
  - [x] Clickable area com `cursor-pointer` hover (effeito subtle)
  - [x] ARIA labels: full context (nome, número, posição, estado)
  - [x] onClick: callback para abrir drill-down (Story 5.5)
  - [x] InsufficientDataIndicator (aria-hidden visual) se `data_sufficient=false` (AC #7)

- [x] **Task 7: Componente `ReadinessPanelEmptyState`** (AC: #1)
  - [x] Criar `ReadinessPanelEmptyState` Client Component com useRouter
  - [x] Icon: `<Calendar />`; Title: "Sem sessão agendada nas próximas 7 dias"
  - [x] Description: "Cria uma para ver o painel"
  - [x] CTA: Button com `onClick={() => router.push('/calendario/nova')}`

- [x] **Task 8: Server Action `getUpcomingSession()`** (AC: #1, #6)
  - [x] Criado em `sparta/src/lib/actions/readiness.ts`
  - [x] Função: `getUpcomingSession(): Promise<Result<{ sessionId: string; scheduledAt: string } | null, AppError>>`
  - [x] Busca a próxima sessão do clube do staff (status='scheduled', within 7 dias)
  - [x] Usa `requireStaffRole()` para auth; players recebem erro

- [x] **Task 9: Server-side data fetch em `page.tsx`** (AC: #6)
  - [x] Na rota `/prontidao`, buscar upcoming session via `getUpcomingSession()`
  - [x] Se session existe: buscar dados via `getReadinessPanelData(sessionId)` (novo action com player info)
  - [x] Se nenhuma session (ou erro): renderizar `<ReadinessPanelEmptyState>`
  - [x] Passar `PlayerReadinessData[]` para `<ReadinessPanel>` como props

- [x] **Task 10: Integração com `<DrillDownSheet>` (Story 5.5 preview)** (AC: #4)
  - [x] `<ReadinessPanelList>` gere state `selectedPlayer` para sheet aberta
  - [x] `<PlayerRow>` onClick chama callback `onSelectPlayer`
  - [x] Sheet renderiza placeholder "disponível na Story 5.5"

- [x] **Task 11: Testes unitários** (AC: #10)
  - [x] Criado `sparta/src/__tests__/app/(staff)/prontidao.test.tsx` (24 testes ✅)
  - [x] Mock `getUpcomingSession()` + `getReadinessPanelData()` com fixtures
  - [x] Verify: 3 header numbers rendered via `role="img"` accessible names
  - [x] Verify: players agrupados por posição (4 grupos)
  - [x] Verify: ordem correcta (alert → caution → ready → neutral, ACWR DESC)
  - [x] Verify: InsufficientDataIndicator renderizado para neutral players
  - [x] Verify: EmptyState renderizado quando nenhuma sessão
  - [x] axe-core: zero violations em plantel completo e em EmptyState
  - [x] Unit tests `getPositionKey` (13 casos)

- [x] **Task 12: Performance & Accessibility check** (AC: #6, #8)
  - [x] axe-core: zero violations confirmado em testes (prontidao.test.tsx)
  - [x] Server Component: fetch server-side, sem client-side JS desnecessário
  - [x] loading.tsx com skeleton para FCP ≤1.5s

---

## Technical Architecture

### Component Hierarchy

```
app/(staff)/prontidao/page.tsx (Server Component)
  ├── getUpcomingSession() → sessionId
  ├── getClubReadinessSnapshots(sessionId) → snapshots[]
  │
  └── <ReadinessPanel view="list" snapshots={snapshots} sessionId={sessionId} /> (Client Component)
      ├── <ReadinessPanelHeader readyCount, cautionCount, alertCount, view, onViewChange />
      │   ├── 3 large display numbers (ready/caution/alert counts)
      │   └── Toggle "Formação" (disabled in MVP)
      │
      └── <ReadinessPanelList snapshots={snapshots} sessionId={sessionId} /> (Client Component)
          ├── <PositionGroup position="GR" players={[...]} />
          │   ├── Position header (GR, icon)
          │   └── <PlayerRow>* (sorted: alert→caution→ready→neutral, ACWR DESC)
          │       ├── jersey + name + <SemaforoBadge state />
          │       ├── <TooltipExplain> (if data_sufficient=false)
          │       └── onClick → open <DrillDownSheet> (Story 5.5)
          ├── <PositionGroup position="DEF" players={[...]} />
          ├── <PositionGroup position="MED" players={[...]} />
          └── <PositionGroup position="AVA" players={[...]} />
```

### Data Flow

1. **Server (page.tsx):**
   - Call `getUpcomingSession()` → resolve sessionId
   - Call `getClubReadinessSnapshots(sessionId)` → fetch snapshots
   - Pass snapshots as props to Client Component

2. **Client (ReadinessPanelList):**
   - Group snapshots by position (via players.positions lookup)
   - Sort within group: state priority + ACWR DESC
   - Calculate aggregates: count of ready/caution/alert (exclude neutral)
   - Render header with counts

3. **Interactivity (PlayerRow):**
   - On click → emit event to parent `<ReadinessPanel>`
   - Parent opens `<DrillDownSheet>` with playerId (Story 5.5)

---

## Design Tokens Reference (Story 1.8)

### Colors (Semáforo)
- **ready (verde):** `#22c55e` (`signal-ready`)
- **caution (amarelo):** `#eab308` (`signal-caution`)
- **alert (vermelho):** `#ef4444` (`signal-alert`)
- **neutral (cinzento):** `#6b7280` (`signal-neutral`)

### Typography
- **Header numbers:** `text-display-1` 48px, `font-bold`
- **Position label:** `text-body-md` , `font-semibold`
- **Player name:** `text-body-md`
- **Jersey number:** `text-body-sm`, `text-muted`

### Layout
- **Header:** `sticky top-0 z-10 bg-surface-container`
- **Position group:** `my-4`
- **Player row:** `px-4 py-3 flex items-center justify-between hover:bg-surface-dim rounded cursor-pointer`
- **Badge:** `ml-2` (right-aligned)

### Dark Mode
- All colors adapt via `dark:` utilities (from globals.css Story 1.8)

---

## Dependencies & Imports

```typescript
// Server Component
import { getUpcomingSession } from '@/lib/actions/readiness';
import { getClubReadinessSnapshots } from '@/lib/actions/readiness';
import type { ReadinessSnapshot } from '@/types/supabase';
import { ReadinessPanel } from '@/components/domain/readiness/readiness-panel';
import { EmptyState } from '@/components/patterns/empty-state';

// Client Components
import { SemaforoBadge } from '@/components/patterns/semaforo-badge'; // Story 1.8
import { TooltipExplain } from '@/components/patterns/tooltip-explain'; // Story 1.8
import { Calendar, Shield, ShieldAlert, Zap, Target } from 'lucide-react';

// Types
import type { AgeGroup } from '@/lib/readiness/thresholds'; // Story 5.2
```

---

## Dev Notes

### Position Grouping Logic

Players have a `positions` table (Story 2.1) with `is_primary=true` for each. Grouping by primary position:

```typescript
type Position = 'GR' | 'DEF' | 'MED' | 'AVA';

function getPositionCategory(position: string): Position {
  const lowerPos = position.toLowerCase();
  if (lowerPos.includes('guarda') || lowerPos === 'gr') return 'GR';
  if (lowerPos.includes('defesa') || lowerPos.includes('def')) return 'DEF';
  if (lowerPos.includes('meio') || lowerPos === 'med') return 'MED';
  if (lowerPos.includes('avançado') || lowerPos === 'ava') return 'AVA';
  return 'MED'; // default fallback
}
```

### Aggregation Logic

```typescript
const readyCount = snapshots.filter(s => s.state === 'ready' && s.state !== 'neutral').length;
const cautionCount = snapshots.filter(s => s.state === 'caution').length;
const alertCount = snapshots.filter(s => s.state === 'alert').length;
// Neutral are excluded from aggregate counts per UX-DR12
```

### Sorting within Position Group

```typescript
const STATE_PRIORITY: Record<string, number> = {
  alert: 1, caution: 2, ready: 3, neutral: 4,
};

const sorted = groupedPlayers.sort((a, b) => {
  const pa = STATE_PRIORITY[a.state] ?? 5;
  const pb = STATE_PRIORITY[b.state] ?? 5;
  if (pa !== pb) return pa - pb;
  // Within same state, ACWR DESC (NULLS last)
  return (b.acwr ?? 0) - (a.acwr ?? 0);
});
```

### Data-Driven Caching

During the 4-hour pre-session window (Story 5.7), use TanStack Query:

```typescript
const { data: snapshots } = useQuery({
  queryKey: ['readiness', sessionId],
  queryFn: () => getClubReadinessSnapshots(sessionId),
  staleTime: 30 * 1000, // 30 seconds — refresh if stale
  gcTime: 5 * 60 * 1000, // 5 minutes
});
```

Outside the window, cache staleTime: 5 minutes (no realtime).

### EmptyState Copy (PT-PT B1)

- Title: "Sem sessão agendada nas próximas 7 dias"
- Description: "Cria uma para ver o painel"
- Button label: "Criar Sessão"
- Link target: `/calendario/nova`

### Acessibilidade: aria-label Examples

```typescript
// Header number
<div aria-label={`${readyCount} jogadores prontos`}>
  {readyCount}
</div>

// Player row
<button
  role="button"
  aria-label={`${player.name}, Número ${player.jerseyNum}, Posição ${position}, Estado ${state}`}
>
  ...
</button>

// Badge
<SemaforoBadge
  state={state}
  size="md"
  aria-label={`Estado: ${stateLabel[state]}`}
/>
```

### Drill-Down Sheet Integration (Story 5.5 — Preview)

Para agora, `<PlayerRow>` pode emitir um evento ou callback:

```typescript
// Em <PlayerRow>
const handleClick = () => {
  onSelectPlayer?.(snapshot); // callback do parent
};

// Em <ReadinessPanel>
const [selectedPlayer, setSelectedPlayer] = useState<ReadinessSnapshot | null>(null);

return (
  <>
    <ReadinessPanelList
      snapshots={snapshots}
      onSelectPlayer={setSelectedPlayer}
    />
    {selectedPlayer && (
      <DrillDownSheet
        playerId={selectedPlayer.player_id}
        onClose={() => setSelectedPlayer(null)}
      />
    )}
  </>
);
```

A Story 5.5 implementará o `<DrillDownSheet>` completo.

### Sem Componentes Deferred para MVP

- ❌ Formation view (Story 5.6)
- ❌ Realtime updates (Story 5.7)
- ❌ Drill-down sheet (Story 5.5)

Estas são renderizadas mas funcionalidades plenas vêm em stories seguintes.

### Testing Pattern: Fixtures

```typescript
// __fixtures__/readiness-snapshots.ts
export const fixtureReadinessSnapshots = (): ReadinessSnapshot[] => [
  {
    player_id: 'player-1',
    session_id: 'session-1',
    club_id: 'club-1',
    state: 'alert',
    acwr: 1.8,
    acwr_band_lo: 0.8,
    acwr_band_hi: 1.5,
    recent_fatigue_avg: 1.5,
    attendance_rate: null,
    data_sufficient: true,
    derived_age_group: 'senior',
    computed_at: new Date().toISOString(),
  },
  // ... 39 more fixtures com mix de states
];
```

---

## Performance Checklist

- [ ] Server Component — nenhum Client-side JS rendering unnecessary
- [ ] `getClubReadinessSnapshots` — indexado por session_id (Story 5.3, AC #8)
- [ ] TanStack Query caching — 30s staleTime durante janela 4h pré-sessão
- [ ] Skeleton loading — `loading.tsx` renderiza antes de dados chegarem
- [ ] No re-renders on scroll — position: sticky em header, content é static
- [ ] Bundle size — icons via lucide-react (tree-shakeable)
- [ ] Dark mode — sem JS overhead, CSS-only via media queries

---

## Accessibility Checklist

- [ ] Axe-core: zero violations
- [ ] ARIA labels — header números, player rows, badges
- [ ] Semantic HTML — `<section>`, `<button>`, `role="heading"`
- [ ] Keyboard navigation — Tab through rows, Enter to drill-down, ESC to close
- [ ] Color redundancy — icon + shape + color em badges (UX-DR5)
- [ ] Contrast — text on bg meets WCAG AA
- [ ] Reduced motion — prefers-reduced-motion respected (nenhuma animação)
- [ ] Screen reader — position headers announced, player context complete

---

## References

- [Epics.md — Story 5.4](../_bmad-output/planning-artifacts/epics.md#L2444) — AC completos
- [Epics.md — FR34](../_bmad-output/planning-artifacts/epics.md#L77) — "Treinador pode consultar Painel"
- [Architecture.md — Painel ≤2s](../_bmad-output/planning-artifacts/architecture.md#L569) — NFR1
- [Architecture.md — Server Components](../_bmad-output/planning-artifacts/architecture.md#L230) — pattern
- [UX Design Spec — UX-DR12](../_bmad-output/planning-artifacts/ux-design-specification.md) — Painel header
- [UX Design Spec — UX-DR5](../_bmad-output/planning-artifacts/ux-design-specification.md) — Semáforo redundancy
- [UX Design Spec — UX-DR8](../_bmad-output/planning-artifacts/ux-design-specification.md) — EmptyState padrão
- [Story 1.8](./1-8-design-system-foundation-tokens-7-pattern-components-button-hierarchy.md) — SemaforoBadge, tokens
- [Story 1.10](./1-10-browser-compatibility-page-in-app-webview-block.md) — Error boundaries
- [Story 2.1](./2-1-player-records-plantel-list.md) — Players table, positions
- [Story 5.2](./5-2-acwr-calculation-engine-with-age-group-thresholds.md) — ACWR logic
- [Story 5.3](./5-3-readiness-snapshots-materialized-source-for-the-painel.md) — Data source
- [Story 5.5](./5-5-painel-drill-down-sheet-with-4-week-series-banda-acwr-presences-nota-livre.md) — Drill-down detail
- [Story 5.6](./5-6-painel-field-formation-4-3-3-view-with-toggle.md) — Formation view
- [Story 5.7](./5-7-realtime-updates-window-4h-pre-session.md) — Realtime updates
- [Architecture.md — Server Components pattern](../_bmad-output/planning-artifacts/architecture.md#L722)
- [lib/actions/readiness.ts](../sparta/src/lib/actions/readiness.ts) — Server Actions
- [types/supabase.ts](../sparta/src/types/supabase.ts) — ReadinessSnapshot type
- [components/patterns/](../sparta/src/components/patterns/) — SemaforoBadge, TooltipExplain, EmptyState
- [app/(staff)/layout.tsx](../sparta/src/app/(staff)/layout.tsx) — Existente, reutilizar
- [AGENTS.md](../sparta/AGENTS.md) — path alias, imports

---

## Dev Agent Record

### Agent Model Used

claude-haiku-4-5-20251001

### Completion Status

**Ready-for-dev** — Story file created with comprehensive context for implementation.

### Key Notes for Developer

1. **Dependências críticas:** Stories 5.1, 5.2, 5.3 devem estar `done` antes de começar
2. **Pattern:** Server Component para fetch de dados, Client Component para interatividade
3. **Perf target:** FCP ≤1.5s (mobile 4G) — use skeleton loading
4. **Acessibilidade:** Axe-core zero violations, redundant signals (cor+ícone+forma)
5. **PT-PT:** Todas as labels em português europeu B1
6. **Design tokens:** Use Story 1.8 tokens (cores, tipografia, layout)
7. **Testes:** ≥80% cobertura, snapshot tests para axe-core
8. **Drill-down:** Story 5.5 implementará funcionalidade completa; esta story prepara clickable rows

### Próximas Stories

- **Story 5.5:** Drill-down sheet com fatiga series + ACWR banda + presences + decision input
- **Story 5.6:** Formation view toggle (disabled em MVP)
- **Story 5.7:** Realtime updates na janela 4h pré-sessão

---

## Change Log

### 2026-05-25 (Story Created)
- ✅ Comprehensive story file created with all ACs
- ✅ Technical architecture documented
- ✅ Component hierarchy designed
- ✅ Testing strategy defined
- ✅ Performance & accessibility targets set
- ✅ Ready for dev agent to implement

---

## Review Findings

> Code review realizado em 2026-05-25. 0 decision-needed · 24 patches · 11 deferred · 6 dismissed.

### Patches

- [x] [Review][Patch] **P-1 — Sem política RLS para INSERT/UPDATE em readiness_snapshots** — `GRANT SELECT, INSERT, UPDATE TO authenticated` mas só existe política `FOR SELECT`. Qualquer utilizador autenticado pode escrever snapshots de qualquer clube via PostgREST. Remover INSERT/UPDATE do GRANT de `authenticated` (service-role já bypassa RLS) ou adicionar políticas explícitas scoped a `club_id`. [`supabase/migrations/000250_readiness_snapshots.sql:70`]
- [x] [Review][Patch] **P-2 — Lógica de retry morta — `version` nunca é incrementado** — `upsertWithRetry` verifica `error.message.includes('version')` mas o upsert não escreve nem lê `version`, logo nunca há um conflict de versão. Simplificar para upsert direto ou implementar optimistic locking real (incluir `version: atual + 1` no payload + trigger DB). [`sparta/src/lib/readiness/snapshot.ts:66-90`]
- [x] [Review][Patch] **P-3 — Erro em `positionRows` silenciosamente descartado — todos os jogadores ficam como "MED"** — `const { data: positionRows } = await supabase.from('positions')...` descarta `error`. Em falha de DB, `positionMap` fica vazio e todos os jogadores são mapeados para "Médio" sem nenhum log ou sinal de erro para o staff. Adicionar destructure de `error` + logging + `return err(...)` ou continuar com dados parciais com warning. [`sparta/src/lib/actions/readiness.ts:388`]
- [x] [Review][Patch] **P-4 — Sort de ACWR nulo inconsistente entre `getClubReadinessSnapshots` e `getReadinessPanelData`** — `getClubReadinessSnapshots` usa `?? 0` (NULLs sobem para o meio da lista); `getReadinessPanelData` usa `?? -Infinity` (NULLs ficam no fim, conforme AC #5). A page usa `getReadinessPanelData` mas ambas as funções têm comportamento diferente. Alinhar `getClubReadinessSnapshots` com `?? -Infinity`. [`sparta/src/lib/actions/readiness.ts:274`]
- [x] [Review][Patch] **P-5 — Erros das queries de `sessions`/`players` em `refreshSnapshotForSession` silenciados** — `const { data: session } = ...` e `const { data: players } = ...` descartam `error`. Falha de DB é tratada como "sessão não encontrada" / "sem jogadores". Adicionar `{ data: session, error: sessionError }` e verificar antes de prosseguir. [`sparta/src/lib/readiness/snapshot.ts:115,133`]
- [x] [Review][Patch] **P-6 — `session.club_id` null não tem guard em `refreshSnapshotForSession`** — `serviceRole.from('players').eq('club_id', session.club_id)` com `club_id = null` emite `IS NULL` em PostgREST, potencialmente devolvendo jogadores incorretos. Adicionar `if (!session.club_id) { logger.error(...); return; }`. [`sparta/src/lib/readiness/snapshot.ts:137`]
- [x] [Review][Patch] **P-7 — `upsertWithRetry` falha se `error.message` for undefined** — `error.message.includes('version')` crasha com `TypeError` se o PostgrestError devolver `message: undefined`. Mudar para `(error.message ?? '').includes('version')`. [`sparta/src/lib/readiness/snapshot.ts:81`]
- [x] [Review][Patch] **P-8 — Guard `s.id !== undefined` deve ser `s.id != null`** — Em `refreshUpcomingReadiness`, `s.id !== undefined` deixa passar `null` (que é um valor possível no DB), passando `null` para `refreshSnapshotForSession`. Mudar para `s.id != null`. [`sparta/src/lib/actions/readiness.ts:208`]
- [x] [Review][Patch] **P-9 — `refreshUpcomingReadiness` infla `count` mesmo quando `refreshSnapshotForSession` falha** — O loop não tem try/catch; erros propagam-se e o `count` reflecte tentativas, não sucessos. Envolver em try/catch e só incrementar `count` em sucesso. [`sparta/src/lib/actions/readiness.ts:207-211`]
- [x] [Review][Patch] **P-10 — `acwr.threshold` pode ser `undefined` — crash silencioso por player** — `acwr.threshold.lo` e `.hi` acedidos diretamente sem guard. Se `computeAcwr` devolver `threshold: undefined`, o error é apanhado pelo try/catch do loop mas silencia o problema. Mudar para `acwr.threshold?.lo ?? null`. [`sparta/src/lib/readiness/snapshot.ts:182`]
- [x] [Review][Patch] **P-11 — `playerName` com string vazia não tem fallback** — `player?.full_name ?? 'Jogador'` não protege contra `full_name = ""`. Mudar para `player?.full_name?.trim() || 'Jogador'`. [`sparta/src/lib/actions/readiness.ts:416`]
- [x] [Review][Patch] **P-12 — Hydration mismatch: leitura de `sessionStorage` em lazy initializer** — `useState(() => getInitialView(initialView))` lê `sessionStorage` durante o primeiro render do cliente. Se o utilizador tiver guardado `"formation"`, o servidor renderiza `"list"` e o cliente inicializa `"formation"` → hydration warning em Next.js 15. Usar `useEffect` para sincronizar após hydration. [`sparta/src/components/domain/readiness/readiness-panel.tsx:40`]
- [x] [Review][Patch] **P-13 — `handleViewChange` sem try/catch para `sessionStorage.setItem`** — Em navegação privada ou quota excedida, `sessionStorage.setItem` lança exceção e crasha o componente. `getInitialView` já tem try/catch mas `handleViewChange` não. Envolver em try/catch. [`sparta/src/components/domain/readiness/readiness-panel.tsx:45`]
- [x] [Review][Patch] **P-14 — Tooltip do `InsufficientDataIndicator` inacessível a leitores de ecrã** — `aria-hidden="true"` no wrapper esconde todo o conteúdo (ícone + tooltip) da accessibility tree. Utilizadores com AT veem apenas "Estado Sem dados" sem explicação do que é necessário. AC #7 especifica `role="tooltip"` e `aria-describedby`. Remover `aria-hidden` do span de tooltip ou usar `aria-describedby` linkado ao texto. [`sparta/src/components/domain/readiness/player-row.tsx:30`]
- [x] [Review][Patch] **P-15 — `role="img"` em `<span>` numérico semanticamente incorreto** — `<span role="img" aria-label="3 jogadores prontos">3</span>` usa `role="img"` num contador numérico. `role="img"` é para representações gráficas, não texto/números. Remover o `role="img"` — o `aria-label` num `<span>` é suficiente (ou usar um `<p>` com `aria-label`). [`sparta/src/components/domain/readiness/readiness-panel-header.tsx:38,48,58`]
- [x] [Review][Patch] **P-16 — `!data_sufficient` dispara com `undefined` — verificação devia ser explícita** — `{!data_sufficient && <InsufficientDataIndicator />}` renderiza o indicador quando `data_sufficient` é `undefined`. Mudar para `{data_sufficient === false && <InsufficientDataIndicator />}`. [`sparta/src/components/domain/readiness/player-row.tsx:81`]
- [x] [Review][Patch] **P-17 — `jerseyNum === 0` tratado como falsy — exibido como "—" e omitido do aria-label** — `jerseyNum || "—"` e `jerseyNum ? \`Número ${jerseyNum}\` : null` ambos tratam `0` como ausente. O número de camisola 0 é legítimo em alguns clubes. Mudar para `jerseyNum != null ? jerseyNum : "—"` e `jerseyNum != null ? \`Número ${jerseyNum}\` : null`. [`sparta/src/components/domain/readiness/player-row.tsx:75,59`]
- [x] [Review][Patch] **P-18 — `disabled` + `aria-disabled="true"` redundante no botão "Formação"; `aria-pressed` incorreto** — `disabled` já comunica o estado às AT; `aria-disabled="true"` é redundante. `aria-pressed={view === "formation"}` nunca deve ser `true` num botão permanentemente desactivado — usar `aria-pressed="false"` incondicional. [`sparta/src/components/domain/readiness/readiness-panel-header.tsx:88`]
- [x] [Review][Patch] **P-19 — `<div role="heading" aria-level={2}>` deve ser `<h2>` nativo** — Anti-padrão ARIA; o elemento nativo é preferido, tem melhor suporte em AT e estrutura de headings mais robusta. [`sparta/src/components/domain/readiness/position-group.tsx:54`]
- [x] [Review][Patch] **P-20 — Breadcrumb "Prontidão" (Story 1.9 pattern) ausente — `<h1>` simples usado** — AC #1 especifica o padrão de Breadcrumb da Story 1.9 no header da página. A implementação usa um `<h1>` simples sem o componente `Breadcrumb`. [`sparta/src/app/(staff)/prontidao/page.tsx:29`]
- [x] [Review][Patch] **P-21 — EmptyState apresentado quando `panelResult.ok=false` mascara erros de DB ao staff** — Quando `getReadinessPanelData` falha (erro de DB, timeout), o staff vê a mesma EmptyState de "Sem sessão agendada" em vez de um estado de erro. Mostrar uma mensagem de erro diferente (pode reutilizar `error.tsx` via throw). [`sparta/src/app/(staff)/prontidao/page.tsx:40`]
- [x] [Review][Patch] **P-22 — `STATE_PRIORITY` definido em 3 ficheiros — violação DRY** — Constante idêntica em `readiness.ts` (2×) e `readiness-panel-list.tsx`. Extrair para `@/lib/readiness/thresholds.ts` ou ficheiro partilhado. [`sparta/src/lib/actions/readiness.ts:260,403` · `sparta/src/components/domain/readiness/readiness-panel-list.tsx:33`]
- [x] [Review][Patch] **P-23 — Logging inconsistente em `snapshot.ts` — `console.error` vs `logger.error`** — `refreshSnapshotForSession` usa `logger.error` para invalid UUID mas `console.error` para session_not_found e player_refresh_failed. Standardizar para `logger.error` em todo o ficheiro. [`sparta/src/lib/readiness/snapshot.ts:122,194`]
- [x] [Review][Patch] **P-24 — `getPositionKey`: "centrocampista central" classificado como DEF** — `p.includes("central")` na branch DEF dispara antes de `p.includes("centrocampista")` na branch MED. Mover a verificação `includes("central")` para depois das verificações de MED, ou adicionar `p.includes("centrocampista")` como primeira verificação em MED. [`sparta/src/components/domain/readiness/readiness-panel-list.tsx:26`]

### 2026-05-29 (Post-implementation fix — getPositionKey schema abbreviations)

- ✅ **Abreviaturas do schema DB** — `getPositionKey()` não reconhecia as abreviaturas usadas na tabela `positions` (`GR`, `DD`, `DC`, `DE`, `LIB`, `MDC`, `MC`, `MO`, `MD`, `ME`, `EXD`, `EXE`, `SC`, `PL`). Todos os jogadores apareciam no grupo "Médio" (fallback).
- ✅ **Fix** — adicionado bloco de exact-match para as 14 abreviaturas antes do matching por texto. Ordem: `GR` → DEF abreviaturas → MED abreviaturas → AVA abreviaturas → matching por texto-livre → fallback `MED`.
- ✅ 18 novos testes de regressão para cada abreviatura adicionados em `src/__tests__/app/(staff)/prontidao.test.tsx`

**Mapa de abreviaturas → grupo:**

| Abreviatura | Grupo |
|---|---|
| `GR` | Guarda-Redes |
| `DD`, `DC`, `DE`, `LIB` | Defesa |
| `MDC`, `MC`, `MO`, `MD`, `ME` | Médio |
| `EXD`, `EXE`, `SC`, `PL` | Avançado |

### Deferred

- [x] [Review][Defer] **D-1 — Calls DB em série N×2 em `refreshSnapshotForSession`** [`sparta/src/lib/readiness/snapshot.ts:144`] — deferred, operação background fire-and-forget; otimizar com `Promise.all` quando Story 5.7 (realtime updates) for implementada
- [x] [Review][Defer] **D-2 — `requireStaffRole()` chamado duas vezes por render — 7 round-trips de DB** [`sparta/src/lib/actions/readiness.ts`] — deferred, concern arquitectural sistémico; otimizar com `cache()` do Next.js quando a camada de actions for centralizada
- [x] [Review][Defer] **D-3 — `computeRecentFatigueAvg` descarta toda a resposta com uma dimensão inválida** [`sparta/src/lib/readiness/snapshot.ts:53`] — deferred, comportamento conservador aceitável para MVP; decisão de qualidade de dados a rever com contexto desportivo
- [x] [Review][Defer] **D-4 — Desvio de relógio (`asOf`) para squads grandes no loop de players** [`sparta/src/lib/readiness/snapshot.ts:141`] — deferred, segundos de desvio aceitáveis para squad típico de 25 jogadores
- [x] [Review][Defer] **D-5 — `acwr numeric(4,2)` overflow para ACWR ≥ 100** [`supabase/migrations/000250_readiness_snapshots.sql:17`] — deferred, ACWR ≥ 100 é fisicamente irrealista; concern da Story 5.2 se `computeAcwr` retornar tal valor
- [x] [Review][Defer] **D-6 — Jogador arquivado após snapshot → linha "Jogador" fantasma no painel** [`sparta/src/lib/actions/readiness.ts:377`] — deferred, janela de race muito pequena; próximo refresh elimina a linha
- [x] [Review][Defer] **D-7 — PostgrestError em logs pode conter nomes de tabelas/colunas** [`sparta/src/lib/readiness/snapshot.ts`] — deferred, padrão sistémico em todo o projecto; resolver quando log sanitization for standardizada
- [x] [Review][Defer] **D-8 — Formatação de data no servidor ignora timezone do utilizador** [`sparta/src/app/(staff)/prontidao/page.tsx:52`] — deferred, concern sistémico; necessita estratégia de timezone global
- [x] [Review][Defer] **D-9 — TanStack Query (staleTime: 30s) não implementado** [`sparta/src/components/domain/readiness/readiness-panel-list.tsx:59`] — deferred, explicitamente deferido para Story 5.7 (realtime updates)
- [x] [Review][Defer] **D-10 — `getPlayerAcwrTrend` stub sem marcação "não implementado"** [`sparta/src/lib/actions/readiness.ts:139`] — deferred, pre-existente da Story 4.6; atualizar quando Story 5.5 implementar ACWR trend
- [x] [Review][Defer] **D-11 — TOCTOU em `refreshUpcomingReadiness` — verificação de clube e refresh em momentos separados** [`sparta/src/lib/actions/readiness.ts:194`] — deferred, probabilidade próxima de zero; sessões não mudam de clube
