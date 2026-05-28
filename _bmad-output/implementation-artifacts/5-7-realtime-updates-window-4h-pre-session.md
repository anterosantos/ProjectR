# Story 5.7: Realtime Updates — Janela 4h Pré-Sessão

**Status:** done

**Story ID:** 5.7
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-27
**Story anterior:** 5-6-painel-field-formation-4-3-3-view-with-toggle

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que as Stories **5.1**, **5.2**, **5.3**, **5.4**, **5.5** e **5.6** estejam **done** antes de começar.
>
> | Story | Cria | Necessário para |
> |-------|------|-----------------|
> | 5.1 | `session_metrics` table + `srpe_load` | Dados base para snapshots |
> | 5.2 | `computeAcwr()` + thresholds | Engine ACWR para snapshots |
> | 5.3 | `readiness_snapshots` table + `refreshUpcomingReadiness()` | Tabela que o Realtime monitoriza |
> | 5.4 | `<ReadinessPanel>` + `<ReadinessPanelList>` + `<PlayerRow>` | Componentes a modificar |
> | 5.5 | `<PlayerDrillDownSheet>` | Componente da Lista (contexto) |
> | 5.6 | `<ReadinessPanelFormation>` + botão Formação ativo | Chips de formação também animam |

---

## Story

As a Treinador,
I want the Painel to refresh in real time during the 4 hours leading up to a scheduled session,
So that newly submitted questionnaires update the semáforo without me reloading.

---

## Acceptance Criteria

### AC #1 — Subscrição Realtime dentro da janela 4h

**Given** a sessão seguinte com `scheduled_at` conhecida

**When** o staff abre o Painel dentro de `[scheduled_at - 4h, scheduled_at]`

**Then** o componente `<ReadinessPanel>` subscreve um canal Supabase Realtime `readiness-snapshots-{sessionId}` com `postgres_changes` na tabela `readiness_snapshots` filtrado por `session_id=eq.{sessionId}` (FR36)

**And** a subscrição é automaticamente cancelada (`supabase.removeChannel()`) quando o componente desmonta ou quando saímos da janela (NFR34 — ≤50 conexões simultâneas)

---

### AC #2 — Atualização em tempo real + animação de flash

**Given** um jogador submete questionário durante a janela (Epic 4)

**When** `refreshUpcomingReadiness()` faz upsert ao snapshot (Story 5.3) e o canal Realtime recebe o evento

**Then** `getReadinessPanelData(sessionId)` é chamada (Server Action) → `players` state é atualizado

**And** o `<PlayerRow>` afetado recebe `flashed={true}` por 600ms e exibe destaque de 200ms `ease-out` via `transition-colors duration-200 ease-out` com `data-flashed="true"` no elemento

**And** os counts agregados no header (Prontos/Cuidado/Alerta) atualizam automaticamente a partir do estado `players`

**And** chipas de formação em `<ReadinessPanelFormation>` (Story 5.6) recebem o mesmo mecanismo de flash quando a vista de formação está ativa

**And** `prefers-reduced-motion: reduce` → sem animação de flash (CSS media query via classe Tailwind ou `data-flashed` com `motion-safe:`)

---

### AC #3 — Sem Realtime fora da janela; refresh manual

**Given** o staff está no Painel fora da janela 4h (antes de `scheduled_at - 4h` ou após `scheduled_at`)

**When** o Painel renderiza

**Then** nenhuma subscrição Realtime está ativa

**And** o header exibe um botão "Atualizar" (com ícone `<RefreshCw>` de lucide-react)

**And** ao clicar "Atualizar": chama `getReadinessPanelData(sessionId)` → atualiza `players` state (sem flash)

**And** durante o refresh: botão mostra `disabled` + ícone a rodar (`animate-spin`)

---

### AC #4 — Autenticação Realtime + RLS

**Given** o canal Realtime é aberto via `createClient()` (browser client com JWT do utilizador)

**When** eventos chegam

**Then** o RLS da tabela `readiness_snapshots` garante que apenas linhas do clube do utilizador são recebidas (FR3)

**Note:** O cliente browser usa o JWT do utilizador autenticado; a subscrição respeita as políticas RLS existentes de Story 5.3 (SELECT staff mesmo clube).

---

### AC #5 — Migração Realtime + Testes ≥80%

**Given** migração `000255_readiness_snapshots_realtime.sql`

**When** aplicada

**Then** `readiness_snapshots` tem `REPLICA IDENTITY FULL` (necessário para eventos UPDATE incluírem `old` row)

**And** `supabase_realtime` publication inclui `readiness_snapshots`

**Given** testes em:
- `sparta/src/__tests__/readiness/realtime-readiness.test.tsx` (novo)
- Extensão de `sparta/src/__tests__/app/(staff)/prontidao.test.tsx`

**When** `npm run test --run` executa

**Then** cobertura inclui:
- ✅ `isInPreSessionWindow()` — boundary math (exatamente -4h, exatamente scheduled_at, fora de ambos)
- ✅ Subsccrição aberta quando `inWindow = true`, não aberta quando `inWindow = false`
- ✅ `removeChannel` chamado no cleanup do useEffect
- ✅ Estado `players` atualiza quando Realtime event chega (mock do canal)
- ✅ `flashed` prop ativo durante 600ms; removido após timeout
- ✅ Botão "Atualizar" visível fora da janela; ausente dentro da janela
- ✅ Botão "Atualizar" chama `getReadinessPanelData` e atualiza state

---

## Tasks / Subtasks

- [x] **Task 1: Migração `000255_readiness_snapshots_realtime.sql`** (AC: #4, #5)
  - [x] Criar `sparta/supabase/migrations/000255_readiness_snapshots_realtime.sql`
  - [x] `ALTER TABLE readiness_snapshots REPLICA IDENTITY FULL;`
  - [x] `ALTER PUBLICATION supabase_realtime ADD TABLE readiness_snapshots;`
  - [x] Sem DOWN migration (Realtime é uma configuração não-destrutiva)

- [x] **Task 2: Função utilitária `isInPreSessionWindow(scheduledAt)`** (AC: #1, #3)
  - [x] Criar `sparta/src/lib/readiness/realtime-window.ts` (ficheiro novo, importável em testes)
  - [x] Exportar `isInPreSessionWindow(scheduledAt: string): boolean`
  - [x] Lógica: `const t = new Date(scheduledAt).getTime(); const now = Date.now(); return now >= t - 4 * 60 * 60 * 1000 && now <= t;`
  - [x] Exportar `PRE_SESSION_WINDOW_MS = 4 * 60 * 60 * 1000` (constante testável)

- [x] **Task 3: Atualizar `ReadinessPanel`** (AC: #1, #2, #3)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel.tsx`
  - [x] Adicionar prop `scheduledAt?: string` à interface `ReadinessPanelProps` (opcional para retrocompatibilidade com testes)
  - [x] Adicionar `players: initialPlayers` prop renomeando o parâmetro existente para `initialPlayers`; criar `useState<PlayerReadinessData[]>(initialPlayers)` para `players`
  - [x] Adicionar `flashedIds: Set<string>` state: `useState<Set<string>>(new Set())`
  - [x] Adicionar `isRefreshing: boolean` state: `useState(false)`
  - [x] Adicionar `inWindow: boolean` state: `useState(() => isInPreSessionWindow(scheduledAt))`
  - [x] `useEffect` de intervalo (60s) para re-verificar `isInPreSessionWindow` → atualiza `inWindow` state (transição automática quando entra/sai da janela)
  - [x] `useEffect` de subscrição Realtime (deps: `[sessionId, inWindow]`) com cleanup `removeChannel`
  - [x] `handleRealtimeEvent` com flash 600ms + `getReadinessPanelData` refresco
  - [x] `handleManualRefresh` com `setIsRefreshing` e `getReadinessPanelData`
  - [x] Counts a partir de `players` state; `flashedIds` passado para List e Formation
  - [x] `onRefresh`, `isRefreshing`, `inWindow` passados para `ReadinessPanelHeader`

- [x] **Task 4: Atualizar `ReadinessPanelHeader`** (AC: #3)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel-header.tsx`
  - [x] Adicionar props: `onRefresh?: () => void`, `isRefreshing?: boolean`, `inWindow?: boolean`
  - [x] Botão "Atualizar" com `<RefreshCw>` quando `!inWindow && onRefresh`
  - [x] `disabled={isRefreshing}`, `animate-spin` quando a refrescar, `aria-label="Atualizar dados de prontidão"`

- [x] **Task 5: Atualizar `ReadinessPanelList`** (AC: #2)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel-list.tsx`
  - [x] Adicionar prop `flashedIds?: Set<string>` à interface `ReadinessPanelListProps`
  - [x] Passar `flashedIds` para cada `<PositionGroup flashedIds={flashedIds} />`

- [x] **Task 6: Atualizar `PositionGroup`** (AC: #2)
  - [x] Editar `sparta/src/components/domain/readiness/position-group.tsx`
  - [x] Adicionar prop `flashedIds?: Set<string>` à interface `PositionGroupProps`
  - [x] Passar `flashed={flashedIds?.has(snapshot.player_id) ?? false}` para cada `<PlayerRow>`

- [x] **Task 7: Atualizar `PlayerRow`** (AC: #2)
  - [x] Editar `sparta/src/components/domain/readiness/player-row.tsx`
  - [x] Adicionar prop `flashed?: boolean` à interface `PlayerRowProps`
  - [x] `data-flashed={flashed ? 'true' : undefined}` + classes `motion-safe:` no `<button>`

- [x] **Task 8: Atualizar `ReadinessPanelFormation` (Story 5.6)** (AC: #2)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel-formation.tsx`
  - [x] Adicionar prop `flashedIds?: Set<string>` à interface `ReadinessPanelFormationProps`
  - [x] Flash nos chips de banco com `motion-safe:` classes + `data-flashed`
  - [x] `flashedIds` passado para `FieldFormation` → chips de titular também animam (field-formation.tsx atualizado)

- [x] **Task 9: Atualizar `page.tsx`** (AC: #1)
  - [x] Editar `sparta/src/app/(staff)/prontidao/page.tsx`
  - [x] Passar `scheduledAt={scheduledAt}` para `<ReadinessPanel>`

- [x] **Task 10: Testes** (AC: #5)
  - [x] Criar `sparta/src/__tests__/readiness/realtime-readiness.test.tsx` — 14 testes ✅
  - [x] Estender `sparta/src/__tests__/app/(staff)/prontidao.test.tsx` — 1 teste AC #3 ✅

---

## Architecture / Technical Requirements

### CRÍTICO: Reutilizar, Não Reinventar

| O quê | Localização | Como usar |
|-------|-------------|-----------|
| `createClient()` | `@/lib/supabase/client` | Browser client com JWT do utilizador para Realtime |
| `getReadinessPanelData()` | `@/lib/actions/readiness` | Server Action chamada no cliente após evento Realtime |
| `isInPreSessionWindow()` | `@/lib/readiness/realtime-window` (NOVO) | Função pura testável separada do componente |
| `<RefreshCw>` | `lucide-react` | Ícone para botão de refresh manual |
| `motion-safe:` | Tailwind v4 prefixo | Aplica estilos apenas quando `prefers-reduced-motion` não está ativo |
| `PlayerReadinessData` | `@/types/supabase` | Tipo base (não alterar) |

### Supabase Realtime — API correta (Supabase JS v2)

```typescript
// Em readiness-panel.tsx — dentro do useEffect([sessionId, inWindow])
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const channel = supabase
  .channel(`readiness-snapshots-${sessionId}`)
  .on(
    'postgres_changes',
    {
      event: '*',            // INSERT | UPDATE | DELETE
      schema: 'public',
      table: 'readiness_snapshots',
      filter: `session_id=eq.${sessionId}`,
    },
    async (payload) => {
      const updatedPlayerId =
        (payload.new as { player_id?: string })?.player_id ??
        (payload.old as { player_id?: string })?.player_id;

      const result = await getReadinessPanelData(sessionId);
      if (result.ok) {
        setPlayers(result.data.players);

        if (updatedPlayerId) {
          setFlashedIds((prev) => new Set(prev).add(updatedPlayerId));
          setTimeout(() => {
            setFlashedIds((prev) => {
              const next = new Set(prev);
              next.delete(updatedPlayerId);
              return next;
            });
          }, 600); // 200ms CSS transition + 400ms buffer
        }
      }
    }
  )
  .subscribe();

return () => {
  void supabase.removeChannel(channel);
};
```

### Janela Pré-Sessão — Lógica em `realtime-window.ts`

```typescript
// sparta/src/lib/readiness/realtime-window.ts

export const PRE_SESSION_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 horas

export function isInPreSessionWindow(scheduledAt: string): boolean {
  const sessionTime = new Date(scheduledAt).getTime();
  const now = Date.now();
  return now >= sessionTime - PRE_SESSION_WINDOW_MS && now <= sessionTime;
}
```

### Tracking de Janela com Intervalo (1 min)

```typescript
// Em ReadinessPanel — useEffect para detetar transição automática
useEffect(() => {
  const id = setInterval(() => {
    setInWindow(isInPreSessionWindow(scheduledAt));
  }, 60_000);
  return () => clearInterval(id);
}, [scheduledAt]);
```

### Flash Animation — Tailwind `motion-safe:`

```tsx
// Em PlayerRow — prop flashed
<button
  className={`w-full px-4 py-3 flex items-center justify-between ... ${
    flashed
      ? 'motion-safe:bg-primary/10 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out'
      : ''
  }`}
  data-flashed={flashed ? 'true' : undefined}
  ...
>
```

`motion-safe:` aplica as classes apenas quando `prefers-reduced-motion` NÃO está ativo — NFR41 cumprido sem JavaScript extra.

### Hierarquia de Componentes Atualizada

```
ReadinessPanel (Client — Realtime + flash state + window tracking)
  props: players (initialPlayers), sessionId, scheduledAt, view?
  state: players, flashedIds, inWindow, isRefreshing, view
  │
  ├── ReadinessPanelHeader (onRefresh, isRefreshing, inWindow)
  │     └── [!inWindow] → botão "Atualizar" com RefreshCw
  │
  ├── [view === "list"] → ReadinessPanelList (players, sessionId, flashedIds)
  │     └── PositionGroup (flashedIds)
  │           └── PlayerRow (snapshot, position, onSelect, flashed)
  │
  └── [view === "formation"] → ReadinessPanelFormation (players, sessionId, flashedIds)
        ├── FieldFormation chips com flashed
        └── BenchGrid chips com flashed
```

### Migração `000255_readiness_snapshots_realtime.sql`

```sql
-- Story 5.7: Habilitar Supabase Realtime na tabela readiness_snapshots
-- REPLICA IDENTITY FULL necessário para eventos UPDATE incluírem o row antigo (payload.old)

ALTER TABLE readiness_snapshots REPLICA IDENTITY FULL;

-- Adicionar tabela à publication do Realtime
-- (supabase_realtime publication já existe no projeto Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE readiness_snapshots;
```

### `getReadinessPanelData` como Server Action chamada do cliente

Server Actions com `"use server"` **podem** ser importadas e chamadas de Client Components em Next.js 15+. Este padrão já existe no projeto (ex: `refreshUpcomingReadiness` em Story 5.3).

```typescript
// Em readiness-panel.tsx — import direto
import { getReadinessPanelData } from "@/lib/actions/readiness";

// Dentro de handleRealtimeEvent (async)
const result = await getReadinessPanelData(sessionId);
if (result.ok) setPlayers(result.data.players);
```

### `noUncheckedIndexedAccess` (NFR55)

```typescript
// ✅ Correcto — guards para payload do Realtime
const updatedPlayerId =
  (payload.new as { player_id?: string })?.player_id ??
  (payload.old as { player_id?: string })?.player_id;

// ✅ Correcto — Set operations são type-safe
setFlashedIds((prev) => new Set(prev).add(updatedPlayerId));

// ❌ ERRO — acesso direto sem guard
const id = payload.new.player_id; // TypeScript erro: payload.new é unknown
```

### Throttling de eventos Realtime

Se múltiplos eventos chegarem em rápida sucessão (ex: vários jogadores submetem ao mesmo tempo), cada evento dispara uma chamada a `getReadinessPanelData`. Para MVP isto é aceitável (o Supabase Realtime tem rate limiting built-in, e o clube tem ≤40 jogadores). Não implementar debounce nesta story — deferido para Growth.

### Props que `page.tsx` precisa de passar

```tsx
// sparta/src/app/(staff)/prontidao/page.tsx
// Linha atual: <ReadinessPanel players={players} sessionId={sessionId} view="list" />
// Nova: adicionar scheduledAt

<ReadinessPanel
  players={players}
  sessionId={sessionId}
  scheduledAt={scheduledAt}   // ← ADICIONAR (já existe na scope da função)
  view="list"
/>
```

`scheduledAt` já está disponível no scope de `ProntidaoPage` — vem de `sessionResult.data.scheduledAt`.

---

## Dev Notes — Contexto das Stories Anteriores

### Story 5.4 — Padrões que DEVEM ser mantidos

- `sessionStorage` + `startTransition` para view toggle — não alterar (P-12, P-13)
- `readyCount/cautionCount/alertCount` calculados a partir de `players` array — mudar para usar `players` state (não `initialPlayers` prop)
- Counts já excluem neutros corretamente (`state === "ready"` etc.)

### Story 5.3 — `readiness_snapshots` RLS

A tabela tem RLS com:
- SELECT: staff (coach/analyst) do mesmo clube
- INSERT/UPDATE: service-role apenas

O Supabase Realtime com `postgres_changes` respeita RLS automáticamente quando o client usa o JWT do utilizador autenticado. **Não há necessidade de filtros adicionais no cliente** além do `filter: 'session_id=eq.{sessionId}'`.

### Story 5.6 — `ReadinessPanelFormation` (dependência)

- Tem chips de jogadores com `onSelectPlayer` — adicionar `flashed` de forma análoga a `PlayerRow`
- A interface `ReadinessPanelFormationProps` vai precisar de `flashedIds?: Set<string>`
- Ver structure em `5-6-painel-field-formation-4-3-3-view-with-toggle.md` — chips no `<FieldFormation>` e no banco (bench grid)

### Commits recentes relevantes

- `eb1c6a6 Fix` — patch 5.4
- `d5e1f25 5.3 5.4 5.5 - done` — stories 5.3-5.5 concluídas
- `db6a32c 5.2 - Done` — ACWR engine concluída

### Imports necessários novos em `readiness-panel.tsx`

```typescript
import { createClient } from "@/lib/supabase/client";
import { isInPreSessionWindow } from "@/lib/readiness/realtime-window";
import { getReadinessPanelData } from "@/lib/actions/readiness";
// RefreshCw não está no readiness-panel — está no readiness-panel-header
```

```typescript
// Em readiness-panel-header.tsx
import { RefreshCw } from "lucide-react";
```

---

## Testes — Padrão e Fixtures

### Mock do Supabase Realtime

```typescript
// Em realtime-readiness.test.tsx
type RealtimePayloadHandler = (payload: Record<string, unknown>) => void;

const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnThis();
const mockRemoveChannel = vi.fn().mockResolvedValue({ error: null });
let capturedHandler: RealtimePayloadHandler | null = null;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((_event: string, _filter: unknown, handler: RealtimePayloadHandler) => {
        capturedHandler = handler;
        return { subscribe: mockSubscribe };
      }),
      subscribe: mockSubscribe,
    }),
    removeChannel: mockRemoveChannel,
  }),
}));

vi.mock('@/lib/actions/readiness', () => ({
  getReadinessPanelData: vi.fn(),
  getUpcomingSession: vi.fn(),
  // ... outros exports
}));
```

### Testes de `isInPreSessionWindow` (função pura)

```typescript
// Em realtime-readiness.test.tsx
import { isInPreSessionWindow, PRE_SESSION_WINDOW_MS } from '@/lib/readiness/realtime-window';

describe('isInPreSessionWindow', () => {
  it('retorna true exactamente no início da janela (scheduledAt - 4h)', () => {
    const scheduledAt = new Date(Date.now() + 1).toISOString(); // ~ agora + 1ms
    // no início da janela: agora = scheduledAt - 4h
    const fourHoursAgo = new Date(Date.now() - PRE_SESSION_WINDOW_MS + 1);
    const scheduledAtFuture = new Date(fourHoursAgo.getTime() + PRE_SESSION_WINDOW_MS).toISOString();
    expect(isInPreSessionWindow(scheduledAtFuture)).toBe(true);
  });

  it('retorna false antes da janela', () => {
    const scheduledAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // +5h
    expect(isInPreSessionWindow(scheduledAt)).toBe(false);
  });

  it('retorna false após a sessão ter começado', () => {
    const scheduledAt = new Date(Date.now() - 60 * 1000).toISOString(); // -1min
    expect(isInPreSessionWindow(scheduledAt)).toBe(false);
  });

  it('retorna true a meio da janela (2h antes)', () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h
    expect(isInPreSessionWindow(scheduledAt)).toBe(true);
  });
});
```

### Teste do ciclo de vida Realtime (subscribe/unsubscribe)

```typescript
import { render, act, waitFor } from '@testing-library/react';
import { ReadinessPanel } from '@/components/domain/readiness/readiness-panel';

const FUTURE_IN_WINDOW = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h
const FUTURE_OUT_WINDOW = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // +6h
const SESSION_UUID = '550e8400-e29b-41d4-a716-446655440001';

it('subscreve ao Realtime quando inWindow=true', async () => {
  render(
    <ReadinessPanel
      players={[]}
      sessionId={SESSION_UUID}
      scheduledAt={FUTURE_IN_WINDOW}
    />
  );
  await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
});

it('NÃO subscreve ao Realtime quando inWindow=false', async () => {
  render(
    <ReadinessPanel
      players={[]}
      sessionId={SESSION_UUID}
      scheduledAt={FUTURE_OUT_WINDOW}
    />
  );
  await act(async () => {});
  expect(mockSubscribe).not.toHaveBeenCalled();
});

it('remove canal no cleanup', async () => {
  const { unmount } = render(
    <ReadinessPanel
      players={[]}
      sessionId={SESSION_UUID}
      scheduledAt={FUTURE_IN_WINDOW}
    />
  );
  await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
  unmount();
  expect(mockRemoveChannel).toHaveBeenCalled();
});
```

### Teste do flash (animação)

```typescript
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

it('atualiza players e activa flash após evento Realtime', async () => {
  const updatedPlayers = [makeSnapshot({ player_id: 'p-1', state: 'caution' })];
  vi.mocked(getReadinessPanelData).mockResolvedValue({
    ok: true,
    data: { players: updatedPlayers },
  });

  render(
    <ReadinessPanel
      players={[makeSnapshot({ player_id: 'p-1', state: 'ready' })]}
      sessionId={SESSION_UUID}
      scheduledAt={FUTURE_IN_WINDOW}
    />
  );

  await waitFor(() => expect(capturedHandler).toBeTruthy());

  await act(async () => {
    capturedHandler!({
      new: { player_id: 'p-1', state: 'caution' },
      old: { player_id: 'p-1', state: 'ready' },
    });
  });

  await waitFor(() => {
    const flashedEl = document.querySelector('[data-flashed="true"]');
    expect(flashedEl).toBeInTheDocument();
  });
});
```

### Teste do botão de refresh manual

```typescript
import { screen, fireEvent, waitFor } from '@testing-library/react';

it('mostra botão Atualizar fora da janela', () => {
  render(
    <ReadinessPanel players={[]} sessionId={SESSION_UUID} scheduledAt={FUTURE_OUT_WINDOW} />
  );
  expect(screen.getByRole('button', { name: /Atualizar dados de prontidão/i })).toBeInTheDocument();
});

it('NÃO mostra botão Atualizar dentro da janela', () => {
  render(
    <ReadinessPanel players={[]} sessionId={SESSION_UUID} scheduledAt={FUTURE_IN_WINDOW} />
  );
  expect(screen.queryByRole('button', { name: /Atualizar dados de prontidão/i })).not.toBeInTheDocument();
});

it('refresh manual chama getReadinessPanelData e atualiza players', async () => {
  const newPlayers = [makeSnapshot({ player_id: 'p-x', state: 'alert' })];
  vi.mocked(getReadinessPanelData).mockResolvedValue({ ok: true, data: { players: newPlayers } });

  render(
    <ReadinessPanel players={[]} sessionId={SESSION_UUID} scheduledAt={FUTURE_OUT_WINDOW} />
  );
  fireEvent.click(screen.getByRole('button', { name: /Atualizar dados de prontidão/i }));
  await waitFor(() => expect(getReadinessPanelData).toHaveBeenCalledWith(SESSION_UUID));
});
```

---

## Referências

- [Epics.md — Story 5.7](../_bmad-output/planning-artifacts/epics.md) — ACs completos + FR36 + NFR34 + NFR41
- [Story 5.3](./5-3-readiness-snapshots-materialized-source-for-the-painel.md) — `readiness_snapshots` schema + RLS
- [Story 5.4](./5-4-painel-de-prontidao-lista-por-posicao-default-view.md) — infraestrutura do painel, P-12/13
- [Story 5.6](./5-6-painel-field-formation-4-3-3-view-with-toggle.md) — `ReadinessPanelFormation` (chips a animar)
- [readiness-panel.tsx](../sparta/src/components/domain/readiness/readiness-panel.tsx) — MODIFICAR: Realtime + flash state + scheduledAt
- [readiness-panel-header.tsx](../sparta/src/components/domain/readiness/readiness-panel-header.tsx) — MODIFICAR: botão "Atualizar"
- [readiness-panel-list.tsx](../sparta/src/components/domain/readiness/readiness-panel-list.tsx) — MODIFICAR: flashedIds prop
- [position-group.tsx](../sparta/src/components/domain/readiness/position-group.tsx) — MODIFICAR: flashedIds prop
- [player-row.tsx](../sparta/src/components/domain/readiness/player-row.tsx) — MODIFICAR: flashed prop + CSS
- [readiness.ts](../sparta/src/lib/actions/readiness.ts) — getReadinessPanelData() (não modificar)
- [client.ts](../sparta/src/lib/supabase/client.ts) — createClient() → browser client para Realtime
- [prontidao/page.tsx](../sparta/src/app/(staff)/prontidao/page.tsx) — MODIFICAR: passar scheduledAt
- [AGENTS.md](../sparta/AGENTS.md) — aliases @/*, React 19, noUncheckedIndexedAccess, testes

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Status

**Review** — Implementação completa. Todos os ACs verificados. 14 novos testes ✅. 1469/1469 testes ✅. Lint ✅.

### Completion Notes (Dev Agent)

- ✅ AC #1: `ReadinessPanel` subscreve `postgres_changes` na janela 4h via `createClient()` browser client; `removeChannel()` no cleanup
- ✅ AC #2: Flash 200ms `ease-out` via `motion-safe:` Tailwind em `PlayerRow` e chips formation; `data-flashed="true"` remove-se após 600ms via `setTimeout`
- ✅ AC #3: Botão "Atualizar" com `<RefreshCw>` visível fora da janela; `animate-spin` durante refresh; ausente dentro da janela
- ✅ AC #4: Browser client usa JWT do utilizador; RLS da tabela `readiness_snapshots` aplica-se automaticamente
- ✅ AC #5: Migração `000255` criada; 14 novos testes em `realtime-readiness.test.tsx` + 1 em `prontidao.test.tsx`
- ✅ `scheduledAt` prop opcional para retrocompatibilidade com testes existentes
- ✅ `field-formation.tsx` também atualizado (não estava na lista original mas necessário para chips de titular)
- ✅ Fake timers evitados nos testes; `act(async)` para flush de Promises assíncronas

### Notas Chave para o Developer

1. **Migração obrigatória antes de testar Realtime** — `000255_readiness_snapshots_realtime.sql` com `REPLICA IDENTITY FULL` + `ALTER PUBLICATION`. Sem esta migração, o canal liga mas não recebe eventos UPDATE com `payload.old`.
2. **`createClient()` (browser) — NÃO `createServerClient()`** — o Realtime usa o JWT do utilizador no browser. Server clients não têm websocket support.
3. **`getReadinessPanelData` pode ser chamada do cliente** — é uma Server Action (`"use server"`), importável diretamente em Client Components. Não criar Route Handler alternativo.
4. **`motion-safe:` resolve `prefers-reduced-motion`** — sem JavaScript extra. Tailwind v4 suporta este prefixo nativamente.
5. **Flash de 600ms** = 200ms CSS transition + 400ms visível ao utilizador. O `data-flashed` remove-se após 600ms no `setTimeout`.
6. **Sem TanStack Query nesta story** — o comentário em `readiness-panel-list.tsx` ("reservado para TanStack Query Story 5.7") era uma antecipação. A abordagem final usa `useState` + Realtime diretamente. Remover o `void _` e usar `flashedIds` em seu lugar.
7. **`scheduledAt` já existe no `page.tsx`** — apenas adicionar como prop ao `<ReadinessPanel>`. Não há nova fetch a fazer.
8. **NFR34: ≤50 conexões Realtime** — a subscrição automática só existe dentro da janela 4h. `removeChannel` no cleanup garante que o contador de conexões diminui.
9. **Sem debounce de eventos para MVP** — múltiplos eventos simultâneos disparam múltiplas chamadas a `getReadinessPanelData`. Aceitável para ≤40 jogadores. Deferido para Growth.
10. **`ReadinessPanelFormation` (Story 5.6)** — adicionar `flashedIds?: Set<string>` prop. Se 5.6 ainda não estiver done, implementar o suporte na mesma tarefa para evitar regressão.

### Ficheiros Criados

- `sparta/supabase/migrations/000255_readiness_snapshots_realtime.sql`
- `sparta/src/lib/readiness/realtime-window.ts`
- `sparta/src/__tests__/readiness/realtime-readiness.test.tsx`

### Ficheiros Modificados

- `sparta/src/app/(staff)/prontidao/page.tsx` — `scheduledAt` prop
- `sparta/src/components/domain/readiness/readiness-panel.tsx` — Realtime + flash + window
- `sparta/src/components/domain/readiness/readiness-panel-header.tsx` — botão "Atualizar"
- `sparta/src/components/domain/readiness/readiness-panel-list.tsx` — `flashedIds` prop
- `sparta/src/components/domain/readiness/position-group.tsx` — `flashedIds` prop
- `sparta/src/components/domain/readiness/player-row.tsx` — `flashed` prop + CSS
- `sparta/src/components/domain/readiness/readiness-panel-formation.tsx` — `flashedIds` prop
- `sparta/src/components/domain/readiness/field-formation.tsx` — `flashedIds` prop para chips titulares
- `sparta/src/__tests__/app/(staff)/prontidao.test.tsx` — testes adicionais (AC #3)

---

## Change Log

### 2026-05-28 (Dev Story Complete)

- ✅ Migração `000255_readiness_snapshots_realtime.sql` criada (REPLICA IDENTITY FULL + publication)
- ✅ `realtime-window.ts` criado com `isInPreSessionWindow` + `PRE_SESSION_WINDOW_MS`
- ✅ `readiness-panel.tsx` refatorado: `useState(initialPlayers)`, `flashedIds`, `inWindow`, `isRefreshing`, Realtime useEffect, interval useEffect
- ✅ `readiness-panel-header.tsx` atualizado: botão "Atualizar" com `<RefreshCw>`, `animate-spin`, `aria-label`
- ✅ `readiness-panel-list.tsx`, `position-group.tsx`, `player-row.tsx` atualizados: hierarquia `flashedIds` → `flashed`
- ✅ `readiness-panel-formation.tsx` + `field-formation.tsx` atualizados: flash em chips banco e titulares
- ✅ `prontidao/page.tsx` atualizado: `scheduledAt` passado ao `<ReadinessPanel>`
- ✅ 14 novos testes em `realtime-readiness.test.tsx`; 1 teste adicionado em `prontidao.test.tsx`
- ✅ 1469/1469 testes ✅; lint ✅; sem erros TypeScript novos

### 2026-05-27 (Story Created)
- ✅ Análise exaustiva de Stories 5.3, 5.4, 5.6 (dependências e patches)
- ✅ Supabase Realtime API verificada (`postgres_changes`, `filter`, `removeChannel`)
- ✅ Migração `000255` identificada como necessária (REPLICA IDENTITY FULL + publication)
- ✅ Função pura `isInPreSessionWindow` extraída para ficheiro testável separado
- ✅ Flash animation via `motion-safe:` Tailwind (sem JavaScript para prefers-reduced-motion)
- ✅ Throttling de eventos adiado para Growth (MVP com ≤40 jogadores suficiente)
- ✅ `scheduledAt` disponível no scope de `page.tsx` (sem nova fetch)
- ✅ Fixtures e mocks de Realtime para testes documentados
- ✅ Hierarquia de props `flashedIds` mapeada (ReadinessPanel → List → PositionGroup → PlayerRow)
- ✅ Confirmado: `getReadinessPanelData` Server Action chamável de Client Components
- ✅ TanStack Query deferido — `useState` direto suficiente para este padrão Realtime

---

## Code Review Findings

**2026-05-28 — Adversarial Review** (3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor)

Summary: 12 issues identified after deduplication. Acceptance Auditor confirms all ACs met (spec-compliant ✅).

### CRITICAL (1)

- [x] TR-002: Flash timeout leak + race condition — **FIXED:** timeoutId captured in useRef Map, cleaned up on unmount and deduplicating concurrent timeouts per player ID. (readiness-panel.tsx)

### HIGH (3)

- [x] TR-001: Concurrent refresh without debounce — **FIXED:** Added refreshInProgressRef to prevent concurrent requests. (readiness-panel.tsx:handleManualRefresh)
- [x] TR-003: Window transition race on inWindow state change — **FIXED:** Added inWindowRef guard callback check to prevent stale updates after window transition. (readiness-panel.tsx)
- [x] TR-004: Realtime fetch error swallowed in callback — **FIXED:** Added try-catch with error logging in Realtime event callback. (readiness-panel.tsx)

### MEDIUM (5)

- [x] TR-005: Unchecked type coercion + null safety — **FIXED:** Added String() cast for jerseyNum, type guards on updatedPlayerId. (readiness-panel.tsx, player-row.tsx)
- [x] TR-006: removeChannel fire-and-forget failure — **FIXED:** Added .catch() error handler for removeChannel(). (readiness-panel.tsx)
- [x] TR-007: Invalid Date parsing returns NaN silently — **FIXED:** Added isNaN() check after getTime() in isInPreSessionWindow(). (realtime-window.ts)
- [x] TR-008: sessionStorage broad try-catch masks real errors — **FIXED:** Added specific error type detection (QuotaExceededError, SecurityError) with targeted logging. (readiness-panel.tsx)
- [x] TR-011: FieldFormation jerseyNum type coercion — **FIXED:** Ensured String() cast already present in field-formation.tsx. (field-formation.tsx:131)

### LOW (4)

- [x] TR-009: Refresh button disabled state lacks aria-label feedback — **FIXED:** Added dynamic aria-label and aria-busy attributes. (readiness-panel-header.tsx)
- [x] TR-010: Tooltip ID collision if PlayerRow duplicated — **FIXED:** Changed tooltipId to compound ID format (insufficient-{player_id}-tooltip). (player-row.tsx)
- [x] TR-012: Motion-safe CSS without fallback — **FIXED:** Restructured className to ensure base styles (hover:bg-muted/50 transition-colors) always present, motion-safe applies conditionally. (player-row.tsx)
- [x] TR-014: 60s inWindow interval check — **DISMISSED:** Acceptable per analysis. No action taken.

### DEFERRED (1)

- [x] TR-013: Migration assumes supabase_realtime publication exists — 000255_readiness_snapshots_realtime.sql does not create the publication. Assume it exists in prod (created separately). Flag for deploy checklist. (supabase/migrations/000255_readiness_snapshots_realtime.sql)
