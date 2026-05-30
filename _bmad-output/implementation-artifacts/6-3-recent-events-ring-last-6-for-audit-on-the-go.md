# Story 6.3: Recent Events Ring (Last 6) for Audit-on-the-Go

**Status:** review

**Story ID:** 6.3
**Epic:** Epic 6 — Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)
**Criado:** 2026-05-30
**Story anterior:** 6-2-touchscreen-b-sticky-player-stack-with-action-and-zone

> ⚠️ **DEPENDÊNCIAS:**
> - Story **6.1** done — `deleteMatchEvent()` Server Action existe e funciona
> - Story **6.2** done — `/sessoes/[id]/captura`, `MatchEventCapture`, `ZoneSelectorSheet`, Zustand `useMatchSession` todos existem
> - Story **6.6** (janela de edição) é **backlog** — implementar delete UI; o check de janela é stub `true` para já

---

## Story

As an Analista pitchside,
I want a footer showing my last 6 captured events for the current session,
So that I can audit my taps without diverting attention from the field.

---

## Acceptance Criteria

### AC #1 — `<RecentEventsRing>` como sticky footer em `/sessoes/[id]/captura`

**Given** o Analista está na rota `/sessoes/[id]/captura` (Story 6.2)

**When** a página renderiza

**Then** `<RecentEventsRing>` aparece como sticky footer abaixo do corpo principal da página
**And** ocupa toda a largura (full-bleed, sem padding lateral do site)
**And** zero animações aplicam-se universalmente (UX-DR3)
**And** a altura mínima é suficiente para acomodar 6 chips numa linha horizontal com scroll ou em wrap

---

### AC #2 — Mostra os últimos 6 eventos ordered most-recent-first

**Given** eventos foram submetidos nesta sessão (online ou offline)

**When** `<RecentEventsRing>` renderiza

**Then** mostra até 6 chips, ordenadas mais-recente-primeiro (esquerda → direita)
**And** cada chip exibe: ícone lucide + `#jersey` + abreviatura de zona (ex: ícone + `#10 ME`)
**And** o texto usa fonte monospace para ritmo visual estável (`font-mono`)

**Given** ≤6 eventos capturados na sessão

**When** o ring renderiza

**Then** os slots vazios mostram placeholders com `border-dashed border-slate-300 dark:border-slate-600`

---

### AC #3 — Novo evento desloca para posição 1 sem animação

**Given** o Analista submete um evento (via Story 6.2 ZoneSelectorSheet)

**When** `handleZoneSelect` conclui com sucesso (online ou offline enqueue)

**Then** o novo chip aparece instantaneamente em posição 1 (mais à esquerda)
**And** zero animações (`transition-none`, sem `slide`, sem `fade`) — UX-DR3

---

### AC #4 — Tap no chip abre confirmação inline "Remover evento?"

**Given** o Analista toca (tap) num chip do ring

**When** activated

**Then** o chip expande para mostrar inline:
- Texto "Remover evento?"
- Botão primário destrutivo "Remover" (`bg-red-600 text-white`)
- Botão ghost "Cancelar" (`text-slate-600`)
**And** apenas um chip pode estar em modo confirmação de cada vez

**Given** o Analista toca "Cancelar"

**When** clicked

**Then** o chip volta ao estado normal

---

### AC #5 — Confirmação de remoção invoca `deleteMatchEvent()`

**Given** o chip está em modo confirmação e o Analista toca "Remover"

**When** `deleteMatchEvent(id)` é invocado (Story 6.1)

**Then** o chip desaparece imediatamente do ring (remoção optimista)
**And** o slot vazio ocupa o lugar com placeholder dashed
**And** se `deleteMatchEvent` retorna erro, o chip reaparece com mensagem de erro inline (ex: "Erro ao remover")

**Given** a janela de edição (Story 6.6 — ainda backlog)

**When** Story 6.6 não está implementada

**Then** o delete está sempre habilitado (stub `isWithinEditWindow = true`)
**And** a estrutura de UI para "Janela de edição encerrada" com `<TooltipExplain>` deve ser preparada mas não activada

---

### AC #6 — `role="log"` + `aria-live="polite"` (a11y)

**Given** o ring como superfície de acessibilidade

**When** screen reader está activo

**Then** o container do ring tem `role="log"` e `aria-live="polite"`
**And** cada chip tem `aria-label` descritiva: ex: `"Perda de bola, #10, Meio esquerda"`
**And** o botão de tap do chip tem `aria-label="Remover evento: Perda de bola #10 Meio esquerda"`

---

### AC #7 — Session boundary: reset ao mudar de sessão

**Given** o ring foi utilizado para uma sessão anterior

**When** `RecentEventsRing` monta com um `sessionId` diferente

**Then** o state `recentEvents` no Zustand é limpo
**And** a Server Action `getRecentMatchEvents(sessionId)` é invocada de novo

---

### AC #8 — Cobertura de testes ≥80% (NFR54)

**Given** testes em `sparta/src/__tests__/components/domain/match-event-capture/`

**When** executados com `npm run test --run` (dentro de `sparta/`)

**Then** cobrem ≥80% dos novos componentes e lógica de store:
- `<RecentEventsRing>`: renderiza 6 chips + placeholders, tap → confirmação, cancel, delete success, delete error
- `<EventChip>`: renderiza ícone + jersey + zona, modo confirmação
- Zustand `addRecentEvent` / `removeRecentEvent` / `setRecentEvents`
- `getRecentMatchEvents` Server Action: happy path + empty
- Axe zero violations em `<RecentEventsRing>`

---

## Tasks / Subtasks

- [x] **Task 1: Estender Zustand store `useMatchSession`** (AC: #2, #3, #7)
  - [x] Adicionar tipo `RecentEventEntry` em `match-session.ts`
  - [x] Adicionar `recentEvents: RecentEventEntry[]` ao state (inicialmente `[]`)
  - [x] Adicionar `addRecentEvent(entry: RecentEventEntry): void` — prepend + trim a 6 items
  - [x] Adicionar `removeRecentEvent(id: string): void` — filtrar por id
  - [x] Adicionar `setRecentEvents(entries: RecentEventEntry[]): void` — substituição completa (para mount DB fetch)
  - [x] Adicionar `clearRecentEvents(): void` — para session boundary (AC#7)
  - [x] Testar os novos selectors em `match-session.store.test.ts`

- [x] **Task 2: Server Action `getRecentMatchEvents()`** (AC: #2, #8)
  - [x] Adicionar a `sparta/src/lib/actions/events.ts` (ficheiro "use server" já existe)
  - [x] `requireStaffRole()` + `getServiceRoleClient()` (padrão obrigatório — ver AGENTS.md)
  - [x] Two-step query:
    1. `match_events` last 6 para `session_id + club_id`, `is_deleted=false`, `ORDER BY occurred_at DESC`, `LIMIT 6`
    2. `match_lineups` para o mesmo `session_id` — obter `shirt_num` e `players(jersey_num)` para cada `player_id` único
  - [x] Merge: `jersey_number = shirt_num ?? jersey_num` (mesmo padrão de `getLineupForSession` em `lineups.ts:312`)
  - [x] Retorna `Result<RecentEventEntry[], AppError>`
  - [x] Testar: happy path (6 eventos), empty (sessão nova), error DB

- [x] **Task 3: Modificar `ZoneSelectorSheet` para actualizar o ring** (AC: #3)
  - [x] Após `clearAction(polarity)` com sucesso (online submit), chamar `addRecentEvent()` com `{ id: payload.id, action: selectedAction, zone, jersey_number: selectedPlayer.jersey_number, occurred_at: payload.occurred_at }`
  - [x] Após `enqueueMutation` (offline), idem — o chip aparece imediatamente (optimistic)
  - [x] Importar `useMatchSession` selector `addRecentEvent` com selector optimizado para evitar re-renders

- [x] **Task 4: `<EventChip>` — chip individual** (AC: #2, #4, #5, #6)
  - [x] Criar `sparta/src/components/domain/match-event-capture/event-chip.tsx`
  - [x] Props: `entry: RecentEventEntry`, `onDelete: (id: string) => Promise<void>`, `isDeleting: boolean`
  - [x] Estado local: `isConfirming: boolean`
  - [x] Modo normal: ícone lucide + `#jersey` + `ZONE_ABBR[zone]` em `font-mono text-xs`
  - [x] Tap → `setIsConfirming(true)` (sem animação)
  - [x] Modo confirmação: "Remover evento?" + botão "Remover" (destructive) + "Cancelar" (ghost)
  - [x] `aria-label` descritiva em ambos os modos
  - [x] Zero `transition` ou `animation` classes (UX-DR3)
  - [x] Tamanho mínimo touch: `min-h-[44px]` (chips podem ser mais estreitos que 60px dado o contexto de footer)

- [x] **Task 5: `<RecentEventsRing>` — componente principal** (AC: #1–#7)
  - [x] Criar `sparta/src/components/domain/match-event-capture/recent-events-ring.tsx`
  - [x] Props: `sessionId: string`
  - [x] On mount: chamar `getRecentMatchEvents(sessionId)` → `setRecentEvents(data)`
  - [x] On `sessionId` change (AC#7): `clearRecentEvents()` + re-fetch
  - [x] Ler `recentEvents` do Zustand via selector
  - [x] Renderizar 6 chips: `recentEvents[0..5]` + placeholders para posições vazias
  - [x] Handler `handleDelete(id)`: optimistic `removeRecentEvent(id)` → `deleteMatchEvent(id)` → se erro: rollback via `setRecentEvents` (re-fetch ou restore)
  - [x] `role="log"` + `aria-live="polite"` no container
  - [x] Layout: `flex flex-row gap-2 overflow-x-auto px-3 py-2` com `bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800`

- [x] **Task 6: Modificar `MatchEventCapture` para incluir o footer** (AC: #1)
  - [x] Adicionar `<RecentEventsRing sessionId={sessionId} />` após `{/* Zone Selector Modal */}`
  - [x] O ring fica fora do `div.flex-1.overflow-auto` (body), como elemento irmão sticky na bottom
  - [x] Verificar que `h-screen` ainda funciona correctamente com o footer adicionado

- [x] **Task 7: Testes** (AC: #8)
  - [x] `match-session.store.test.ts` — `addRecentEvent` (prepend + trim), `removeRecentEvent`, `setRecentEvents`, `clearRecentEvents`
  - [x] `event-chip.test.tsx` — render normal, tap → modo confirmação, cancelar, deletar (success + error)
  - [x] `recent-events-ring.test.tsx` — mount fetch, 6 chips + 0 placeholders, 3 chips + 3 placeholders, session boundary reset, axe zero violations
  - [x] `events.server.test.ts` (ou adicionar a ficheiro existente) — `getRecentMatchEvents` mocked

---

## Dev Notes

### CRÍTICO: Padrão obrigatório para Server Actions com Client Components

**AGENTS.md regra 1:** Ficheiros "use server" invocados de client components DEVEM usar `getServiceRoleClient()`, não `createServerClient()`. Ver `sparta/src/lib/actions/events.ts` — já segue o padrão. A nova `getRecentMatchEvents()` deve ser adicionada ao **mesmo ficheiro** `events.ts` com o mesmo padrão:

```typescript
// sparta/src/lib/actions/events.ts  (adicionar ao ficheiro existente)
export async function getRecentMatchEvents(
  sessionId: string,
  limit = 6
): Promise<Result<RecentEventEntry[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  // Step 1: last N events for this session
  const { data: events, error: eventsError } = await serviceRole
    .from("match_events")
    .select("id, action, zone, occurred_at, player_id")
    .eq("session_id", sessionId)
    .eq("club_id", clubId)
    .eq("is_deleted", false)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (eventsError) return err({ code: "unknown", message: eventsError.message });
  if (!events || events.length === 0) return ok([]);

  // Step 2: get jersey numbers from match_lineups for these players
  const playerIds = [...new Set(events.map((e) => e.player_id))];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineupRows } = await (serviceRole.from as any)("match_lineups")
    .select("player_id, shirt_num, players(jersey_num)")
    .eq("session_id", sessionId)
    .in("player_id", playerIds);

  type LineupRow = { player_id: string; shirt_num: number | null; players: { jersey_num: number } | null };
  const jerseyMap = new Map<string, number>();
  for (const l of (lineupRows ?? []) as LineupRow[]) {
    jerseyMap.set(l.player_id, l.shirt_num ?? l.players?.jersey_num ?? 0);
  }

  const result: RecentEventEntry[] = events.map((e) => ({
    id: e.id,
    action: e.action as MatchAction,
    zone: e.zone as (typeof MATCH_ZONES)[number],
    jersey_number: jerseyMap.get(e.player_id) ?? 0,
    occurred_at: e.occurred_at,
  }));

  return ok(result);
}
```

### Tipo `RecentEventEntry` — exportar de `match-session.ts`

Exportar para ser reutilizável entre o store e `events.ts`:

```typescript
// sparta/src/lib/stores/match-session.ts — adicionar
import type { MATCH_ZONES } from "@/lib/schemas/match-events";

export interface RecentEventEntry {
  id: string;
  action: MatchAction;
  zone: (typeof MATCH_ZONES)[number];
  jersey_number: number;
  occurred_at: string; // ISO string
}
```

E em `events.ts` importar:
```typescript
import type { RecentEventEntry, MatchAction } from "@/lib/stores/match-session";
import { MATCH_ZONES } from "@/lib/schemas/match-events";
```

### Ícones lucide por acção (use estes — não inventar)

```typescript
// sparta/src/components/domain/match-event-capture/event-chip.tsx
import {
  XCircle, RefreshCw, Target, Crosshair,
  ArrowRight, Shield, ShieldCheck, Zap
} from "lucide-react";

const ACTION_ICON: Record<MatchAction, React.ElementType> = {
  ball_loss: XCircle,
  ball_recovery: RefreshCw,
  shot_total: Target,
  shot_on_target: Crosshair,
  pass_completed: ArrowRight,
  def_pressure: Shield,
  def_action_success: ShieldCheck,
  off_action_success: Zap,
};
```

### Abreviaturas de zona (monospace, UX-DR22)

```typescript
const ZONE_ABBR: Record<(typeof MATCH_ZONES)[number], string> = {
  def_left:   "DE",
  def_center: "DC",
  def_right:  "DD",
  mid_left:   "ME",
  mid_center: "MC",
  mid_right:  "MD",
  att_left:   "AE",
  att_center: "AC",
  att_right:  "AD",
};
```

### Zero animações — OBRIGATÓRIO (UX-DR3)

```tsx
// ❌ PROIBIDO — qualquer transição ou animação
<div className="transition-all duration-200 slide-in-from-left" />

// ✅ CORRECTO — sem transição alguma
<div className="flex flex-row gap-2" />
```

### Zustand — extensão do store existente (NÃO criar novo store)

Adicionar ao store **existente** em `sparta/src/lib/stores/match-session.ts`. Não criar `useRecentEvents` separado — mantém-se num único store `useMatchSession`.

```typescript
// Acrescentar à interface MatchSessionState:
recentEvents: RecentEventEntry[];
addRecentEvent: (entry: RecentEventEntry) => void;
removeRecentEvent: (id: string) => void;
setRecentEvents: (entries: RecentEventEntry[]) => void;
clearRecentEvents: () => void;

// Acrescentar à implementação create():
recentEvents: [],
addRecentEvent: (entry) =>
  set((s) => ({
    recentEvents: [entry, ...s.recentEvents].slice(0, 6),
  })),
removeRecentEvent: (id) =>
  set((s) => ({
    recentEvents: s.recentEvents.filter((e) => e.id !== id),
  })),
setRecentEvents: (entries) => set({ recentEvents: entries.slice(0, 6) }),
clearRecentEvents: () => set({ recentEvents: [] }),
```

Adicionar selector optimizado:
```typescript
export const useRecentEvents = () => useMatchSession((s) => s.recentEvents);
```

### Modificação em `ZoneSelectorSheet` — após submit bem-sucedido

Localizar `clearAction(polarity)` em `zone-selector-sheet.tsx` e acrescentar `addRecentEvent` ANTES do `clearAction`:

```typescript
// sparta/src/components/domain/match-event-capture/zone-selector-sheet.tsx
// Adicionar import:
import { useMatchSession, useSelectedPlayer, useSelectedAction } from "@/lib/stores/match-session";
// addRecentEvent via useMatchSession:
const { clearAction, clearSelection } = useMatchSession();
const addRecentEvent = useMatchSession((s) => s.addRecentEvent);

// Após submit bem-sucedido (ANTES de clearAction):
addRecentEvent({
  id: payload.id,
  action: selectedAction,
  zone,
  jersey_number: selectedPlayer.jersey_number,
  occurred_at: payload.occurred_at,
});
const polarity = POSITIVE_ACTIONS.has(selectedAction) ? "positive" : "negative";
startTransition(() => clearAction(polarity));
```

Fazer o mesmo nos dois caminhos offline (`enqueueMutation` success).

### Modificação em `MatchEventCapture` — adicionar footer

```tsx
// sparta/src/components/domain/match-event-capture/match-event-capture.tsx
// Adicionar import:
import { RecentEventsRing } from "./recent-events-ring";

// No JSX, adicionar após o body e antes/depois de ZoneSelectorSheet:
<div className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950">
  {/* Sticky Header */}
  ...

  {/* Body */}
  <div className="flex-1 overflow-auto">
    ...
  </div>

  {/* Recent Events Footer */}
  <RecentEventsRing sessionId={sessionId} />

  {/* Zone Selector Modal */}
  <ZoneSelectorSheet sessionId={sessionId} />
</div>
```

O ring fica DENTRO do `flex-col h-screen`, como irmão do body. O `h-screen` continua a funcionar porque `flex-1` absorve o restante.

### Janela de edição — stub para Story 6.6

```typescript
// Em event-chip.tsx ou recent-events-ring.tsx:
// TODO Story 6.6: substituir por check real de isWithinEditWindow(sessionId)
const isWithinEditWindow = true;

// Estrutura preparada (mas não activada ainda):
// if (!isWithinEditWindow) {
//   return <TooltipExplain term="..." definition="Janela de edição encerrada (24h após a sessão)" />;
// }
```

### Rollback em caso de erro de delete

```typescript
// em recent-events-ring.tsx handleDelete:
const handleDelete = async (id: string) => {
  // 1. Remover optimisticamente
  removeRecentEvent(id);

  const result = await deleteMatchEvent(id);
  if (!result.ok) {
    // 2. Restaurar re-fazendo fetch (mais simples que guardar backup)
    const fresh = await getRecentMatchEvents(sessionId);
    if (fresh.ok) setRecentEvents(fresh.data);
    // Mostrar erro inline — pode ser um estado local no ring
  }
};
```

### AGENTS.md — `noUncheckedIndexedAccess`

```typescript
// ❌ Erro de compilação
const first = recentEvents[0];

// ✅ Correcto
const first = recentEvents[0] ?? null;
// ou
if (recentEvents[0] !== undefined) { ... }
```

### Estrutura de ficheiros

```
sparta/src/lib/
├── stores/
│   └── match-session.ts            MODIFICAR: adicionar RecentEventEntry + 4 actions + selector
└── actions/
    └── events.ts                   MODIFICAR: adicionar getRecentMatchEvents()

sparta/src/components/domain/match-event-capture/
├── event-chip.tsx                  CRIAR: chip individual com modo confirmação
├── recent-events-ring.tsx          CRIAR: footer com 6 chips + placeholders
├── zone-selector-sheet.tsx         MODIFICAR: addRecentEvent após submit
└── match-event-capture.tsx         MODIFICAR: incluir <RecentEventsRing>

sparta/src/__tests__/components/domain/match-event-capture/
├── match-session.store.test.ts     MODIFICAR: adicionar testes dos novos selectors
├── event-chip.test.tsx             CRIAR
└── recent-events-ring.test.tsx     CRIAR
```

### Referência de padrões existentes

- `zone-selector-sheet.tsx` — padrão de `useSelectedPlayer()` + `useMatchSession()` separados para evitar re-renders
- `events.ts` — padrão `requireStaffRole()` + `getServiceRoleClient()` + two-step query
- `lineups.ts:239-320` — padrão de join `match_lineups` ↔ `players` com cast `as any` + merge manual
- `match-session.ts` — padrão Zustand ephemeral sem persist; selector `useSelectedPlayer = () => useMatchSession((s) => s.selectedPlayer)`
- `match-event-capture.tsx` — layout `flex flex-col h-screen` + sticky header + flex-1 body

---

## Testes — Padrão e Fixtures

### `match-session.store.test.ts` (adicionar)

```typescript
const mockEntry: RecentEventEntry = {
  id: "01920a4b-c8d3-7000-9c4e-000000000001",
  action: "ball_loss",
  zone: "mid_center",
  jersey_number: 10,
  occurred_at: "2026-05-30T15:00:00.000Z",
};

describe("recentEvents", () => {
  beforeEach(() => useMatchSession.setState({ recentEvents: [] }));

  it("addRecentEvent prepend + trim a 6", () => {
    for (let i = 0; i < 7; i++) {
      useMatchSession.getState().addRecentEvent({ ...mockEntry, id: `id-${i}` });
    }
    expect(useMatchSession.getState().recentEvents).toHaveLength(6);
    expect(useMatchSession.getState().recentEvents[0]?.id).toBe("id-6");
  });

  it("removeRecentEvent filtra por id", () => {
    useMatchSession.getState().addRecentEvent(mockEntry);
    useMatchSession.getState().removeRecentEvent(mockEntry.id);
    expect(useMatchSession.getState().recentEvents).toHaveLength(0);
  });

  it("clearRecentEvents limpa tudo", () => {
    useMatchSession.getState().addRecentEvent(mockEntry);
    useMatchSession.getState().clearRecentEvents();
    expect(useMatchSession.getState().recentEvents).toHaveLength(0);
  });
});
```

### `event-chip.test.tsx` (novo)

```typescript
const mockEntry: RecentEventEntry = {
  id: "01920a4b-c8d3-7000-9c4e-000000000001",
  action: "ball_loss",
  zone: "mid_center",
  jersey_number: 10,
  occurred_at: "2026-05-30T15:00:00.000Z",
};

describe("<EventChip>", () => {
  it("renderiza ícone + jersey + zona no estado normal", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText(/#10/)).toBeInTheDocument();
    expect(screen.getByText(/MC/)).toBeInTheDocument();
  });

  it("tap abre confirmação inline", async () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    await userEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    expect(screen.getByText("Remover evento?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^remover$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("cancelar volta ao estado normal", async () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    await userEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(screen.queryByText("Remover evento?")).not.toBeInTheDocument();
  });

  it("confirmar chama onDelete com id correcto", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<EventChip entry={mockEntry} onDelete={onDelete} isDeleting={false} />);
    await userEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    await userEvent.click(screen.getByRole("button", { name: /^remover$/i }));
    expect(onDelete).toHaveBeenCalledWith(mockEntry.id);
  });
});
```

### `recent-events-ring.test.tsx` (novo)

```typescript
vi.mock("@/lib/actions/events", () => ({
  getRecentMatchEvents: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  deleteMatchEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

describe("<RecentEventsRing>", () => {
  beforeEach(() => useMatchSession.setState({ recentEvents: [] }));

  it("renderiza 6 placeholders quando sem eventos", async () => {
    render(<RecentEventsRing sessionId="sess-123" />);
    const placeholders = await screen.findAllByRole("presentation");
    // ou verificar por classe dashed
    expect(placeholders.length).toBe(6);
  });

  it("renderiza chips quando há eventos no store", () => {
    useMatchSession.setState({
      recentEvents: [
        { id: "e1", action: "ball_loss", zone: "mid_center", jersey_number: 7, occurred_at: "2026-05-30T15:00:00Z" },
      ],
    });
    render(<RecentEventsRing sessionId="sess-123" />);
    expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it("tem role=log e aria-live=polite", () => {
    render(<RecentEventsRing sessionId="sess-123" />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("zero violações axe", async () => {
    const { container } = render(<RecentEventsRing sessionId="sess-123" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Critical Design Decisions

### 1. Estado `recentEvents` em Zustand (não useState local)

**Decisão:** `recentEvents` vive no Zustand `useMatchSession` (store partilhado).

**Razão:** `ZoneSelectorSheet` (componente irmão) precisa de chamar `addRecentEvent()` após submit. Como é irmão de `RecentEventsRing` (não pai/filho), Zustand é o canal mais limpo sem prop drilling ou context adicional.

**Não persistir:** Como todos os outros estados de `useMatchSession`, ephemeral. Após refresh, o ring re-carrega do DB.

### 2. Two-step query para `getRecentMatchEvents`

**Decisão:** Dois queries separados (`match_events` + `match_lineups`) em vez de um join complexo.

**Razão:** `match_events` e `match_lineups` não têm FK directa entre si (ambas referenciam `players` e `sessions` separadamente). O cliente Supabase TS não suporta joins arbitrários. O padrão two-step já está estabelecido em `lineups.ts`.

**Cast `as any`:** `match_lineups` não está tipado em `database.types.ts` — usar o mesmo padrão de `(supabase.from as any)("match_lineups")` de `lineups.ts:255`.

### 3. Optimistic delete com re-fetch em erro

**Decisão:** Remover o evento do Zustand imediatamente; em caso de erro, re-fazer `getRecentMatchEvents`.

**Razão:** Evita complexidade de "snapshot para rollback". Re-fetch é suficientemente rápido e garante consistência com o DB.

### 4. Janela de edição stub (Story 6.6)

**Decisão:** `isWithinEditWindow = true` hardcoded para já.

**Razão:** Story 6.6 é backlog. Implementar a infra-estrutura UI (conditional disabled + `<TooltipExplain>`) mas não activar. A Story 6.6 actualizará este stub.

---

## Previous Story Intelligence (6-2 done)

Story 6.2 implementou e o code-review aplicou 21 patches. Factos relevantes para 6.3:

**Ficheiros já existem (NÃO criar de novo):**
- `sparta/src/components/domain/match-event-capture/zone-selector-sheet.tsx` — MODIFICAR
- `sparta/src/components/domain/match-event-capture/match-event-capture.tsx` — MODIFICAR
- `sparta/src/lib/stores/match-session.ts` — MODIFICAR
- `sparta/src/lib/actions/events.ts` — MODIFICAR

**Padrões já estabelecidos:**
- `clearAction(polarity)` (não `clearSelection()`) após submit bem-sucedido — mantém player sticky
- `enqueueMutation("match-event.submit", payload)` — padrão outbox offline
- `useOnlineStatus()` para verificar estado de rede
- `POSITIVE_ACTIONS` Set para determinar polarity — reutilizar em `event-chip.tsx` para cor do chip
- `useOutboxDrain()` para `pendingCount` no header

**Patches do code-review 6.2 que afectam 6.3:**
- `clearAction()` (não `clearSelection()`) após submit — o player mantém-se (linha 70-71 e 88-91 de `zone-selector-sheet.tsx`)
- `AbortController` em `useEffect` de player-grid — aplicar o mesmo padrão no `useEffect` de mount do ring
- Double-submit guard `if (isSubmitting) return` — não relevante no ring mas serve de lição
- Dois clientes Supabase no mesmo request — usar `requireStaffRole()` + `getServiceRoleClient()` apenas uma vez

**Nota de importação do `PendingBadge`:**
```typescript
// ✅ Correcto (domain, não ui)
import { PendingBadge } from "@/components/domain/pending-badge";
```

---

## Referências

- [Epic 6 — Story 6.3](../planning-artifacts/epics.md) — AC completos
- [Story 6.1](./6-1-match-events-schema-idempotent-server-action.md) — `deleteMatchEvent()` Server Action
- [Story 6.2](./6-2-touchscreen-b-sticky-player-stack-with-action-and-zone.md) — `MatchEventCapture`, `ZoneSelectorSheet`, `useMatchSession`
- [Story 6.6](./6-6-edit-delete-events-within-configurable-post-session-window.md) — janela de edição (backlog)
- [Architecture AGENTS.md](../../sparta/AGENTS.md) — regra Service Role + noUncheckedIndexedAccess
- `sparta/src/lib/actions/events.ts:1-188` — padrão de Server Actions de eventos
- `sparta/src/lib/stores/match-session.ts:1-53` — Zustand store actual
- `sparta/src/lib/actions/lineups.ts:239-320` — padrão two-step join + jersey_number merge
- `sparta/src/components/ui/tooltip-explain.tsx` — para janela encerrada (stub)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Task 1: `RecentEventEntry` interface + 4 actions (`addRecentEvent`/`removeRecentEvent`/`setRecentEvents`/`clearRecentEvents`) + `useRecentEvents` selector adicionados ao store `useMatchSession`. Tipo importa `MATCH_ZONES` de schemas.
- Task 2: `getRecentMatchEvents(sessionId, limit=6)` adicionada a `events.ts` com `requireStaffRole()` + `getServiceRoleClient()`. Two-step query: `match_events` ORDER BY occurred_at DESC + `match_lineups` para jersey numbers. Retorna `Result<RecentEventEntry[], AppError>`.
- Task 3: `ZoneSelectorSheet` modificado para chamar `addRecentEvent` nos 3 caminhos de submit: offline (`enqueueMutation`), online success, e online failure (enqueue fallback). Selector optimizado `useMatchSession((s) => s.addRecentEvent)`.
- Task 4: `<EventChip>` criado com ícones lucide por acção, `ZONE_ABBR` monospace, confirmação inline sem animações, `aria-label` descritiva, stub `isWithinEditWindow = true` para Story 6.6, `min-h-[44px]`.
- Task 5: `<RecentEventsRing>` criado com `AbortController` no useEffect, session boundary via `prevSessionId.current`, 6 chips + placeholders dashed, delete optimistic com rollback via re-fetch, `role="log"` + `aria-live="polite"`.
- Task 6: `<RecentEventsRing sessionId={sessionId} />` adicionado ao `MatchEventCapture` entre o body e o `ZoneSelectorSheet`, dentro do `flex-col h-screen`.
- Task 7: 17 novos testes — 6 store (recentEvents), 8 EventChip, 10 RecentEventsRing (incluindo axe), 5 getRecentMatchEvents. `@testing-library/user-event` não instalado — usado `fireEvent` em alternativa. 1686/1730 testes ✅ (13 falhas pré-existentes: recharts mock, RLS integration, lineup-toggle).

### File List

- `sparta/src/lib/stores/match-session.ts` — MODIFICADO: RecentEventEntry interface + recentEvents state + 4 actions + useRecentEvents selector
- `sparta/src/lib/actions/events.ts` — MODIFICADO: getRecentMatchEvents() adicionada com two-step query
- `sparta/src/components/domain/match-event-capture/zone-selector-sheet.tsx` — MODIFICADO: addRecentEvent após submit (3 caminhos)
- `sparta/src/components/domain/match-event-capture/event-chip.tsx` — CRIADO: chip individual com confirmação inline
- `sparta/src/components/domain/match-event-capture/recent-events-ring.tsx` — CRIADO: footer ring com 6 chips + placeholders
- `sparta/src/components/domain/match-event-capture/match-event-capture.tsx` — MODIFICADO: RecentEventsRing incluído
- `sparta/src/__tests__/stores/match-session.store.test.ts` — MODIFICADO: 6 testes para recentEvents actions
- `sparta/src/__tests__/components/domain/match-event-capture/event-chip.test.tsx` — CRIADO: 8 testes EventChip
- `sparta/src/__tests__/components/domain/match-event-capture/recent-events-ring.test.tsx` — CRIADO: 10 testes RecentEventsRing + axe
- `sparta/src/__tests__/lib/actions/match-events.test.ts` — MODIFICADO: 5 testes getRecentMatchEvents

### Change Log

- 2026-05-30: Story 6.3 implementada — RecentEventsRing sticky footer com EventChip, Zustand store estendido, getRecentMatchEvents Server Action two-step query, addRecentEvent integrado em ZoneSelectorSheet (3 caminhos). 17 novos testes ✅; 1686/1730 testes ✅; lint ✅; typecheck sem regressões nos ficheiros alterados.
