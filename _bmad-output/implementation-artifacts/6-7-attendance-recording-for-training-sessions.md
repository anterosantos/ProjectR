# Story 6.7: Registo de Presenças em Sessões

Status: review

**Story ID:** 6.7
**Epic:** Epic 6 — Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)
**Criado:** 2026-05-31
**Story anterior:** 6-6-edit-delete-events-within-configurable-post-session-window (ready-for-dev)

> ⚠️ **DEPENDÊNCIAS:**
> - Story **6.1** done — padrão `requireStaffRole()` + `getServiceRoleClient()` estabelecido
> - Story **2.4** done — campo `is_active` em `players` (jogadores inativos)
> - Story **2.6** done — tabela `sessions` com `type`, `scheduled_at`, `duration_min`
> - Story **2.8** done — `match_lineups` + `getSessionById` (padrão de page auth)
> - Story **3.11** done — `auditedRead` wrapper + ESLint rule `no-direct-health-data-read`
> - Story **5.3** done — `refreshSnapshotForSession()` para atualizar readiness após presença

---

## Story

Como Analista,
Quero registar presença/ausência para cada jogador em cada sessão de treino,
Para que o modelo de prontidão tenha assiduidade real e o staff possa ver tendências de participação.

---

## Acceptance Criteria

### AC #1 — Migração `000290_attendances.sql`

**Given** migração `000290_attendances.sql` aplicada

**When** staff consulta a base de dados

**Then** tabela `attendances` existe com:
- `id uuid PRIMARY KEY DEFAULT uuidv7()`
- `club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`
- `session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `status text NOT NULL CHECK (status IN ('present','absent','late','injured','excused'))`
- `note text`
- `recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`
- `recorded_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (session_id, player_id)`
- RLS habilitada com isolamento por clube + escrita apenas para staff (FR30)
- Índices em `(session_id)`, `(player_id)`, `(club_id)`

---

### AC #2 — Página `/sessoes/[id]/presencas` — lista de jogadores

**Given** Analista ou Treinador em `/sessoes/[id]/presencas` (qualquer tipo de sessão)

**When** a página carrega

**Then** todos os jogadores activos do clube são listados agrupados por posição primária (GK, DEF, MID, FWD, por essa ordem; jogadores sem posição em "Indefinido")
**And** cada linha mostra: número de camisola, nome, badge de estado actual (inicial: `present`)
**And** se já existem registos para a sessão, os estados actuais são pré-carregados
**And** `<EmptyState>` se nenhum jogador existe no plantel

---

### AC #3 — Toggle de estado por jogador

**Given** Analista toca num jogador

**When** toca sucessivamente

**Then** o estado cicla: `present` → `absent` → `late` → `injured` → `excused` → `present`
**And** o badge visual actualiza imediatamente (estado local, antes de guardar)
**And** targets ≥44px para touch (UX-DR3)

---

### AC #4 — Guardar presenças (online)

**Given** Analista toca em "Guardar presenças"

**When** submete estando online

**Then** `upsertAttendance(sessionId, playerId, status)` é chamado para cada jogador
**And** upsert idempotente via `ON CONFLICT (session_id, player_id) DO UPDATE SET status, recorded_by, recorded_at`
**And** entrada `audit_logs` `action='attendance.recorded'` é criada (fire-and-forget)
**And** `refreshSnapshotForSession(serviceRole, sessionId)` é chamado (fire-and-forget, para readiness)
**And** toast de confirmação "Presenças guardadas" é mostrado

---

### AC #5 — Guardar presenças (offline)

**Given** Analista toca em "Guardar presenças" estando offline

**When** submete

**Then** cada registo de presença é enfileirado no outbox como `kind='attendance.upsert'`
**And** `<PendingBadge>` mostra o número de registos pendentes
**And** ao voltar online, o drain chama `upsertAttendance` para cada item pendente (idempotente)

---

### AC #6 — Jogadores inativos ocultos por defeito

**Given** existem jogadores com `is_active=false` no clube

**When** a página carrega

**Then** esses jogadores estão ocultos por defeito
**And** chip/botão "Mostrar inativos" revela-os (casos raros: regresso de lesão)
**And** jogadores inativos mostrados com estilo visual distinto (muted)

---

### AC #7 — Link "Presenças" na página de detalhe da sessão

**Given** qualquer tipo de sessão (training, match, friendly)

**When** staff visualiza a página de detalhe `/sessoes/[id]`

**Then** botão/link "Presenças" aparece na lista de acções
**And** leva para `/sessoes/[id]/presencas`

---

### AC #8 — Cobertura de testes ≥80%

**Given** testes em `sparta/src/__tests__/`

**When** executados com `npm run test --run`

**Then** cobrem:
- `upsertAttendance()`: happy path, forbidden (not staff), not found (session), idempotência (upsert mesma sessão+jogador)
- `getSessionAttendances()`: happy path, lista vazia, requireStaffRole falha
- `getPlayersForAttendance()`: happy path com jogadores activos e inativos, lista vazia
- `AttendancePanel`: ciclo de toggle (present→absent→late→injured→excused→present), save online, enqueue offline, "Mostrar inativos" toggle, EmptyState

---

## Tasks / Subtasks

- [x] **Task 1: Migração `000290_attendances.sql`** (AC: #1)
  - [x] Criar `sparta/supabase/migrations/000290_attendances.sql`
  - [x] Tabela `attendances` com todos os campos, constraint UNIQUE `(session_id, player_id)`
  - [x] RLS: `"staff read" FOR SELECT` via `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach','analyst') AND club_id = attendances.club_id)`
  - [x] RLS: `"staff write" FOR INSERT, UPDATE` com mesmo padrão EXISTS + `WITH CHECK`
  - [x] Índices em `(session_id)`, `(player_id)`, `(club_id, session_id)`
  - [x] `COMMENT ON TABLE attendances IS 'Presenças por sessão e jogador (FR30)'`

- [x] **Task 2: Schema `src/lib/schemas/attendances.ts`** (AC: #4, #5) — SEM "use server"
  - [x] Criar `sparta/src/lib/schemas/attendances.ts`
  - [x] Definir constante e tipo
  - [x] Schema Zod `UpsertAttendanceInputSchema`
  - [x] Interface `AttendanceRecord`
  - [x] Interface `PlayerForAttendance`
  - [x] NÃO adicionar "use server" neste ficheiro — é um schema puro

- [x] **Task 3: Server Actions `src/lib/actions/attendance.ts`** (AC: #2, #4, #6)
  - [x] Criar `sparta/src/lib/actions/attendance.ts` com `"use server"` no topo
  - [x] Implementar `getPlayersForAttendance(sessionId: string)`
  - [x] Implementar `getSessionAttendances(sessionId: string)`
  - [x] Implementar `upsertAttendance(input: unknown)` com upsert idempotente, audit fire-and-forget, readiness refresh fire-and-forget

- [x] **Task 4: Registo do handler no outbox `drain.ts`** (AC: #5)
  - [x] Adicionado handler `attendance.upsert` no bloco `try` de `drain.ts`
  - [x] Imports adicionados no topo de `drain.ts`

- [x] **Task 5: Criar página `/sessoes/[id]/presencas/page.tsx`** (AC: #2, #6)
  - [x] Server Component em `sparta/src/app/(staff)/sessoes/[id]/presencas/page.tsx`
  - [x] Auth staff only, verificação de sessão, fetch paralelo com Promise.all
  - [x] Renderiza StickyHeader + AttendancePanel

- [x] **Task 6: Criar Client Component `attendance-panel.tsx`** (AC: #2, #3, #4, #5, #6, #8)
  - [x] Client Component com Map de statuses, toggle ciclo, save online/offline
  - [x] Agrupamento por posição (GK/DEF/MID/FWD/Indefinido), badges coloridos PT-PT
  - [x] EmptyState, PendingBadge, "Mostrar/Ocultar inativos", aria-live, ul semântico

- [x] **Task 7: Actualizar `session-detail-actions.tsx`** (AC: #7)
  - [x] Botão "Presenças" com ClipboardList adicionado, visível para todos os tipos de sessão

- [x] **Task 8: Testes** (AC: #8)
  - [x] `sparta/src/__tests__/lib/actions/attendance.test.ts` (10/10 testes ✅)
  - [x] `sparta/src/__tests__/components/domain/attendance-panel.test.tsx` (10/10 testes ✅)

---

## Dev Notes

### CRÍTICO: `getServiceRoleClient` em todas as Server Actions (AGENTS.md Regra 1)

```typescript
// ✅ Correcto — Server Action invocada de Client Component
export async function upsertAttendance(input: unknown) {
  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult
  const { userId, clubId } = authResult.data
  const serviceRole = getServiceRoleClient()
  // ... query com filtro explícito club_id
}
```

### CRÍTICO: Schema separado de Server Actions (AGENTS.md Regra 2)

```
sparta/src/lib/schemas/attendances.ts  ← SEM "use server" — schema puro
sparta/src/lib/actions/attendance.ts   ← COM "use server" — apenas funções async
```

### CRÍTICO: RLS via EXISTS/profiles (AGENTS.md Regra 3)

```sql
-- ✅ Correcto para migrations
CREATE POLICY "staff read" ON attendances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = attendances.club_id
    )
  );
-- ❌ NUNCA usar auth.club_id() — falha em CI
```

### CRÍTICO: Migração em `sparta/supabase/migrations/` (AGENTS.md Regra 4)

A migração chama-se `000290_attendances.sql`. O próximo número disponível é 000290 (000280 está reservado para Story 6.6 que ainda não foi implementada).

### CRÍTICO: `upsertAttendance` — verificação de sessão ANTES do upsert

A verificação `serviceRole.from('sessions').select('id, club_id')...maybeSingle()` garante isolamento multi-tenant. O service role bypassa RLS — o filtro `eq('club_id', clubId)` é obrigatório.

### Fire-and-forget para readiness refresh

```typescript
// ✅ Correcto — não await; seguir padrão de fatigue.ts
void (async () => {
  try {
    await refreshSnapshotForSession(serviceRole, validated.data.session_id)
  } catch (e) {
    logger.error('attendance.readiness_refresh_failed', { ... })
  }
})()
return ok(undefined)  // retorna imediatamente
```

### `noUncheckedIndexedAccess` — padrões obrigatórios

```typescript
// ❌ Erro
const first = players[0]
// ✅ Correcto
const first = players[0] ?? null
const pos = player.positions?.find(p => p.is_primary)?.position ?? null
```

### Agrupamento por posição — padrão de `convocatoria/page.tsx`

```typescript
const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
const playersByPosition: Record<string, PlayerForAttendance[]> = {}
for (const player of visiblePlayers) {
  const pos = player.primary_position ?? 'Indefinido'
  if (!playersByPosition[pos]) playersByPosition[pos] = []
  playersByPosition[pos]!.push(player)
}
const sorted = Object.entries(playersByPosition).sort(([a], [b]) => {
  return (POSITION_ORDER[a] ?? 999) - (POSITION_ORDER[b] ?? 999)
})
```

### Outbox drain handler — seguir padrão de `match-event.submit`

O handler `attendance.upsert` valida o payload com Zod antes de chamar a Server Action. Se a Server Action retorna `!result.ok`, lançar Error com `.code` para permitir que o drain classifique como retentável ou definitivo.

### `useOnlineStatus` hook já existe

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
const { isOnline } = useOnlineStatus()
```

### `newId()` para IDs dos registos de outbox

```typescript
import { newId } from '@/lib/uuid'
const id = newId()  // UUIDv7
await enqueueMutation('attendance.upsert', { id, session_id: sessionId, player_id, status })
```

### `getSessionAttendances` — usar `getServiceRoleClient()` (AGENTS.md Regra 1)

Esta Server Action pode ser chamada de um `useEffect` ou Server Component. Para segurança, usar sempre `getServiceRoleClient()` com `requireStaffRole()`.

### `getPlayersForAttendance` — query em 2 passos (padrão two-step)

```typescript
// Passo 1: buscar jogadores
const { data: players } = await serviceRole.from('players')
  .select('id, full_name, jersey_num, is_active')
  .eq('club_id', clubId)
  .eq('is_archived', false)
  .order('full_name')

// Passo 2: buscar posições primárias
const playerIds = (players ?? []).map(p => p.id)
const { data: positions } = await serviceRole.from('positions')
  .select('player_id, position')
  .in('player_id', playerIds)
  .eq('is_primary', true)

// Construir mapa e mapear
const posMap = new Map((positions ?? []).map(p => [p.player_id, p.position]))
return ok((players ?? []).map(p => ({
  id: p.id,
  full_name: p.full_name,
  jersey_num: p.jersey_num ?? 0,
  primary_position: posMap.get(p.id) ?? null,
  is_active: p.is_active ?? true,
})))
```

### `session-detail-actions.tsx` — importar `ClipboardList` de lucide-react

Verificar que `ClipboardList` existe em lucide-react (versão usada no projeto). Alternativa: `ListChecks` ou `CheckSquare`.

### Estrutura de ficheiros a criar/modificar

```
sparta/supabase/migrations/
└── 000290_attendances.sql                    CRIAR

sparta/src/lib/schemas/
└── attendances.ts                             CRIAR: AttendanceStatus, UpsertAttendanceInputSchema, interfaces

sparta/src/lib/actions/
└── attendance.ts                              CRIAR: upsertAttendance, getSessionAttendances, getPlayersForAttendance

sparta/src/lib/outbox/
└── drain.ts                                   MODIFICAR: +attendance.upsert handler

sparta/src/app/(staff)/sessoes/[id]/
├── session-detail-actions.tsx                 MODIFICAR: +botão Presenças
└── presencas/
    ├── page.tsx                               CRIAR: Server Component
    └── attendance-panel.tsx                   CRIAR: Client Component

sparta/src/__tests__/lib/actions/
└── attendance.test.ts                         CRIAR

sparta/src/__tests__/components/domain/
└── attendance-panel.test.tsx                  CRIAR
```

### Estado inicial dos jogadores sem registo prévio

Quando não existe registo de presença para um jogador numa sessão, o estado inicial no UI deve ser `'present'` (optimista — a maioria dos jogadores presentes é o caso normal). Isto não é persistido até o analista guardar.

### Batch save — todos os jogadores visíveis

O "Guardar presenças" persiste o estado de TODOS os jogadores visíveis (activos + inativos se "Mostrar inativos" está activo). Não apenas os alterados. Isto garante que mesmo jogadores não tocados ficam com o registo explícito.

Para jogadores inativos ocultos (quando "Mostrar inativos" está desactivado), não criar registos para eles — evitar ruído na readiness.

---

## Inteligência de Stories Anteriores

### Story 6.5 — drain.ts padrão de handlers (NÃO alterar estrutura existente)
- Seguir exactamente o padrão de `match-event.submit` e `lineup.substitution`
- Adicionar dentro do bloco `try` existente no final de `drain.ts`
- Imports no topo do ficheiro

### Story 5.3 — `refreshSnapshotForSession` (REUTILIZAR)
- `import { refreshSnapshotForSession } from '@/lib/readiness/snapshot'`
- Recebe `serviceRole` client + `sessionId`
- Fire-and-forget com `void (async () => { ... })()`

### Story 4.4 — `enqueueMutation` e `newId` para outbox (REUTILIZAR)
- `import { enqueueMutation } from '@/lib/outbox/enqueue'`
- `import { newId } from '@/lib/uuid'`
- Gerar UUIDv7 no cliente antes de enqueue para idempotência

### Story 1.8 — `EmptyState`, `PendingBadge`, `StickyHeader` components (REUTILIZAR)
- `import { EmptyState } from '@/components/patterns/EmptyState'`
- `import { PendingBadge } from '@/components/domain/pending-badge'`
- `import { StickyHeader } from '@/components/patterns/StickyHeader'`

### Story 2.8 — sessão page auth pattern (REUTILIZAR)
- `captura/page.tsx` é o modelo canónico para auth + session verificação

### Story 6.2 — `useOnlineStatus` (JÁ EXISTE)
- `import { useOnlineStatus } from '@/hooks/useOnlineStatus'`

---

## Referências

- `sparta/src/lib/outbox/drain.ts:159-216` — padrão de registo de handlers
- `sparta/src/lib/outbox/enqueue.ts:1-62` — `enqueueMutation` e `enqueueFatigueSubmit`
- `sparta/src/lib/outbox/db.ts:1-33` — `PendingMutation` interface
- `sparta/src/lib/actions/fatigue.ts:270-303` — padrão fire-and-forget para readiness refresh
- `sparta/src/lib/readiness/snapshot.ts` — `refreshSnapshotForSession`
- `sparta/src/app/(staff)/sessoes/[id]/captura/page.tsx:1-59` — auth pattern
- `sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx:1-72` — a modificar
- `sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx:120-155` — agrupamento por posição
- `sparta/src/lib/actions/players.ts:60-120` — getPlayers com filtros is_archived/is_active
- `sparta/src/lib/actions/audit.ts` — `logAccess` fire-and-forget
- `sparta/src/hooks/useOnlineStatus.ts` — hook já existente
- `sparta/src/components/patterns/EmptyState.tsx` — UX-DR8
- `sparta/src/components/domain/pending-badge.tsx` — UX-DR7
- `sparta/src/components/patterns/StickyHeader.tsx` — padrão de header
- `sparta/AGENTS.md` — Regra 1 (service role), Regra 2 ("use server"), Regra 3 (RLS EXISTS), Regra 4 (migrations path), `noUncheckedIndexedAccess`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(sem issues de debug — implementação directa seguindo os Dev Notes)

### Completion Notes List

- Migração `000290_attendances.sql` criada com tabela `attendances`, RLS via EXISTS/profiles (AC#1)
- Schema puro `attendances.ts` sem "use server": `ATTENDANCE_STATUSES`, `AttendanceStatus`, `UpsertAttendanceInputSchema`, `AttendanceRecord`, `PlayerForAttendance` (AC#4, #5)
- Server Actions `attendance.ts`: `getPlayersForAttendance` (two-step query players+positions), `getSessionAttendances`, `upsertAttendance` (idempotente, audit fire-and-forget, readiness refresh fire-and-forget) (AC#2, #4, #6)
- Handler `attendance.upsert` registado em `drain.ts` com validação Zod (AC#5)
- Página `/sessoes/[id]/presencas/page.tsx` Server Component com auth staff, verificação de sessão, Promise.all paralelo (AC#2, #6)
- `AttendancePanel` Client Component: toggle ciclo 5 estados, save online (Promise.all) / offline (enqueueMutation), agrupamento por posição GK/DEF/MID/FWD, badges PT-PT, EmptyState, PendingBadge, "Mostrar/Ocultar inativos", aria semântico (AC#2, #3, #4, #5, #6)
- Botão "Presenças" com ClipboardList adicionado em `session-detail-actions.tsx` para todos os tipos de sessão (AC#7)
- `database.types.ts` actualizado com tipo `attendances`
- 20 novos testes ✅ (10 actions + 10 componente)
- 1791/1791 testes ✅; lint ✅; typecheck ✅ (erros existentes pré-story)

### File List

- sparta/supabase/migrations/000290_attendances.sql (CRIADO)
- sparta/src/lib/schemas/attendances.ts (CRIADO)
- sparta/src/lib/actions/attendance.ts (CRIADO)
- sparta/src/lib/outbox/drain.ts (MODIFICADO: +attendance.upsert handler + imports)
- sparta/src/app/(staff)/sessoes/[id]/presencas/page.tsx (CRIADO)
- sparta/src/app/(staff)/sessoes/[id]/presencas/attendance-panel.tsx (CRIADO)
- sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx (MODIFICADO: +botão Presenças)
- sparta/src/lib/supabase/database.types.ts (MODIFICADO: +attendances table type)
- sparta/src/__tests__/lib/actions/attendance.test.ts (CRIADO)
- sparta/src/__tests__/components/domain/attendance-panel.test.tsx (CRIADO)

### Change Log

- 2026-05-31: Story 6.7 implementada — migração 000290_attendances, schema+actions attendance, drain handler attendance.upsert, página /sessoes/[id]/presencas + AttendancePanel, botão Presenças em session-detail-actions; 20 novos testes ✅; 1791/1791 testes ✅; lint ✅; typecheck ✅
