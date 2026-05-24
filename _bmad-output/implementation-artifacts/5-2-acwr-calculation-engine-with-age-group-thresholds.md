# Story 5.2: ACWR Calculation Engine with Age-Group Thresholds

**Status:** ready-for-dev

**Story ID:** 5.2
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-24
**Story anterior:** 5-1-srpe-calculation-persistence-per-session

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que a Story 5.1 esteja **done** antes de começar.
> A Story 5.1 cria: `session_metrics` table com `srpe_load` (GENERATED STORED = srpe_value × duration_min).

---

## Story

As the system,
I want a deterministic ACWR computation per player (acute 7d ÷ chronic 28d) with age-group thresholds and a confidence band,
So that the Painel can classify players into ready/caution/alert with calibrated science instead of ad-hoc rules.

---

## Acceptance Criteria

### AC #1 — TypeScript: `lib/readiness/acwr.ts` com `computeAcwr()`

**Given** the spec (FR32)

**When** `computeAcwr(supabase, { playerId, asOf })` is called

**Then** it returns `{ acute, chronic, ratio, ageGroup, threshold, state, dataSufficient }` where:
- `acute` = `sum(srpe_load)` over sessions where `computed_at` is in `(asOf - 7 days, asOf]`
- `chronic` = `sum(srpe_load) / 4` over sessions where `computed_at` is in `(asOf - 28 days, asOf]` (rolling average weekly load)
- `ratio` = `acute / chronic` if `chronic > 0` else `null`
- `ageGroup` = value from `players.age_group` for `playerId`
- `threshold` = `{ lo: number, hi: number }` from the threshold table for that `ageGroup`
- `dataSufficient` = `true` if there are entries in `session_metrics` spanning **at least 4 distinct ISO weeks** in the 28-day window; `false` otherwise

**And** `state` is determined by:
- `'neutral'` if `dataSufficient = false`
- `'ready'` if `ratio >= threshold.lo AND ratio <= threshold.hi`
- `'caution'` if ratio outside band by ≤ 0.2 (i.e., `ratio > threshold.hi AND ratio <= threshold.hi + 0.2` OR `ratio < threshold.lo AND ratio >= threshold.lo - 0.2`)
- `'alert'` if ratio outside band by > 0.2 (i.e., `ratio > threshold.hi + 0.2` OR `ratio < threshold.lo - 0.2`)

**And** if `chronic = 0` and `dataSufficient = true`, `state = 'alert'` (high acute with zero chronic is the highest risk scenario)

---

### AC #2 — Tabela de Limiares por Escalão: `lib/readiness/thresholds.ts`

**Given** the threshold table (FR32)

**When** `getThreshold(ageGroup)` is called

**Then** it returns `{ lo, hi }` with these values:
- `u14`: `{ lo: 0.8, hi: 1.3 }`
- `u15`: `{ lo: 0.8, hi: 1.4 }`
- `u17`: `{ lo: 0.8, hi: 1.5 }`
- `u19`: `{ lo: 0.8, hi: 1.5 }`
- `senior`: `{ lo: 0.8, hi: 1.5 }`

**And** the table is a plain TypeScript `const` (not a function call, not runtime fetch)

**And** `computeAcwr` imports from this module — DRY principle, single source of truth for thresholds

---

### AC #3 — Migração `000245_acwr_function.sql`: PL/pgSQL Mirror

> ⚠️ **NOTA CRÍTICA:** O epics.md refere `000240_acwr_function.sql`, mas esse número **já está ocupado** por `000240_session_metrics.sql` (Story 5.1). Usar **`000245_acwr_function.sql`** obrigatoriamente.

**Given** migration `000245_acwr_function.sql`

**When** applied

**Then** PL/pgSQL function `compute_acwr(p_player_id uuid, p_as_of timestamptz)` exists

**And** it returns a row with `(acute numeric, chronic numeric, ratio numeric, age_group text, threshold_lo numeric, threshold_hi numeric, state text, data_sufficient boolean)`

**And** the logic is identical to the TypeScript implementation:
- Same 7-day / 28-day windows
- Same `data_sufficient` check (4 distinct ISO weeks)
- Same state classification (`neutral / ready / caution / alert`)
- Same threshold values per age group

**And** both the TypeScript function and the SQL function produce identical results on shared test fixtures (equivalence test in TypeScript, see AC #4)

---

### AC #4 — Cobertura de Testes ≥ 80%

**Given** unit tests in `src/lib/readiness/__tests__/acwr.test.ts`

**When** `npm run test --run` executes

**Then** coverage includes all boundary cases (NFR54):
- ✅ Player with 4+ weeks of data → `dataSufficient=true`, correct ratio + state
- ✅ Player with <4 weeks of data → `dataSufficient=false`, `state='neutral'`
- ✅ Player with `chronic=0` but entries in ≥4 weeks → `state='alert'`
- ✅ `ratio` within band → `state='ready'`
- ✅ `ratio` outside band by exactly 0.2 → `state='caution'`
- ✅ `ratio` outside band by exactly 0.2 + epsilon → `state='alert'`
- ✅ Age boundary: `u14` player has tighter band [0.8, 1.3] than `senior` [0.8, 1.5]
- ✅ Equivalence test: TypeScript `computeAcwrFromRawData()` and PL/pgSQL produce same state for same fixture data
- ✅ `getThreshold()` returns correct values for each age group

**And** coverage ≥ 80% em `src/lib/readiness/acwr.ts` e `src/lib/readiness/thresholds.ts`

---

### AC #5 — Performance (NFR5)

**Given** a club with 18 convocados and 4+ weeks of session history

**When** `computeAcwr()` is called for all 18 players (batch loop in a Server Action context)

**Then** the batch completes in ≤ 3 seconds (NFR5)

**And** the index `idx_session_metrics_player_computed` on `(player_id, computed_at DESC)` (created in Story 5.1) enables this

---

## Tasks / Subtasks

- [ ] **Task 1: Tabela de limiares `lib/readiness/thresholds.ts`** (AC: #2)
  - [ ] Criar `sparta/src/lib/readiness/thresholds.ts`
  - [ ] Exportar `ACWR_THRESHOLDS: Record<AgeGroup, { lo: number; hi: number }>`
  - [ ] Exportar `getThreshold(ageGroup: AgeGroup): { lo: number; hi: number }`
  - [ ] Exportar tipo `AgeGroup = 'u14' | 'u15' | 'u17' | 'u19' | 'senior'` (espelhar CHECK constraint em `players.age_group`)
  - [ ] Exportar tipo `AcwrState = 'ready' | 'caution' | 'alert' | 'neutral'`

- [ ] **Task 2: Função TypeScript `lib/readiness/acwr.ts`** (AC: #1)
  - [ ] Criar `sparta/src/lib/readiness/acwr.ts`
  - [ ] Exportar `computeAcwr(supabase: SupabaseClient, input: AcwrInput): Promise<AcwrResult>`
  - [ ] Exportar `computeAcwrFromRawData(input: AcwrRawInput): AcwrResult` — função pura sem DB (para testes de equivalência)
  - [ ] `AcwrInput = { playerId: string; asOf: Date }`
  - [ ] `AcwrResult = { acute: number; chronic: number; ratio: number | null; ageGroup: AgeGroup; threshold: { lo: number; hi: number }; state: AcwrState; dataSufficient: boolean }`
  - [ ] `computeAcwr` faz duas queries: (1) `players.age_group` para o `playerId`, (2) `session_metrics.srpe_load` para os últimos 28 dias
  - [ ] Usar `maybeSingle()` para query do jogador (padrão estabelecido)
  - [ ] Janela de tempo: `computed_at > (asOf - INTERVAL '28 days')` AND `computed_at <= asOf`
  - [ ] `acute` = sum de srpe_load onde `computed_at > (asOf - INTERVAL '7 days')`
  - [ ] `chronic` = sum de todo o srpe_load nos 28 dias / 4
  - [ ] `dataSufficient` = COUNT de ISO weeks distintas com pelo menos 1 entry ≥ 4
  - [ ] Lógica de classificação de estado em função pura separada `classifyAcwrState(ratio, threshold, dataSufficient)`

- [ ] **Task 3: Migração `000245_acwr_function.sql`** (AC: #3)
  - [ ] Criar `sparta/supabase/migrations/000245_acwr_function.sql`
  - [ ] PL/pgSQL function `compute_acwr(p_player_id uuid, p_as_of timestamptz)` RETURNS TABLE
  - [ ] SECURITY DEFINER com `search_path = public` (padrão segurança do projecto)
  - [ ] Lógica idêntica ao TypeScript: mesmas janelas, mesmo cálculo de data_sufficient (ISO weeks), mesmos limiares
  - [ ] Limiares embutidos como CASE expression em SQL (não tabela de lookup separada)
  - [ ] Sem dependências de tabelas novas — apenas `players` + `session_metrics`

- [ ] **Task 4: Testes** (AC: #4)
  - [ ] Criar `sparta/src/lib/readiness/__tests__/acwr.test.ts`
  - [ ] Testes com `vi.mock('@/lib/supabase/server')` para isolar DB queries
  - [ ] Fixtures partilhadas para teste de equivalência TypeScript ↔ SQL
  - [ ] Cobrir todos os boundary cases listados em AC #4
  - [ ] Teste de equivalência: `computeAcwrFromRawData()` com mesmos dados que a SQL function produziria

---

## Dev Notes

### ⚠️ Crítico: Número de Migração

O epics.md sugere `000240_acwr_function.sql`, mas **`000240` já existe** como `000240_session_metrics.sql` (criado em Story 5.1). Usar **`000245_acwr_function.sql`** sem excepção.

### Dependência Obrigatória: Story 5.1

Esta story lê da tabela `session_metrics.srpe_load` (coluna GENERATED STORED). A Story 5.1 deve estar **done** antes de implementar esta story. Especificamente:
- `sparta/supabase/migrations/000240_session_metrics.sql` deve existir e estar aplicada
- `sparta/src/lib/readiness/srpe.ts` já existe com `calculateSrpeLoad()` e `isSrpeInputValid()`

### Arquitectura da Função TypeScript

A separação entre função com DB e função pura é crítica para testabilidade:

```typescript
// lib/readiness/acwr.ts

// Função pura — testável sem DB (usada também no teste de equivalência SQL)
export function computeAcwrFromRawData(input: {
  loads: { srpe_load: number; computed_at: string }[];
  ageGroup: AgeGroup;
  asOf: Date;
}): AcwrResult { ... }

// Função com DB — orquestra fetch + computação
export async function computeAcwr(
  supabase: SupabaseClient,
  { playerId, asOf }: AcwrInput
): Promise<AcwrResult> {
  // 1. Fetch age_group do jogador
  const { data: player } = await supabase
    .from('players')
    .select('age_group')
    .eq('id', playerId)
    .maybeSingle();  // ← sempre maybeSingle() (padrão 4-8, 5-1)

  // 2. Fetch session_metrics dos últimos 28 dias
  const windowStart = new Date(asOf.getTime() - 28 * 24 * 60 * 60 * 1000);
  const { data: loads } = await supabase
    .from('session_metrics')
    .select('srpe_load, computed_at')
    .eq('player_id', playerId)
    .gt('computed_at', windowStart.toISOString())
    .lte('computed_at', asOf.toISOString())
    .order('computed_at', { ascending: false });

  // 3. Delegar para função pura
  return computeAcwrFromRawData({
    loads: loads ?? [],
    ageGroup: player?.age_group as AgeGroup ?? 'senior',
    asOf,
  });
}
```

### Fórmula ACWR Detalhada

```
acute  = sum(srpe_load) WHERE computed_at IN (asOf-7d, asOf]
chronic_total = sum(srpe_load) WHERE computed_at IN (asOf-28d, asOf]
chronic = chronic_total / 4   ← average weekly load (fixed divisor, NOT weeks with data)
ratio   = acute / chronic      ← null if chronic === 0
```

**Cuidado com `dataSufficient`:** Contar **ISO weeks distintas** no período de 28 dias que têm pelo menos 1 entrada:
```typescript
const distinctWeeks = new Set(
  loads.map(l => getISOWeek(new Date(l.computed_at)) + '-' + getISOWeekYear(new Date(l.computed_at)))
);
const dataSufficient = distinctWeeks.size >= 4;
```

Usar `date-fns` funções `getISOWeek(date)` e `getISOWeekYear(date)` — já instalado no projecto (ver Story 2.6).

### Lógica de Estado (Guardrail Anti-Erro)

```typescript
function classifyAcwrState(
  ratio: number | null,
  threshold: { lo: number; hi: number },
  dataSufficient: boolean
): AcwrState {
  if (!dataSufficient) return 'neutral';
  if (ratio === null) return 'alert'; // chronic=0 mas dataSufficient=true → alto risco
  if (ratio >= threshold.lo && ratio <= threshold.hi) return 'ready';
  const distance = ratio > threshold.hi
    ? ratio - threshold.hi
    : threshold.lo - ratio;
  if (distance <= 0.2) return 'caution';
  return 'alert';
}
```

> **Caso edge especial:** `chronic = 0` E `dataSufficient = true` → o jogador tem sessões registadas em ≥4 semanas mas sem sRPE (ou sRPE=0 improvável dado CHECK 1–10). Neste caso `ratio=null`. Classificar como `'alert'` para sinalizar ao treinador que faltam dados de carga.

### PL/pgSQL: Limiares como CASE Expression

Não criar tabela de lookup SQL separada — embutir os limiares como CASE:

```sql
threshold_lo := CASE age_group_val
  WHEN 'u14' THEN 0.8 WHEN 'u15' THEN 0.8
  WHEN 'u17' THEN 0.8 WHEN 'u19' THEN 0.8
  ELSE 0.8  -- senior
END;
threshold_hi := CASE age_group_val
  WHEN 'u14' THEN 1.3 WHEN 'u15' THEN 1.4
  ELSE 1.5  -- u17, u19, senior
END;
```

Janela ISO weeks em PL/pgSQL:
```sql
SELECT COUNT(DISTINCT EXTRACT(week FROM computed_at)) INTO distinct_weeks_count
FROM session_metrics
WHERE player_id = p_player_id
  AND computed_at > p_as_of - INTERVAL '28 days'
  AND computed_at <= p_as_of;
```

### Testes: Padrão de Mock

```typescript
// Sem imports React — funções puras não precisam de jsdom
// Testar computeAcwrFromRawData() directamente sem mock de DB

it('classifica ready quando ratio dentro da banda u14', () => {
  const result = computeAcwrFromRawData({
    loads: buildLoads({ weeks: 4, loadsPerWeek: [300, 300, 300, 300] }),
    ageGroup: 'u14',
    asOf: new Date('2026-05-24'),
  });
  expect(result.state).toBe('ready');
  expect(result.ratio).toBeCloseTo(1.0);
});
```

Para testes de `computeAcwr` (com DB):
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'players') return playerQueryChain;
      if (table === 'session_metrics') return loadsQueryChain;
    })
  }))
}));
```

### Ficheiros do Directório `lib/readiness/` Após Esta Story

```
sparta/src/lib/readiness/
├── .gitkeep                    ← existente (remover implicitamente com os novos ficheiros)
├── srpe.ts                     ← criado em Story 5.1
├── thresholds.ts               ← NOVO — esta story
├── acwr.ts                     ← NOVO — esta story
└── __tests__/
    ├── srpe.test.ts            ← criado em Story 5.1
    └── acwr.test.ts            ← NOVO — esta story
```

### Sem Server Actions / UI Nesta Story

Esta story é **exclusivamente** backend de cálculo:
- Nenhuma rota nova
- Nenhum Server Action novo
- Nenhum componente novo
- Apenas: biblioteca de cálculo TypeScript + SQL PL/pgSQL function + testes

O `computeAcwr()` será usado em Story 5.3 pelo `refreshUpcomingReadiness()` Server Action.

### Imports `date-fns` Necessários

```typescript
import { getISOWeek, getISOWeekYear } from 'date-fns';
```

`date-fns` já está instalado (Story 1.1, AR2). Não instalar novamente.

### Tipagem Estrita (NFR55)

Com `noUncheckedIndexedAccess: true`, garantir:
```typescript
// ✅ Correcto
const firstLoad = loads[0];
if (firstLoad !== undefined) { ... }

// ✅ Ou use optional chaining
const srpe = loads[0]?.srpe_load ?? 0;
```

Nunca `const srpe = loads[0].srpe_load` sem guard.

### Convenção de Nomenclatura

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Tipo de retorno | `AcwrResult` | interface em `acwr.ts` |
| Estado | `AcwrState` | `'ready' \| 'caution' \| 'alert' \| 'neutral'` |
| Age group | `AgeGroup` | exportado de `thresholds.ts` |
| SQL function | snake_case | `compute_acwr(p_player_id, p_as_of)` |
| TS function | camelCase | `computeAcwr`, `computeAcwrFromRawData` |

---

### Project Structure Notes

- `sparta/src/lib/readiness/` — já existe; adicionar `thresholds.ts`, `acwr.ts`, e `__tests__/acwr.test.ts`
- `sparta/supabase/migrations/` — próximo disponível: `000245`
- Sem modificações a ficheiros existentes (excepto potencialmente `sparta/src/types/supabase.ts` — NÃO necessário, pois `compute_acwr` é função, não tabela)
- Testes correm a partir de `sparta/` com `npm run test --run`
- Imports via alias `@/*` → `src/*` (obrigatório, ver `AGENTS.md`)

---

### References

- [Epics.md — Story 5.2](../_bmad-output/planning-artifacts/epics.md#L2374) — AC completos
- [Epics.md — FR32](../_bmad-output/planning-artifacts/epics.md#L75) — "ACWR (rácio carga aguda 7d / crónica 28d) por jogador com limiares por escalão"
- [NFR5](../_bmad-output/planning-artifacts/epics.md#L127) — "Recálculo ACWR para 18 convocados em ≤3s"
- [NFR54](../_bmad-output/planning-artifacts/epics.md#L194) — "Cobertura ≥80% nas funções críticas (ACWR, sRPE, ...)"
- [000070_players_positions.sql](../sparta/supabase/migrations/000070_players_positions.sql#L11) — `age_group CHECK ('u14','u15','u17','u19','senior')`
- [Story 5.1](./5-1-srpe-calculation-persistence-per-session.md) — `session_metrics` table (`srpe_load` GENERATED STORED)
- [Architecture.md — lib/readiness/](../_bmad-output/planning-artifacts/architecture.md#L932)
- [Architecture.md — cálculos server-side](../_bmad-output/planning-artifacts/architecture.md#L94) — "ACWR, sRPE, semáforo via vista materializada ou função SQL; cliente nunca calcula"
- [AGENTS.md](../sparta/AGENTS.md) — regras de path alias, noUncheckedIndexedAccess, testes

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
