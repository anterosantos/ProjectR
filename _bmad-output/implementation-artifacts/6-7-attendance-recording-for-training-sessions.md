# Story 6.7: Registo de Presenças em Sessões

Status: ready-for-dev

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

- [ ] **Task 1: Migração `000290_attendances.sql`** (AC: #1)
  - [ ] Criar `sparta/supabase/migrations/000290_attendances.sql`
  - [ ] Tabela `attendances` com todos os campos, constraint UNIQUE `(session_id, player_id)`
  - [ ] RLS: `"staff read" FOR SELECT` via `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach','analyst') AND club_id = attendances.club_id)`
  - [ ] RLS: `"staff write" FOR INSERT, UPDATE` com mesmo padrão EXISTS + `WITH CHECK`
  - [ ] Índices em `(session_id)`, `(player_id)`, `(club_id, session_id)`
  - [ ] `COMMENT ON TABLE attendances IS 'Presenças por sessão e jogador (FR30)'`

- [ ] **Task 2: Schema `src/lib/schemas/attendances.ts`** (AC: #4, #5) — SEM "use server"
  - [ ] Criar `sparta/src/lib/schemas/attendances.ts`
  - [ ] Definir constante e tipo:
    ```typescript
    export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'injured', 'excused'] as const
    export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
    ```
  - [ ] Schema Zod `UpsertAttendanceInputSchema`:
    ```typescript
    export const UpsertAttendanceInputSchema = z.object({
      id: z.string().uuid(),
      session_id: z.string().uuid(),
      player_id: z.string().uuid(),
      status: z.enum(ATTENDANCE_STATUSES),
      note: z.string().max(500).optional(),
    })
    export type UpsertAttendanceInput = z.infer<typeof UpsertAttendanceInputSchema>
    ```
  - [ ] Interface `AttendanceRecord`:
    ```typescript
    export interface AttendanceRecord {
      player_id: string
      status: AttendanceStatus
      note: string | null
      recorded_at: string
    }
    ```
  - [ ] Interface `PlayerForAttendance`:
    ```typescript
    export interface PlayerForAttendance {
      id: string
      full_name: string
      jersey_num: number
      primary_position: string | null
      is_active: boolean
    }
    ```
  - [ ] NÃO adicionar "use server" neste ficheiro — é um schema puro

- [ ] **Task 3: Server Actions `src/lib/actions/attendance.ts`** (AC: #2, #4, #6)
  - [ ] Criar `sparta/src/lib/actions/attendance.ts` com `"use server"` no topo
  - [ ] Implementar `getPlayersForAttendance(sessionId: string)`:
    - `requireStaffRole()` + `getServiceRoleClient()`
    - Query `players` com `.select('id, full_name, jersey_num, is_active, is_archived')` filtrado por `club_id`, `is_archived=false`
    - Query `positions` para `player_id, position, is_primary` filtrado por `player_ids` + `is_primary=true`
    - Mapear em `PlayerForAttendance[]` (incluindo inativos — a filtragem é feita no UI)
    - Ordenar por `full_name` dentro de cada grupo
    - Retornar `Result<PlayerForAttendance[], AppError>`
  - [ ] Implementar `getSessionAttendances(sessionId: string)`:
    - `requireStaffRole()` + `getServiceRoleClient()`
    - Query `attendances` filtrado por `session_id` + `club_id`
    - Retornar `Result<AttendanceRecord[], AppError>`
  - [ ] Implementar `upsertAttendance(input: unknown)`:
    - Validar com `UpsertAttendanceInputSchema.safeParse(input)`
    - `requireStaffRole()` + `getServiceRoleClient()`
    - Verificar que sessão existe e pertence ao clube: `serviceRole.from('sessions').select('id, club_id').eq('id', validated.data.session_id).eq('club_id', clubId).maybeSingle()`
    - Se sessão não encontrada: `return err({ code: 'not_found', message: 'Sessão não encontrada' })`
    - Upsert: `serviceRole.from('attendances').upsert({ ...validated.data, club_id: clubId, recorded_by: userId, recorded_at: new Date().toISOString() }, { onConflict: 'session_id,player_id', ignoreDuplicates: false })`
    - Fire-and-forget audit: `void logAccess('attendance.recorded', 'session', validated.data.session_id, { player_id: validated.data.player_id, status: validated.data.status })`
    - Fire-and-forget readiness refresh: `void refreshSnapshotForSession(serviceRole, validated.data.session_id).catch(...)`
    - Retornar `ok(undefined)`

- [ ] **Task 4: Registo do handler no outbox `drain.ts`** (AC: #5)
  - [ ] Em `sparta/src/lib/outbox/drain.ts`, dentro do bloco `try`, adicionar:
    ```typescript
    registerHandler('attendance.upsert', async (payload: unknown) => {
      const validated = UpsertAttendanceInputSchema.safeParse(payload)
      if (!validated.success) {
        const error = new Error(`Payload inválido: ${validated.error.message}`)
        ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
        throw error
      }
      const result = await upsertAttendance(validated.data)
      if (!result.ok) {
        const error = new Error(result.error?.message ?? 'Falha ao registar presença')
        ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
        throw error
      }
    })
    ```
  - [ ] Adicionar imports no topo de `drain.ts`:
    ```typescript
    import { UpsertAttendanceInputSchema } from '@/lib/schemas/attendances'
    import { upsertAttendance } from '@/lib/actions/attendance'
    ```

- [ ] **Task 5: Criar página `/sessoes/[id]/presencas/page.tsx`** (AC: #2, #6)
  - [ ] Server Component em `sparta/src/app/(staff)/sessoes/[id]/presencas/page.tsx`
  - [ ] Auth: staff only (coach/analyst) — mesmo padrão de `captura/page.tsx`:
    ```typescript
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/login')
    const { data: profile } = await supabase.from('profiles').select('role, club_id').eq('id', user.id).single()
    if (!profile || !profile.club_id || (profile.role !== 'coach' && profile.role !== 'analyst')) redirect('/login')
    ```
  - [ ] Verificar sessão existe e pertence ao clube:
    ```typescript
    const { data: session } = await supabase.from('sessions').select('id, club_id, type, scheduled_at').eq('id', sessionId).eq('club_id', profile.club_id).single()
    if (!session) redirect('/sessoes')
    ```
  - [ ] Fetch paralelo de jogadores e presenças existentes:
    ```typescript
    const [playersResult, attendancesResult] = await Promise.all([
      getPlayersForAttendance(sessionId),
      getSessionAttendances(sessionId),
    ])
    ```
  - [ ] Renderizar `<StickyHeader title="Presenças" backHref={`/sessoes/${sessionId}`} />`
  - [ ] Renderizar `<AttendancePanel players={players} existingAttendances={attendances} sessionId={sessionId} />`

- [ ] **Task 6: Criar Client Component `attendance-panel.tsx`** (AC: #2, #3, #4, #5, #6, #8)
  - [ ] Client Component em `sparta/src/app/(staff)/sessoes/[id]/presencas/attendance-panel.tsx`
  - [ ] Props:
    ```typescript
    interface AttendancePanelProps {
      players: PlayerForAttendance[]
      existingAttendances: AttendanceRecord[]
      sessionId: string
    }
    ```
  - [ ] Estado local:
    - `statuses: Map<string, AttendanceStatus>` — inicializar de `existingAttendances`; jogadores sem registo começam como `'present'`
    - `showInactive: boolean` — default `false`
    - `isSaving: boolean`
    - `pendingCount: number` — contagem do outbox
    - `error: string | null`
  - [ ] Ciclo de estados:
    ```typescript
    const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'late', 'injured', 'excused']
    function nextStatus(current: AttendanceStatus): AttendanceStatus {
      const idx = STATUS_CYCLE.indexOf(current)
      return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] ?? 'present'
    }
    ```
  - [ ] `handleToggle(playerId: string)`: `setStatuses(prev => new Map(prev).set(playerId, nextStatus(prev.get(playerId) ?? 'present')))`
  - [ ] `handleSave()`:
    - Se online (`navigator.onLine`): chamar `upsertAttendance` para cada jogador (apenas jogadores visíveis ou todos?) em paralelo com `Promise.all`
    - Se offline: `enqueueMutation('attendance.upsert', { id: newId(), session_id: sessionId, player_id, status })` para cada jogador
    - Toast "Presenças guardadas" em sucesso
  - [ ] Agrupamento por posição:
    ```typescript
    const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
    // Seguir mesmo padrão de convocatoria/page.tsx
    ```
  - [ ] Status badge visual com labels PT-PT:
    ```typescript
    const STATUS_LABEL: Record<AttendanceStatus, string> = {
      present: 'Presente', absent: 'Ausente', late: 'Atrasado', injured: 'Lesionado', excused: 'Justificado'
    }
    const STATUS_COLOR: Record<AttendanceStatus, string> = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      injured: 'bg-orange-100 text-orange-800',
      excused: 'bg-blue-100 text-blue-800',
    }
    ```
  - [ ] `<EmptyState>` quando `players.length === 0`: "Sem jogadores no plantel — adiciona em /plantel" (UX-DR8)
  - [ ] `<PendingBadge count={pendingCount} />` visível quando `pendingCount > 0`
  - [ ] Botão "Guardar presenças" com `aria-label="Guardar presenças da sessão"`, desactivado durante `isSaving`
  - [ ] Chip "Mostrar inativos" / "Ocultar inativos" toggle quando existem jogadores inativos
  - [ ] axe zero violations: usar `<ul>` semântico; botões com `aria-label` descritivos; badge com `aria-live="polite"`
  - [ ] `useOnlineStatus` hook para detecção offline (já existe em `@/hooks/useOnlineStatus`)

- [ ] **Task 7: Actualizar `session-detail-actions.tsx`** (AC: #7)
  - [ ] Em `sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx`, adicionar botão de Presenças:
    ```typescript
    import { ClipboardList } from 'lucide-react'
    // Dentro do JSX, mostrar para todos os tipos de sessão (training, match, friendly):
    <Button asChild variant="ghost" className="w-full justify-start gap-2">
      <Link href={`/sessoes/${sessionId}/presencas`}>
        <ClipboardList className="h-4 w-4" />
        Presenças
      </Link>
    </Button>
    ```
  - [ ] Mostrar para todos os tipos de sessão e qualquer estado (not just `isScheduled`) — o registo de presenças pode acontecer antes, durante ou após a sessão

- [ ] **Task 8: Testes** (AC: #8)
  - [ ] `sparta/src/__tests__/lib/actions/attendance.test.ts` (CRIAR):
    ```typescript
    vi.mock('@/lib/supabase/service-role', () => ({ getServiceRoleClient: vi.fn() }))
    vi.mock('@/lib/actions/auth', () => ({ requireStaffRole: vi.fn().mockResolvedValue({ ok: true, data: { userId: 'user-uuid', clubId: 'club-uuid' } }) }))
    vi.mock('@/lib/actions/audit', () => ({ logAccess: vi.fn().mockResolvedValue({ ok: true }) }))
    vi.mock('@/lib/readiness/snapshot', () => ({ refreshSnapshotForSession: vi.fn().mockResolvedValue(undefined) }))
    ```
    - `upsertAttendance`: happy path (status 'present'), idempotência (chamar 2x mesma sessão+jogador), sessão não encontrada → not_found, requireStaffRole falha → unauthorized, validação inválida (status inválido)
    - `getSessionAttendances`: happy path 3 registos, lista vazia, requireStaffRole falha
    - `getPlayersForAttendance`: happy path com activos e inativos, lista vazia
  - [ ] `sparta/src/__tests__/components/domain/attendance-panel.test.tsx` (CRIAR):
    - Toggle: present → absent → late → injured → excused → present (ciclo completo)
    - Save online: `upsertAttendance` chamado para cada jogador
    - Save offline: `enqueueMutation` chamado para cada jogador
    - "Mostrar inativos" toggle: jogadores inativos aparecem/desaparecem
    - EmptyState: quando `players=[]`
    - `<PendingBadge>` render quando `pendingCount > 0`

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
