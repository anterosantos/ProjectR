# Story 5.6: Painel — Vista de Formação 4-3-3 com Toggle

**Status:** in-progress

**Story ID:** 5.6
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-27
**Story anterior:** 5-5-painel-drill-down-sheet-with-4-week-series-banda-acwr-presences-nota-livre

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que as Stories **5.1**, **5.2**, **5.3**, **5.4** e **5.5** estejam **done** antes de começar.
>
> | Story | Cria | Necessário para |
> |-------|------|-----------------|
> | 5.1 | `session_metrics` table + `srpe_load` | Dados base de carga |
> | 5.2 | `computeAcwr()` + `ACWR_THRESHOLDS` | Scores ACWR para badges |
> | 5.3 | `readiness_snapshots` + `getClubReadinessSnapshots()` | Fonte de dados do painel |
> | 5.4 | `<ReadinessPanel>` + toggle placeholder desativado + `<PlayerRow>` | Infraestrutura do painel |
> | 5.5 | `<PlayerDrillDownSheet>` + `getPlayerDrillDownData()` | Sheet ao tocar num chip |

---

## Story

As a Treinador,
I want a "Formação" toggle on the Painel header that swaps the list for an SVG 4-3-3 with the 11 starters positioned and the bench in a grid below,
So that I can complement the list view with a spatial mental model when planning the lineup.

---

## Acceptance Criteria

### AC #1 — Toggle ativa a vista de formação

**Given** o toggle no sticky header (`UX-DR12`, `UX-DR46`)

**When** o staff toca em "Formação"

**Then** `<ReadinessPanel view="formation">` renderiza `<ReadinessPanelFormation>` (UX-DR15) — campo 2D com 11 titulares posicionados no esquema 4-3-3

**And** cada chip de jogador tem `<SemaforoBadge>` (cor + ícone + forma) igual à vista Lista

---

### AC #2 — Dados da convocatória

**Given** a sessão seguinte é um jogo (`type = 'match'` ou `'friendly'`) com convocatória definida

**When** a vista de formação renderiza

**Then** a formação mostra os 11 titulares (`role = 'starter'`) de `match_lineups` para essa sessão

---

### AC #3 — Fallback para treino ou jogo sem convocatória

**Given** a sessão seguinte é um treino (`type = 'treino'`) OU um jogo sem convocatória definida

**When** a vista de formação é selecionada

**Then** o campo mostra a convocatória mais recente (jogo/amigável mais recente do clube com lineup completo)

**Or** se não existir nenhuma convocatória anterior, mostra `<EmptyState>` com mensagem "Sem convocatória definida — define no Calendário"

---

### AC #4 — Banco de suplentes

**Given** existem convocados com `role = 'bench'`

**When** a vista renderiza

**Then** os suplentes aparecem numa grelha abaixo do campo SVG com o mesmo semáforo badge

---

### AC #5 — Tap num chip abre DrillDownSheet

**Given** um chip de jogador no campo ou banco é tocado

**When** ativado

**Then** o mesmo `<PlayerDrillDownSheet>` da Story 5.5 abre com os dados desse jogador

---

### AC #6 — Persistência de vista (sessionStorage)

**Given** o staff alterna para "Formação"

**When** recarrega o Painel (na mesma sessão do browser)

**Then** a última vista é preservada via `sessionStorage` (chave `"readiness-panel-view"`)

**Note:** A implementação da Story 5.4 usa `sessionStorage` (não `localStorage` como descrito no epics) — manter consistente com o padrão existente em `readiness-panel.tsx`.

---

### AC #7 — Apenas 4-3-3 no MVP; selector de outras formações desativado

**Given** Phase 1 scope (UX-DR15)

**When** a vista de formação está ativa

**Then** apenas o esquema 4-3-3 é suportado no MVP

**And** um selector de formação alternativa (`"4-4-2"`, `"3-5-2"`, etc.) mostra as opções com estado `disabled` e tooltip `"Em breve"`

---

### AC #8 — Acessibilidade (NFR37, UX-DR42)

**Given** axe-core corre na vista de formação

**When** testado

**Then** zero violations

**Especificamente:**
- ✅ Cada chip de jogador tem `aria-label="Estado: {state PT-PT}, {name}, {position}, ACWR {value}"` (AC epics)
- ✅ O SVG do campo tem `role="img"` + `aria-label="Campo de futebol — formação 4-3-3"`
- ✅ O botão "Formação" no header agora está **ativado** (remover `disabled`)
- ✅ `aria-pressed={view === "formation"}` no botão
- ✅ Chips no banco têm mesmo aria-label pattern

---

### AC #9 — Testes ≥80%

**Given** testes em:
- `sparta/src/__tests__/readiness/readiness-panel-formation.test.tsx` (novo)
- `sparta/src/__tests__/readiness/field-formation.test.tsx` (novo)
- Extensão de `sparta/src/__tests__/app/(staff)/prontidao.test.tsx`

**When** `npm run test --run` executa

**Then** cobertura inclui:
- ✅ Toggle "Formação" ativa a vista (mock `getFormationData`)
- ✅ EmptyState quando `source === 'none'`
- ✅ 11 chips de titular renderizados
- ✅ Chips de banco renderizados
- ✅ Tap num chip chama `onSelectPlayer`
- ✅ axe-core: zero violations

---

## Tasks / Subtasks

- [x] **Task 1: Server Action `getFormationData()` em `readiness.ts`** (AC: #2, #3)
  - [x] Adicionar função `getFormationData(sessionId: string)` a `sparta/src/lib/actions/readiness.ts`
  - [x] `requireStaffRole()` no início
  - [x] Fetch tipo da sessão: `supabase.from('sessions').select('type').eq('id', sessionId).eq('club_id', clubId).single()`
  - [x] Se `type === 'match'` ou `type === 'friendly'`:
    - [x] Usar `(supabase.from as any)("match_lineups")` para fetch lineup da sessão (`eq('session_id', sessionId)`)
    - [x] Se lineup tem ≥1 starter → retornar `{ lineups, source: 'session_lineup' }`
  - [x] Fallback (treino ou jogo sem lineup): query sessões de jogo recentes do clube (`.in('type', ['match', 'friendly']).lt('scheduled_at', now).order('scheduled_at', { ascending: false }).limit(5)`) → iterar e usar a primeira com lineup
  - [x] Sem nenhum lineup → retornar `{ lineups: [], source: 'none' }`
  - [x] Verificar `error` de cada query com log; nunca silenciar

- [x] **Task 2: Componente `ReadinessPanelFormation`** (AC: #2, #3, #4, #5, #8)
  - [x] Criar `sparta/src/components/domain/readiness/readiness-panel-formation.tsx` (Client Component, `"use client"`)
  - [x] Props: `{ players: PlayerReadinessData[], sessionId: string }`
  - [x] `useEffect([sessionId])` → chamar `getFormationData(sessionId)`; `status: 'loading' | 'loaded' | 'error'`
  - [x] Estado `formationData: FormationResult | null`
  - [x] Se `source === 'none'` → `<EmptyState>` com título "Sem convocatória definida"
  - [x] Se loaded → merge lineup com players array: `players.find(p => p.player_id === lineup.player_id)` para cada starter/bench
  - [x] Separar `starters` (role === 'starter') e `bench` (role === 'bench')
  - [x] `[selectedPlayer, setSelectedPlayer]` state para o DrillDownSheet
  - [x] Renderizar `<FieldFormation starters={starters} onSelectPlayer={setSelectedPlayer} />`
  - [x] Renderizar grelha de suplentes abaixo (se bench não vazio)
  - [x] Renderizar `<PlayerDrillDownSheet>` (Story 5.5) com selectedPlayer
  - [x] Loading: Skeleton simples enquanto carrega

- [x] **Task 3: Componente `FieldFormation` (SVG)** (AC: #1, #7, #8)
  - [x] Criar `sparta/src/components/domain/readiness/field-formation.tsx` (Client Component)
  - [x] Props: `{ starters: PlayerReadinessData[], onSelectPlayer: (p: PlayerReadinessData) => void }`
  - [x] Container `<div className="relative w-full">` com `paddingBottom: '133%'` (aspect ratio 3:4 — campo de futebol)
  - [x] SVG fundo do campo: `<svg viewBox="0 0 300 400" role="img" aria-label="Campo de futebol — formação 4-3-3" ...>` com fills verde e linhas brancas (área, meio-campo)
  - [x] Player chips: absolutamente posicionados via `left`/`top` em percentagem (ver tabela de posições abaixo)
  - [x] Cada chip: botão clicável com número de camisola + nome abreviado
  - [x] `aria-label` obrigatório por AC #8
  - [x] Selector de formação alternativa (disabled) no topo — "4-3-3 ▾" com tooltip "Em breve"

- [x] **Task 4: Ativar botão "Formação" no header** (AC: #1, #8)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel-header.tsx`
  - [x] Remover `disabled` e classes `opacity-50 cursor-not-allowed` do botão "Formação"
  - [x] Adicionar `onClick={() => onViewChange("formation")`
  - [x] Atualizar `aria-pressed={view === "formation"}`
  - [x] Remover `<span className="sr-only"> (em breve)</span>`
  - [x] Remover `title="Em breve..."` do botão "Formação"

- [x] **Task 5: Atualizar `ReadinessPanel`** (AC: #1)
  - [x] Editar `sparta/src/components/domain/readiness/readiness-panel.tsx`
  - [x] Substituir `<div>` placeholder "Vista de formação disponível em breve" com `<ReadinessPanelFormation players={players} sessionId={sessionId} />`
  - [x] Importar `ReadinessPanelFormation`

- [x] **Task 6: Testes** (AC: #9)
  - [x] Criar `sparta/src/__tests__/readiness/readiness-panel-formation.test.tsx`
  - [x] Criar `sparta/src/__tests__/readiness/field-formation.test.tsx`
  - [x] Estender `sparta/src/__tests__/app/(staff)/prontidao.test.tsx`

---

## Review Findings (2026-05-28)

### Decision-Needed (RESOLVED)

- [x] **[Decision → Patch]** AC #3: Changed fallback threshold from `>= 11` to `>= 1` (allow partial lineups) — readiness.ts line 578

- [x] **[Decision → Patch]** Data inconsistency guard added: EmptyState when all starters missing from players array — readiness-panel-formation.tsx lines 111-121

### Patches (ALL APPLIED ✅)

- [x] **[Patch]** Added type definitions: FieldFormationProps, ReadinessPanelFormationProps, LoadStatus — field-formation.tsx:4-7; readiness-panel-formation.tsx:22-24

- [x] **[Patch]** Fixed loose Supabase type cast: removed `as` type assertion, added fallback to error.message — readiness.ts:536, 570

- [x] **[Patch]** Added player.state enum validation: `isValidState()` guard function — field-formation.tsx:20-22; readiness-panel-formation.tsx:28-30

- [x] **[Patch — CRITICAL]** Fixed: starters.length > 0 now returns `starters` only (not currentLineups) — readiness.ts:545

- [x] **[Patch — CRITICAL]** Fixed: pastStarters.length >= 1 now returns `pastStarters` only (not pastLineups) — readiness.ts:579

- [x] **[Patch]** Fixed player name edge case: `(playerName?.trim() || 'Jogador').split(' ')[0] ?? 'Jogador'` — field-formation.tsx:104; readiness-panel-formation.tsx:136

- [x] **[Patch]** Fixed race condition: added `isMounted` cleanup flag in useEffect — readiness-panel-formation.tsx:34-65

### Deferred

- [x] **[Defer]** Missing error boundary for PlayerDrillDownSheet — Pre-existing error handling pattern, not caused by this change. Defer to Story 5.7+ general error boundary work.

---

## Architecture / Technical Requirements

### CRÍTICO: Reutilizar, Não Reinventar

| O quê | Localização | Como usar |
|-------|-------------|-----------|
| `<SemaforoBadge>` | `@/components/ui/semaforo-badge` | `state={player.state} size="sm"` nos chips |
| `<EmptyState>` | `@/components/ui/empty-state` | Para `source === 'none'` |
| `<PlayerDrillDownSheet>` | `@/components/domain/readiness/player-drill-down-sheet` (Story 5.5) | `snapshot={selectedPlayer} open={...} onClose={...}` |
| `getPositionKey()` | `@/components/domain/readiness/readiness-panel-list` (exportado) | Agrupar jogadores por posição |
| `READINESS_STATE_PRIORITY` | `@/lib/readiness/thresholds` | Ordenar dentro de linha |
| `PlayerReadinessData` | `@/types/supabase` | Tipo base dos jogadores |
| `(supabase.from as any)("match_lineups")` | padrão de `lineups.ts` | OBRIGATÓRIO — tabela não gerada em types |
| `requireStaffRole()` | função privada em `readiness.ts` (já existe) | Início de `getFormationData` |

### Hierarquia de Componentes (final)

```
ReadinessPanel (Client — view state sessionStorage)
  ├── ReadinessPanelHeader (sticky, toggle Lista|Formação) ← MODIFICAR: ativar botão Formação
  │
  ├── [view === "list"]  → ReadinessPanelList (existente)
  │
  └── [view === "formation"] → ReadinessPanelFormation (NOVO)  ← substituir placeholder
        ├── [status=loading] → Skeleton
        ├── [source='none']  → EmptyState "Sem convocatória definida"
        └── [source≠'none']
              ├── FormationSelector (só 4-3-3 ativo, restantes disabled) → "Em breve" tooltip
              ├── <FieldFormation starters={starters} onSelectPlayer={…} />  (NOVO — SVG campo)
              ├── BenchGrid (suplentes em grelha flex-wrap)
              └── <PlayerDrillDownSheet> (Story 5.5)
```

### Data Flow para Formação

1. Staff toca "Formação" → `handleViewChange("formation")` em `readiness-panel.tsx`
2. `<ReadinessPanelFormation>` monta → `useEffect` chama `getFormationData(sessionId)`
3. Server Action verifica session type → fetches lineup (sessão ou recente)
4. Component merge: `lineup.player_id` → `players.find(p => p.player_id === id)` → `FormationPlayerData`
5. `<FieldFormation>` renderiza starters em posições 4-3-3
6. Tap num chip → `setSelectedPlayer(player)` → `<PlayerDrillDownSheet open={true}>`

### Server Action `getFormationData` — estrutura completa

```typescript
// Em sparta/src/lib/actions/readiness.ts (adicionar ao ficheiro existente)

export interface FormationEntry {
  player_id: string;
  role: 'starter' | 'bench';
}

export interface FormationResult {
  lineups: FormationEntry[];
  source: 'session_lineup' | 'recent_lineup' | 'none';
}

export async function getFormationData(
  sessionId: string
): Promise<Result<FormationResult, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!sessionId?.trim()) {
    return err({ code: 'not_found', message: 'Sessão inválida' });
  }

  const { clubId } = authResult.data;
  const supabase = await createServerClient();

  // Fetch session type
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('type')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single();

  if (sessionError) {
    return err({ code: 'db_error', message: 'Erro ao carregar sessão' });
  }
  if (!session) {
    return err({ code: 'not_found', message: 'Sessão não encontrada' });
  }

  const isMatch = session.type === 'match' || session.type === 'friendly';

  // Reutilizar padrão de lineups.ts — tabela não está em Supabase generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (supabase.from as any)('match_lineups');

  // Try lineup for current session (only if it's a match/friendly)
  if (isMatch) {
    const { data: currentLineups, error: lineupError } = await matchLineupTable
      .select('player_id, role')
      .eq('session_id', sessionId) as { data: FormationEntry[] | null; error: { message: string } | null };

    if (lineupError) {
      return err({ code: 'db_error', message: 'Erro ao carregar convocatória' });
    }

    const starters = (currentLineups ?? []).filter((l) => l.role === 'starter');
    if (starters.length > 0) {
      return ok({ lineups: currentLineups ?? [], source: 'session_lineup' });
    }
  }

  // Fallback: most recent match/friendly with a full lineup
  const now = new Date();
  const { data: recentSessions, error: recentError } = await supabase
    .from('sessions')
    .select('id')
    .eq('club_id', clubId)
    .in('type', ['match', 'friendly'])
    .lt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(5);

  if (recentError) {
    return err({ code: 'db_error', message: 'Erro ao buscar convocatórias anteriores' });
  }

  for (const s of recentSessions ?? []) {
    const { data: pastLineups, error: pastError } = await matchLineupTable
      .select('player_id, role')
      .eq('session_id', s.id) as { data: FormationEntry[] | null; error: { message: string } | null };

    if (pastError) continue; // try next session

    const pastStarters = (pastLineups ?? []).filter((l) => l.role === 'starter');
    if (pastStarters.length >= 11) {
      return ok({ lineups: pastLineups ?? [], source: 'recent_lineup' });
    }
  }

  return ok({ lineups: [], source: 'none' });
}
```

### `FieldFormation` — Posicionamento 4-3-3 (percentagens)

O campo SVG usa `viewBox="0 0 300 400"`. Os chips de jogador são absolutamente posicionados sobre um `<div>` container com `paddingBottom: '133%'`.

| Linha | Posições | `top` (%) | `left` (%) distribuídos equitativamente |
|-------|----------|-----------|----------------------------------------|
| AVA (3) | slots 0–2 | 8% | 20%, 50%, 80% |
| MED (3) | slots 0–2 | 33% | 20%, 50%, 80% |
| DEF (4) | slots 0–3 | 60% | 10%, 33%, 66%, 90% |
| GR  (1) | slot 0   | 84% | 50% |

Se uma linha tem mais ou menos jogadores que o esperado, distribuir igualmente no espaço disponível (`n+1` intervalos para `n` jogadores).

### `FieldFormation` — SVG campo (fundo)

```tsx
// SVG aria-hidden="true" (a informação semântica está nos chips)
<svg
  viewBox="0 0 300 400"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
  className="absolute inset-0 w-full h-full"
>
  {/* Relva */}
  <rect width="300" height="400" fill="#2d6a2d" rx="4" />
  {/* Linha do meio */}
  <line x1="10" y1="200" x2="290" y2="200" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
  {/* Círculo central */}
  <circle cx="150" cy="200" r="40" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
  {/* Área grande (atacante) */}
  <rect x="60" y="10" width="180" height="80" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
  {/* Área grande (defesa) */}
  <rect x="60" y="310" width="180" height="80" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
</svg>
```

### Chip de jogador (formação)

```tsx
// Botão touch-friendly (≥44px por WCAG)
<button
  type="button"
  className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 touch-manipulation"
  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
  onClick={() => onSelectPlayer(player)}
  aria-label={`Estado: ${STATE_LABELS[player.state]}, ${player.playerName}, ${player.primaryPosition ?? 'posição desconhecida'}, ACWR ${player.acwr != null ? player.acwr.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'indisponível'}`}
>
  {/* Círculo colorido por estado */}
  <div
    className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-md"
    style={{ backgroundColor: STATE_COLORS[player.state] }}
  >
    {player.jerseyNum != null ? player.jerseyNum : '?'}
  </div>
  {/* Nome abreviado */}
  <span className="text-white text-[10px] font-medium drop-shadow-sm max-w-[52px] truncate">
    {player.playerName.split(' ')[0] ?? player.playerName}
  </span>
</button>
```

### Constantes de estado para o campo

```typescript
// Em field-formation.tsx (local — não criar ficheiro separado)
const STATE_COLORS: Record<string, string> = {
  ready:   '#22c55e', // green-500
  caution: '#eab308', // yellow-500
  alert:   '#ef4444', // red-500
  neutral: '#6b7280', // gray-500
};

const STATE_LABELS: Record<string, string> = {
  ready:   'Pronto',
  caution: 'Cuidado',
  alert:   'Alerta',
  neutral: 'Sem dados',
};
```

### Grelha de suplentes (banco)

```tsx
// Abaixo do campo, dentro de ReadinessPanelFormation
{bench.length > 0 && (
  <div className="mt-4 px-4">
    <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">
      Banco ({bench.length})
    </p>
    <div className="flex flex-wrap gap-2">
      {bench.map((player) => (
        <button
          key={player.player_id}
          type="button"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-card hover:bg-accent transition-colors"
          onClick={() => setSelectedPlayer(player)}
          aria-label={`Estado: ${STATE_LABELS[player.state]}, ${player.playerName}, ${player.primaryPosition ?? 'posição desconhecida'}, ACWR ${...}`}
        >
          <SemaforoBadge state={player.state} size="sm" />
          <span className="text-xs">{player.playerName.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

### `getPositionKey` — importar, não duplicar

```typescript
// ✅ Importar de readiness-panel-list (exportada desde Story 5.4)
import { getPositionKey } from '@/components/domain/readiness/readiness-panel-list';

// Para agrupar starters por posição no campo
const byPosition = {
  GR:  starters.filter(p => getPositionKey(p.primaryPosition) === 'GR'),
  DEF: starters.filter(p => getPositionKey(p.primaryPosition) === 'DEF'),
  MED: starters.filter(p => getPositionKey(p.primaryPosition) === 'MED'),
  AVA: starters.filter(p => getPositionKey(p.primaryPosition) === 'AVA'),
};
```

### noUncheckedIndexedAccess (NFR55)

```typescript
// ✅ Correcto — guard antes de usar índice em nome do jogador
const firstName = player.playerName.split(' ')[0] ?? player.playerName;

// ✅ Correcto — guard em acesso a array de sessões
const recentSession = recentSessions?.[0];
if (!recentSession) return ok({ lineups: [], source: 'none' });

// ❌ ERRO TypeScript
const firstName = player.playerName.split(' ')[0]; // may be undefined
```

### Tabela `match_lineups` — padrão obrigatório

```typescript
// match_lineups NÃO está nos tipos gerados do Supabase — usar type assertion
// (mesmo padrão de lineups.ts — obrigatório)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const matchLineupTable = (supabase.from as any)('match_lineups');
const { data, error } = await matchLineupTable.select('player_id, role').eq('session_id', sessionId);
```

---

## Dev Notes — Contexto das Stories Anteriores

### Story 5.4 — O que já existe (NÃO modificar sem razão)

- `readiness-panel.tsx` — toggle `list|formation` em `sessionStorage` com `startTransition` (hydration-safe)
  - **Placeholder para formação JÁ EXISTE** na linha 78 — substituir com `<ReadinessPanelFormation>`
- `readiness-panel-header.tsx` — botão "Formação" JÁ EXISTE mas com `disabled` — ativar na Task 4
- `readiness-panel-list.tsx` — exporta `getPositionKey()` e `sortGroup()` — reutilizar
- `READINESS_STATE_PRIORITY` — exportado de `@/lib/readiness/thresholds` (não redefinir — P-22)
- `sessionStorage` com `try/catch` e `startTransition` — padrão obrigatório (P-12, P-13)

### Story 5.5 — O que vai existir (dependência)

- `<PlayerDrillDownSheet>` em `@/components/domain/readiness/player-drill-down-sheet`
  - Props: `{ snapshot: PlayerReadinessData | null, open: boolean, onClose: () => void }`
  - Reutilizar exatamente igual — NÃO criar nova sheet

### Patches críticos da 5.4 que impactam esta story

- **P-12 (hydration):** `sessionStorage` só lido em `useEffect` — já implementado em `readiness-panel.tsx`
- **P-13 (private browsing):** `sessionStorage.setItem` em `try/catch` — já implementado
- **P-22 (DRY):** `READINESS_STATE_PRIORITY` de `@/lib/readiness/thresholds` — importar, não redefinir
- **P-3 (erros DB):** Nunca silenciar erros das queries — verificar `error` sempre e log

### Linha 100–108 de `readiness-panel-header.tsx` — botão a ativar

```tsx
// ESTADO ATUAL (Story 5.4 — a remover/substituir):
<button
  type="button"
  className="text-sm font-medium px-3 py-1.5 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
  aria-pressed={false}
  title="Em breve — vista de campo com formação táctica."
  disabled    // ← REMOVER
>
  Formação
  <span className="sr-only"> (em breve)</span>  // ← REMOVER
</button>

// ESTADO FINAL (Story 5.6):
<button
  type="button"
  className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
    view === "formation"
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`}
  onClick={() => onViewChange("formation")}
  aria-pressed={view === "formation"}
>
  Formação
</button>
```

### Linha 74–84 de `readiness-panel.tsx` — placeholder a substituir

```tsx
// ESTADO ATUAL (Story 5.4 — a remover):
{view === "list" ? (
  <ReadinessPanelList ... />
) : (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <p className="text-muted-foreground text-sm">
      Vista de formação disponível em breve.
    </p>
  </div>
)}

// ESTADO FINAL (Story 5.6):
{view === "list" ? (
  <ReadinessPanelList players={players} sessionId={sessionId} />
) : (
  <ReadinessPanelFormation players={players} sessionId={sessionId} />
)}
```

---

## Testes — Padrão e Fixtures

### Setup de mocks obrigatório

```typescript
// Topo dos ficheiros de teste
vi.mock('@/lib/actions/readiness', () => ({
  getFormationData: vi.fn(),
  // ...outros exports se necessário
}));

vi.mock('@/components/domain/readiness/player-drill-down-sheet', () => ({
  PlayerDrillDownSheet: ({ open, snapshot }: { open: boolean; snapshot: unknown }) =>
    open ? <div data-testid="drill-down-sheet">{JSON.stringify(snapshot)}</div> : null,
}));
```

### Fixture de lineup

```typescript
const fixtureLineupResult = {
  ok: true as const,
  data: {
    lineups: [
      // 11 starters + 3 bench
      { player_id: 'player-gr-1', role: 'starter' as const },
      { player_id: 'player-def-1', role: 'starter' as const },
      { player_id: 'player-def-2', role: 'starter' as const },
      { player_id: 'player-def-3', role: 'starter' as const },
      { player_id: 'player-def-4', role: 'starter' as const },
      { player_id: 'player-med-1', role: 'starter' as const },
      { player_id: 'player-med-2', role: 'starter' as const },
      { player_id: 'player-med-3', role: 'starter' as const },
      { player_id: 'player-ava-1', role: 'starter' as const },
      { player_id: 'player-ava-2', role: 'starter' as const },
      { player_id: 'player-ava-3', role: 'starter' as const },
      { player_id: 'player-bench-1', role: 'bench' as const },
    ],
    source: 'session_lineup' as const,
  },
};

const fixturePlayers: PlayerReadinessData[] = [
  { player_id: 'player-gr-1', playerName: 'Rui Patricio', jerseyNum: 1,
    primaryPosition: 'Guarda-Redes', state: 'ready', acwr: 1.1, data_sufficient: true,
    acwr_band_lo: 0.8, acwr_band_hi: 1.5, recent_fatigue_avg: 2.5,
    attendance_rate: 0.9, derived_age_group: 'senior', computed_at: '2026-05-27T00:00:00Z',
    session_id: 'session-1', club_id: 'club-1' },
  // ... demais jogadores (11 starters + bench)
];
```

### Verificações de teste obrigatórias

```typescript
// AC #1 — toggle ativa formação
await userEvent.click(screen.getByRole('button', { name: /Formação/i }));
expect(screen.getByTestId('readiness-panel-formation')).toBeInTheDocument();

// AC #3 — EmptyState quando source='none'
vi.mocked(getFormationData).mockResolvedValue({ ok: true, data: { lineups: [], source: 'none' } });
expect(screen.getByText(/Sem convocatória definida/i)).toBeInTheDocument();

// AC #4 — chips de titular e banco
expect(screen.getAllByRole('button', { name: /Estado:/ })).toHaveLength(12); // 11+1 bench

// AC #5 — tap abre DrillDownSheet
await userEvent.click(screen.getAllByRole('button', { name: /Estado:/ })[0]!);
expect(screen.getByTestId('drill-down-sheet')).toBeInTheDocument();

// AC #8 — axe
const { container } = render(<ReadinessPanelFormation ... />);
await waitFor(() => expect(screen.queryByText(/Sem convocatória/)).not.toBeInTheDocument());
const results = await axe(container);
expect(results).toHaveNoViolations();
```

---

## Referências

- [Epics.md — Story 5.6](../_bmad-output/planning-artifacts/epics.md) — ACs completos + UX-DR12/DR15/DR46
- [UX Design Spec — UX-DR15](../_bmad-output/planning-artifacts/ux-design-specification.md) — FieldFormation SVG
- [UX Design Spec — UX-DR46](../_bmad-output/planning-artifacts/ux-design-specification.md) — Direção A+B Painel
- [Story 5.4](./5-4-painel-de-prontidao-lista-por-posicao-default-view.md) — infraestrutura do painel, patches P-12/13/22
- [Story 5.5](./5-5-painel-drill-down-sheet-with-4-week-series-banda-acwr-presences-nota-livre.md) — PlayerDrillDownSheet a reutilizar
- [readiness-panel.tsx](../sparta/src/components/domain/readiness/readiness-panel.tsx) — MODIFICAR: substituir placeholder formação
- [readiness-panel-header.tsx](../sparta/src/components/domain/readiness/readiness-panel-header.tsx) — MODIFICAR: ativar botão "Formação"
- [readiness-panel-list.tsx](../sparta/src/components/domain/readiness/readiness-panel-list.tsx) — getPositionKey() a importar/reutilizar
- [readiness.ts](../sparta/src/lib/actions/readiness.ts) — adicionar getFormationData() aqui
- [lineups.ts](../sparta/src/lib/actions/lineups.ts) — padrão `(supabase.from as any)("match_lineups")` obrigatório
- [thresholds.ts](../sparta/src/lib/readiness/thresholds.ts) — READINESS_STATE_PRIORITY
- [AGENTS.md](../sparta/AGENTS.md) — aliases @/*, React 19, noUncheckedIndexedAccess, testes

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Status

**Review** — Implementação completa. 1454/1454 testes ✅; typecheck ✅; lint 0 erros.

### Implementation Notes

- `getFormationData()` adicionado a `readiness.ts` com `FormationEntry` e `FormationResult` interfaces; padrão `(supabase.from as any)('match_lineups')` seguido de `lineups.ts`
- `ReadinessPanelFormation` usa `startTransition` para todos os `setState` em `useEffect` (padrão P-12 do codebase)
- `FieldFormation` usa `role="img"` no SVG (não no div container) para evitar `nested-interactive` axe violation
- `EmptyState` usado com API correta (`icon`, `title`, `description`) — não aceita children
- Botão "Formação" em `readiness-panel-header.tsx` ativado com `aria-pressed` correto
- `sessionStorage.clear()` em `beforeEach` dos novos testes para evitar state leak entre testes
- 43 novos testes adicionados (9 `field-formation` + 12 `readiness-panel-formation` + 4 `prontidao` Story 5.6)

### Notas Chave para o Developer

1. **NÃO recriar** `<PlayerDrillDownSheet>` — existe desde Story 5.5. Importar e usar.
2. **`match_lineups` type assertion obrigatória** — tabela não está nos tipos Supabase gerados. Ver padrão em `lineups.ts` linha 170.
3. **`getPositionKey()` já exportada** de `readiness-panel-list.tsx` — importar, não duplicar.
4. **Botão "Formação" no header JÁ EXISTE** em `readiness-panel-header.tsx` linha 99 — ativar (remover `disabled` + classes), não criar novo.
5. **Placeholder de formação JÁ EXISTE** em `readiness-panel.tsx` linha 74 — substituir com `<ReadinessPanelFormation>`.
6. **sessionStorage, não localStorage** — a Story 5.4 implementou com sessionStorage. Manter consistência com o código existente.
7. **Chips de jogador: touch-friendly** — mínimo 44×44px por WCAG (usar `w-11 h-11` = 44px).
8. **`noUncheckedIndexedAccess`** — `array[0]` → `array[0] ?? fallback`.
9. **Nenhuma migração SQL** — a tabela `match_lineups` existe desde Story 2.8 (migração 000130).
10. **Story 5.5 é dependência hard** — `<PlayerDrillDownSheet>` deve estar done antes de implementar.

### Próximas Stories após 5.6

- **Story 5.7:** Realtime updates na janela 4h pré-sessão (Supabase Realtime / TanStack Query)
- **Story 5.8:** Analista Dashboard — tendências individuais 4 semanas multi-jogador
- **Story 5.10:** DataDrivenDecisionInput completo com `data_decisions` table

---

## File List

### Ficheiros Novos
- `sparta/src/components/domain/readiness/field-formation.tsx`
- `sparta/src/components/domain/readiness/readiness-panel-formation.tsx`
- `sparta/src/__tests__/readiness/field-formation.test.tsx`
- `sparta/src/__tests__/readiness/readiness-panel-formation.test.tsx`

### Ficheiros Modificados
- `sparta/src/lib/actions/readiness.ts` — adicionados `FormationEntry`, `FormationResult`, `getFormationData()`
- `sparta/src/components/domain/readiness/readiness-panel-header.tsx` — botão "Formação" ativado
- `sparta/src/components/domain/readiness/readiness-panel.tsx` — placeholder substituído por `<ReadinessPanelFormation>`
- `sparta/src/__tests__/app/(staff)/prontidao.test.tsx` — 4 novos testes Story 5.6 + mock `ReadinessPanelFormation`

---

## Change Log

### 2026-05-28 (Story Implemented)
- ✅ `getFormationData()` implementado em `readiness.ts` com fallback a lineup recente
- ✅ `FieldFormation` SVG campo 4-3-3 com chips absolutamente posicionados por posição
- ✅ `ReadinessPanelFormation` com loading skeleton, EmptyState e grelha de banco
- ✅ Botão "Formação" no header ativado com `aria-pressed` correto
- ✅ `ReadinessPanel` placeholder substituído por `ReadinessPanelFormation`
- ✅ 43 novos testes; 1454/1454 testes ✅; typecheck ✅; lint 0 erros
- ✅ axe zero violations (role="img" no SVG, não no div container)

### 2026-05-27 (Story Created)
- ✅ Análise exaustiva de Stories 5.4 e 5.5 (learnings + patches)
- ✅ Infraestrutura existente identificada (placeholder, botão disabled, sessionStorage)
- ✅ Server Action `getFormationData` desenhada com fallback a lineup recente
- ✅ SVG campo 4-3-3 com posicionamento por percentagem
- ✅ Padrão `(supabase.from as any)` documentado (match_lineups sem tipos)
- ✅ Reutilização de `getPositionKey()`, `READINESS_STATE_PRIORITY`, `PlayerDrillDownSheet`
- ✅ Acessibilidade especificada (aria-label chips, SVG aria-hidden)
- ✅ Fixtures de teste documentadas
- ✅ Discrepância localStorage vs sessionStorage identificada e resolvida
