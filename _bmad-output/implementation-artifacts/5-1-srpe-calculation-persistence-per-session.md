# Story 5.1: sRPE Calculation & Persistence per Session

**Status:** review

**Story ID:** 5.1
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-24
**Story anterior:** 4-8-pre-post-session-push-notifications-with-configurable-x-y

---

## Story

As the system,
I want to compute and persist `sRPE = Session-RPE × duration_min` per player per session immediately after the post-session questionnaire,
So that ACWR (Story 5.2) has a stable, queryable load input and historical aggregates are available in O(1).

---

## Acceptance Criteria

### AC #1 — Migração `000240_session_metrics.sql`

> ⚠️ **NOTA CRÍTICA:** O epics.md refere `000230_session_metrics.sql`, mas esse número **já está ocupado** por `000230_push_processing_lock.sql` (Story 4.8). Usar **`000240_session_metrics.sql`** obrigatoriamente.

**Given** migration `000240_session_metrics.sql`

**When** applied

**Then** table `session_metrics` exists:
- `id uuid NOT NULL DEFAULT uuidv7()` — PK
- `club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`
- `session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `srpe_value int NOT NULL CHECK (srpe_value BETWEEN 1 AND 10)`
- `duration_min int NOT NULL CHECK (duration_min BETWEEN 15 AND 240)`
- `srpe_load int GENERATED ALWAYS AS (srpe_value * duration_min) STORED`
- `computed_at timestamptz NOT NULL DEFAULT now()`

**And** RLS enabled with club isolation (coach/analyst of same club can SELECT; player cannot SELECT)

**And** staff reads go via `auditedRead()` (Story 3.11, FR50) — enforced at Server Action level, not just RLS

**And** unique constraint on `(session_id, player_id)` — one row per player per session

**And** index `idx_session_metrics_player_computed` on `(player_id, computed_at DESC)` for NFR1 (Painel ≤2s)

**And** index `idx_session_metrics_club` on `(club_id)` for multi-tenant scoping

---

### AC #2 — Upsert `session_metrics` na Submissão Pós-Sessão

**Given** a post-session fatigue submission with `srpe_value` non-null

**When** `submitFatigueResponse()` (Story 4.1, `src/lib/actions/fatigue.ts`) is called with `phase='post'` and `srpe_value` set

**Then** a `session_metrics` row is upserted immediately after the `fatigue_responses` upsert succeeds

**And** `duration_min` is fetched from `sessions.duration_min` for the `session_id` in the payload

**And** the upsert uses `ON CONFLICT (session_id, player_id) DO UPDATE SET srpe_value = EXCLUDED.srpe_value, duration_min = EXCLUDED.duration_min, computed_at = now()` (idempotent — resubmitting updates the value)

**And** the session_metrics upsert uses the `service-role` client (same pattern as fatigue_responses upsert)

**And** if the session lookup fails, log the error but do NOT fail the fatigue response upsert (non-blocking)

**And** `computed_at` is set to `now()` at upsert time

---

### AC #3 — sRPE Ausente → Sem Row em `session_metrics`

**Given** a post-session fatigue submission with `srpe_value` null or missing

**When** `submitFatigueResponse()` is called with `phase='post'` and `srpe_value` null

**Then** NO `session_metrics` row is created or updated

**And** ACWR (Story 5.2) treats the absence of a row as missing data, NOT as zero load

---

### AC #4 — Funções Utilitárias em `lib/readiness/srpe.ts`

**Given** `src/lib/readiness/srpe.ts` (o diretório `lib/readiness/` já existe com `.gitkeep`)

**When** the file is created

**Then** it exports:
- `calculateSrpeLoad(srpeValue: number, durationMin: number): number` — pura, testável, retorna `srpeValue * durationMin`
- `isSrpeInputValid(srpeValue: unknown, durationMin: unknown): boolean` — valida ranges (1–10 e 15–240)

**And** these functions are used by the Server Action (não duplicar cálculo inline)

---

### AC #5 — Cobertura de Testes ≥80%

**Given** unit tests in `src/lib/readiness/__tests__/srpe.test.ts` e integration tests em `src/lib/actions/__tests__/fatigue-srpe.test.ts`

**When** `npm run test --run` executes

**Then** coverage includes:
- ✅ `calculateSrpeLoad` computation (incluindo boundary: srpe=1, dur=15 → 15; srpe=10, dur=240 → 2400)
- ✅ `isSrpeInputValid` com valores fora de range
- ✅ Upsert idempotente: submeter com mesmo `(session_id, player_id)` duas vezes com srpe diferente → apenas 1 row, valor actualizado
- ✅ Caso missing sRPE (`srpe_value=null`) → nenhum row criado em `session_metrics`
- ✅ Lookup de `duration_min` da sessão antes do upsert
- ✅ `srpe_load = srpe_value * duration_min` gerado correctamente (verificado via query ao DB local ou mock)

**And** coverage ≥80% em `src/lib/readiness/srpe.ts` e na lógica de `session_metrics` em `fatigue.ts`

---

## Tasks / Subtasks

- [x] **Task 1: Migração `000240_session_metrics.sql`** (AC: #1)
  - [x] Criar `sparta/supabase/migrations/000240_session_metrics.sql`
  - [x] Tabela: `id`, `club_id`, `session_id`, `player_id`, `srpe_value` (1–10), `duration_min` (15–240), `srpe_load` (GENERATED STORED), `computed_at`
  - [x] RLS: staff (coach/analyst, mesmo clube) SELECT; player sem acesso directo; service-role full access
  - [x] Unique constraint: `(session_id, player_id)`
  - [x] Índices: `idx_session_metrics_player_computed` em `(player_id, computed_at DESC)`, `idx_session_metrics_club` em `(club_id)`
  - [x] GRANT `SELECT, INSERT, UPDATE` TO `authenticated` (service-role bypassa RLS)
  - [x] Comentários RGPD: tabela contém dados de esforço percebido (saúde, Art. 9)

- [x] **Task 2: Funções utilitárias `lib/readiness/srpe.ts`** (AC: #4)
  - [x] Criar `sparta/src/lib/readiness/srpe.ts`
  - [x] Exportar `calculateSrpeLoad(srpeValue, durationMin): number`
  - [x] Exportar `isSrpeInputValid(srpeValue, durationMin): boolean`
  - [x] Sem dependências externas — funções puras

- [x] **Task 3: Estender `submitFatigueResponse()` com upsert `session_metrics`** (AC: #2, #3)
  - [x] Editar `sparta/src/lib/actions/fatigue.ts`
  - [x] Após upsert bem-sucedido de `fatigue_responses`, verificar se `phase === 'post'` e `validated.data.srpe_value != null`
  - [x] Se sim: buscar `session.duration_min` via service-role (`sessions` table, by `session_id`)
  - [x] Upsert em `session_metrics` via service-role com `ON CONFLICT (session_id, player_id) DO UPDATE ...`
  - [x] Se `srpe_value` for null: skip completamente (nenhum upsert)
  - [x] Erros no upsert de `session_metrics` são logados mas NÃO propagados — `fatigue_responses` já foi gravada com sucesso
  - [x] Log estruturado: `session_metrics.upserted` ou `session_metrics.skipped_null_srpe` ou `session_metrics.upsert_failed`
  - [x] Usar `calculateSrpeLoad()` de `lib/readiness/srpe.ts` (não inline)

- [x] **Task 4: Actualizar tipos Supabase** (AC: #1)
  - [x] Adicionar tipo `SessionMetrics` em `sparta/src/lib/supabase/database.types.ts`
  - [x] Incluir campo `srpe_load` como `number` (generated column — omitido em Insert/Update)
  - [x] Relações com `clubs`, `sessions`, `players`

- [x] **Task 5: Testes** (AC: #5)
  - [x] Criar `sparta/src/lib/readiness/__tests__/srpe.test.ts` — testes unitários para funções puras
  - [x] Criar `sparta/src/lib/actions/__tests__/fatigue-srpe.test.ts` — testes de integração com mocks do service-role
  - [x] Cobrir: cálculo, upsert idempotente, caso null, lookup de duration_min, falha não-bloqueante

---

## Dev Notes

### ⚠️ Crítico: Número de Migração

O epics.md sugere `000230_session_metrics.sql`, mas **`000230` já existe** como `000230_push_processing_lock.sql` (criado em Story 4.8). Usar **`000240_session_metrics.sql`** sem excepção.

### Ficheiros a Modificar (UPDATE)

#### `sparta/src/lib/actions/fatigue.ts` — Estado Actual

O `submitFatigueResponse()` já:
- Valida via `FatigueResponseSchema` (Zod)
- Autentica o utilizador e faz lookup do jogador via `supabase.from('players')`
- Verifica `processing_restricted`
- Upserta em `fatigue_responses` via `serviceRole` com `onConflict: "id"`
- Grava audit log (fire-and-forget)

**O que esta story adiciona:**
```typescript
// Após o upsert bem-sucedido de fatigue_responses:
if (validated.data.phase === 'post' && validated.data.srpe_value != null) {
  // 1. Lookup duration_min da sessão
  const { data: session } = await serviceRole
    .from('sessions')
    .select('duration_min')
    .eq('id', validated.data.session_id)
    .maybeSingle();   // ← usar maybeSingle() (padrão 4-8)

  if (session) {
    // 2. Upsert session_metrics
    const { error: smError } = await serviceRole
      .from('session_metrics')
      .upsert(
        {
          club_id: player.club_id,
          session_id: validated.data.session_id,
          player_id: validated.data.player_id,
          srpe_value: validated.data.srpe_value,
          duration_min: session.duration_min,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,player_id', ignoreDuplicates: false }
      );
    // log error se existir, mas NÃO retornar err() — fatigue_response já foi gravada
  }
}
```

> **Padrão `maybeSingle()`** — Aprendizagem da Story 4.8: usar sempre `maybeSingle()` em queries que podem não ter resultados (não `.single()` que lança erro se não encontrar).

### Ficheiros Novos (CREATE)

| Ficheiro | Propósito |
|----------|-----------|
| `sparta/supabase/migrations/000240_session_metrics.sql` | Tabela + RLS + índices |
| `sparta/src/lib/readiness/srpe.ts` | Funções puras de cálculo |
| `sparta/src/lib/readiness/__tests__/srpe.test.ts` | Unit tests |
| `sparta/src/lib/actions/__tests__/fatigue-srpe.test.ts` | Integration tests |

### Directório `lib/readiness/`

Já existe em `sparta/src/lib/readiness/` (com `.gitkeep`). Este directório é descrito na arquitectura como "cálculos ACWR/sRPE (mirror cliente)". A Story 5.1 é a **primeira story** a popular este directório com código real.

### Coluna `srpe_load` — GENERATED STORED

A coluna `srpe_load` é uma **coluna gerada (GENERATED ALWAYS AS ... STORED)**. Isto significa:
- Não é necessário calcular `srpe_load` no código TypeScript antes do INSERT
- O PostgreSQL calcula automaticamente `srpe_value * duration_min`
- Ao fazer SELECT, `srpe_load` já vem calculado
- Ao fazer INSERT/UPDATE, **não incluir `srpe_load` no payload** (erro se incluíres)
- A função `calculateSrpeLoad()` em `lib/readiness/srpe.ts` serve para testes e para exibição client-side futura — não para o INSERT

### Padrão de RLS para `session_metrics`

Seguir o padrão estabelecido (e.g., `fatigue_responses`, `session_metrics`):
```sql
-- Staff lê (via auditedRead no Server Action)
CREATE POLICY "staff_reads_club" ON session_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = session_metrics.club_id
    )
  );

-- Só service-role faz INSERT/UPDATE (a política RLS para INSERT pode ser omitida
-- se apenas o service-role inserir, pois bypass de RLS)
```

> **Nota:** Leituras de staff passam sempre por `auditedRead()` (Story 3.11) ao nível do Server Action, independentemente da RLS. Nesta story apenas criamos a tabela — o `auditedRead` é relevante para Stories 5.3+ que lêem `session_metrics`.

### Erros Não-Bloqueantes

A gravação em `session_metrics` é **secundária** à gravação em `fatigue_responses`. Se o upsert de `session_metrics` falhar (e.g., sessão não encontrada, constraint violation):
- Log estruturado de erro: `session_metrics.upsert_failed`
- NÃO retornar `err()` — a resposta de fadiga já foi gravada com sucesso
- Padrão consistente com o audit log fire-and-forget já em `fatigue.ts`

### Testes: Padrão do Projecto

```typescript
// Padrão de mock do service-role (Story 4.1, 4.8)
vi.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { duration_min: 90 }, error: null })
        }))
      }))
    }))
  }))
}));
```

Usar `fake-indexeddb` NÃO é necessário nesta story (não há Dexie/IndexedDB). Usar mocks directos do service-role.

### Tipagem `supabase.ts`

O ficheiro `sparta/src/types/supabase.ts` tem tipos manuais (não auto-gerado neste projecto). Adicionar:
```typescript
export interface SessionMetrics {
  id: string;
  club_id: string;
  session_id: string;
  player_id: string;
  srpe_value: number;
  duration_min: number;
  srpe_load: number; // GENERATED STORED — leitura apenas
  computed_at: string;
}
```

### Performance (NFR1, NFR5)

- Index `(player_id, computed_at DESC)` garante queries rápidas para ACWR (Story 5.2)
- NFR5: "Recálculo de ACWR para grupo de 18 convocados em ≤3s" — este índice é o enabler
- NFR1: "Painel ≤2s para 40 jogadores" — depende desta tabela populada

### Dependências Futuras

Esta story desbloqueia:
- **Story 5.2:** ACWR usa `session_metrics.srpe_load` como input
- **Story 5.3:** `readiness_snapshots` agregam `session_metrics`
- **Epic 6, Story 6.8:** Analista regista Session-RPE por jogador (upsert directo em `session_metrics`)

---

### Project Structure Notes

- `sparta/supabase/migrations/` — naming: `YYYYMMDD_description.sql`; próximo número disponível: **000240**
- `sparta/src/lib/readiness/` — já existe, adicionar `srpe.ts` e `__tests__/`
- `sparta/src/lib/actions/fatigue.ts` — modificar (não recriar)
- `sparta/src/types/supabase.ts` — adicionar interface `SessionMetrics`
- Testes: correr a partir de `sparta/` com `npm run test --run`
- Imports via alias `@/*` → `src/*` (obrigatório, ver `AGENTS.md`)

---

### References

- [Epics.md — Story 5.1](../_bmad-output/planning-artifacts/epics.md) — AC completos da história
- [Architecture.md — session_metrics schema](../_bmad-output/planning-artifacts/architecture.md#L289)
- [Architecture.md — lib/readiness/](../_bmad-output/planning-artifacts/architecture.md#L932)
- [fatigue.ts — submitFatigueResponse](../sparta/src/lib/actions/fatigue.ts) — ficheiro a modificar
- [000200_fatigue_responses.sql](../sparta/supabase/migrations/000200_fatigue_responses.sql) — padrão de RLS/migração
- [000120_sessions.sql](../sparta/supabase/migrations/000120_sessions.sql) — `duration_min` column
- [AGENTS.md](../sparta/AGENTS.md) — regras de path alias, testes, noUncheckedIndexedAccess
- [Story 4.8 dev notes](./4-8-pre-post-session-push-notifications-with-configurable-x-y.md) — aprendizagens: `maybeSingle()`, padrões service-role
- [FR33](../_bmad-output/planning-artifacts/epics.md#L76) — "Sistema calcula sRPE (Session-RPE × duração) por sessão"
- [NFR1](../_bmad-output/planning-artifacts/epics.md#L123) — "Painel ≤2s para 40 jogadores"
- [NFR54](../_bmad-output/planning-artifacts/epics.md#L194) — "Cobertura ≥80% nas funções críticas (ACWR, sRPE, ...)"

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fix TS2345/TS2322: `validated.data.srpe_value` não narrowado dentro de closures async — solução: extrair para `const srpeValue` local antes do `if` + `void (async () => {})()`.

### Completion Notes List

- **Task 1 ✅** — Migração `000240_session_metrics.sql` criada com tabela `session_metrics` (id, club_id, session_id, player_id, srpe_value, duration_min, srpe_load GENERATED STORED, computed_at), RLS staff-only SELECT, unique constraint (session_id, player_id), índices de performance, GRANTs e comentários RGPD Art. 9.
- **Task 2 ✅** — `src/lib/readiness/srpe.ts` criado com `calculateSrpeLoad(srpeValue, durationMin): number` e `isSrpeInputValid(srpeValue, durationMin): boolean`. Funções puras sem dependências externas. Constantes `SRPE_VALUE_MIN/MAX` e `DURATION_MIN_MIN/MAX` exportadas.
- **Task 3 ✅** — `submitFatigueResponse()` em `fatigue.ts` extendido com upsert fire-and-forget de `session_metrics` pós-fatigue. Usa `maybeSingle()` para lookup da sessão (padrão Story 4.8), `calculateSrpeLoad()` da lib, ON CONFLICT idempotente, logs estruturados `session_metrics.upserted / skipped_null_srpe / upsert_failed / session_lookup_failed`. Erros não-bloqueantes.
- **Task 4 ✅** — `database.types.ts` actualizado com tabela `session_metrics` (Row/Insert/Update — srpe_load omitido em Insert/Update pois é GENERATED STORED) + Relationships para clubs, sessions, players.
- **Task 5 ✅** — 48 testes novos: 30 unit tests em `srpe.test.ts` (calculateSrpeLoad + isSrpeInputValid, boundaries, tipos inválidos, NaN, floats) + 18 integration tests em `fatigue-srpe.test.ts` (AC#2: upsert correcto, campos, ON CONFLICT, idempotência, logs; AC#3: null skip, fase pre; erros não-bloqueantes; srpe_load calculado). Todos passam ✅.
- **Testes completos:** 74/74 testes dos ficheiros da story + 1282/1285 testes globais (3 falhas pré-existentes não relacionadas). Typecheck ✅. Build ✅.

### File List

- `sparta/supabase/migrations/000240_session_metrics.sql` — CRIADO
- `sparta/src/lib/readiness/srpe.ts` — CRIADO
- `sparta/src/lib/readiness/__tests__/srpe.test.ts` — CRIADO
- `sparta/src/lib/actions/__tests__/fatigue-srpe.test.ts` — CRIADO
- `sparta/src/lib/actions/fatigue.ts` — MODIFICADO (import calculateSrpeLoad, upsert session_metrics fire-and-forget)
- `sparta/src/lib/supabase/database.types.ts` — MODIFICADO (tabela session_metrics adicionada)

### Change Log

- 2026-05-24: Story 5.1 implementada — migração 000240_session_metrics, srpe.ts (calculateSrpeLoad + isSrpeInputValid), fatigue.ts extendido com upsert fire-and-forget de session_metrics, database.types.ts actualizado, 48 novos testes; 74/74 ✅; typecheck ✅; build ✅; AC #1-#5 verificados.
