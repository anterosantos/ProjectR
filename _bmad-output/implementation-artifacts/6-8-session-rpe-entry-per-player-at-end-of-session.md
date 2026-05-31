# Story 6.8: Registo de Session-RPE por Jogador no Final da Sessão

Status: ready-for-dev

**Story ID:** 6.8
**Epic:** Epic 6 — Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)
**Criado:** 2026-05-31
**Story anterior:** 6-7-attendance-recording-for-training-sessions (ready-for-dev)

> ⚠️ **DEPENDÊNCIAS:**
> - Story **6.7** done — tabela `attendances` + `getSessionAttendances()` para saber quem está presente
> - Story **5.1** done — tabela `session_metrics` + `calculateSrpeLoad()` + `isSrpeInputValid()` em `lib/readiness/srpe.ts`
> - Story **5.3** done — `refreshSnapshotForSession()` para actualizar readiness após sRPE
> - Story **4.2** done — `<FatigueSlider>` em `src/components/ui/fatigue-slider.tsx` (suporta min/max props, escala 1–10)
> - Story **2.6** done — tabela `sessions` com `duration_min` (fonte da duração)
> - Story **3.11** done — `auditedRead()` wrapper (não aplicável aqui mas padrão de audit log de escrita)

> ℹ️ **SEM MIGRAÇÃO SQL** — a tabela `session_metrics` já existe (migration `000240_session_metrics.sql`,
> Story 5.1). O upsert analista reutiliza o mesmo `ON CONFLICT (session_id, player_id) DO UPDATE`.
> Migration mais recente: `000290_attendances.sql` (Story 6.7) → próxima disponível: `000300`.

---

## Story

Como Analista,
Quero registar Session-RPE por jogador no final de cada sessão, complementando ou substituindo o auto-relato do jogador,
Para que o modelo de carga esteja completo mesmo quando os jogadores não submetem o questionário pós-sessão.

---

## Acceptance Criteria

### AC #1 — Página `/sessoes/[id]/srpe` — lista de jogadores presentes

**Given** Analista ou Treinador em `/sessoes/[id]/srpe` (após o final da sessão)

**When** a página carrega

**Then** os jogadores presentes (Story 6.7) são listados com um slider 1–10 por jogador (`<FatigueSlider min=1 max=10>`, mesmo paradigma da Story 4.2)
**And** `duration_min` da sessão é mostrado no header (só leitura, definido na criação Story 2.6)
**And** se um jogador já submeteu sRPE pós-sessão via questionário (Story 4.2), o slider pré-carrega com esse valor com uma meta line "Submetido pelo jogador" — o analista pode substituir se necessário (FR31)
**And** se o analista já tinha registado sRPE anteriormente, o slider pré-carrega com esse valor (sem meta line)
**And** se existem ambos (jogador + analista), o valor analista prevalece em exibição (mas a meta line mantém-se)

---

### AC #2 — Submissão do formulário (online)

**Given** o Analista submete o formulário online

**When** toca em "Guardar sRPE"

**Then** para cada jogador com slider definido, `upsertSessionSrpe({ id, session_id, player_id, srpe_value, duration_min })` é chamado
**And** é feito um upsert em `session_metrics` via `ON CONFLICT (session_id, player_id) DO UPDATE SET srpe_value, duration_min, computed_at`
**And** a coluna `srpe_load` é computada automaticamente pela DB (GENERATED ALWAYS AS `srpe_value * duration_min`)
**And** entrada `audit_logs` `action='srpe.recorded'` com `payload: { source: 'analyst', srpe_value, duration_min, player_id }` é criada (fire-and-forget)
**And** `refreshSnapshotForSession(serviceRole, sessionId)` é chamado (fire-and-forget, para actualizar readiness/ACWR)
**And** toast "sRPE guardado" é mostrado

---

### AC #3 — Jogadores ausentes desactivados

**Given** um jogador com `status='absent'` em `attendances` para esta sessão

**When** a página renderiza

**Then** o slider está desactivado com label "Ausente — sem sRPE"
**And** nenhuma row é escrita em `session_metrics` para esse jogador

---

### AC #4 — Suporte offline

**Given** o Analista submete o formulário estando offline

**When** toca em "Guardar sRPE"

**Then** cada registo sRPE (apenas jogadores com valor definido e presentes) é enfileirado no outbox como `kind='srpe.upsert'` com payload `{ id, session_id, player_id, srpe_value, duration_min }`
**And** `<PendingBadge>` mostra o número de registos pendentes
**And** ao voltar online, o drain chama `upsertSessionSrpe` para cada item pendente (idempotente via UUIDv7)

---

### AC #5 — Fallback sem presenças registadas

**Given** a Story 6.7 ainda não foi executada para esta sessão (sem registos em `attendances`)

**When** a página carrega

**Then** todos os jogadores activos do clube são listados com slider habilitado (fallback gracioso)
**And** não existe distinção de presença

---

### AC #6 — Link "Registar sRPE" na página de detalhe da sessão

**Given** qualquer tipo de sessão (training, match, friendly)

**When** staff visualiza a página de detalhe `/sessoes/[id]`

**Then** botão/link "Registar sRPE" aparece na lista de acções
**And** leva para `/sessoes/${sessionId}/srpe`

---

### AC #7 — Cobertura de testes ≥80%

**Given** testes em `sparta/src/__tests__/`

**When** executados com `npm run test --run`

**Then** cobrem:
- `upsertSessionSrpe()`: happy path (override player value), idempotência (chamar 2x mesmo jogador+sessão), sessão não encontrada → not_found, requireStaffRole falha → unauthorized, isSrpeInputValid falha → erro, jogador ausente não escrito
- `getSessionSrpeData()`: happy path com presenças + valores jogador + valores analista, sem presenças (fallback), lista vazia
- `SrpePanel`: slider 1–10 por jogador, jogador ausente desactivado, pre-fill player value com meta line, save online (upsertSessionSrpe chamado para jogadores com valor), enqueue offline, EmptyState, PendingBadge

---

## Tasks / Subtasks

- [ ] **Task 1: Schema `src/lib/schemas/session-srpe.ts`** (AC: #2, #4) — SEM "use server"
  - [ ] Criar `sparta/src/lib/schemas/session-srpe.ts`
  - [ ] Schema Zod `UpsertSessionSrpeInputSchema`:
    ```typescript
    import { z } from 'zod'

    export const UpsertSessionSrpeInputSchema = z.object({
      id: z.string().uuid(),
      session_id: z.string().uuid(),
      player_id: z.string().uuid(),
      srpe_value: z.number().int().min(1).max(10),
      duration_min: z.number().int().min(15).max(240),
    })
    export type UpsertSessionSrpeInput = z.infer<typeof UpsertSessionSrpeInputSchema>
    ```
  - [ ] Interface `PlayerSrpeEntry`:
    ```typescript
    export interface PlayerSrpeEntry {
      player_id: string
      full_name: string
      jersey_num: number
      primary_position: string | null
      is_active: boolean
      attendance_status: 'present' | 'absent' | 'late' | 'injured' | 'excused' | null
      existing_analyst_srpe: number | null   // valor já registado pelo analista
      player_submitted_srpe: number | null   // valor self-reported pelo jogador
    }
    ```
  - [ ] NÃO adicionar "use server" neste ficheiro — é schema puro

- [ ] **Task 2: Server Actions `src/lib/actions/session-srpe.ts`** (AC: #1, #2, #3, #5)
  - [ ] Criar `sparta/src/lib/actions/session-srpe.ts` com `"use server"` no topo
  - [ ] Implementar `getSessionSrpeData(sessionId: string)`:
    - `requireStaffRole()` + `getServiceRoleClient()`
    - Buscar sessão: `serviceRole.from('sessions').select('id, club_id, duration_min, scheduled_at').eq('id', sessionId).eq('club_id', clubId).maybeSingle()`
    - Se sessão não encontrada: `return err({ code: 'not_found', message: 'Sessão não encontrada' })`
    - Fetch paralelo com `Promise.all`:
      ```typescript
      const [playersResult, attendancesResult, metricsResult, fatigueResult] = await Promise.all([
        // 1) Jogadores activos (two-step: players → positions)
        serviceRole.from('players').select('id, full_name, jersey_num, is_active').eq('club_id', clubId).eq('is_archived', false).order('full_name'),
        // 2) Presenças existentes para a sessão
        serviceRole.from('attendances').select('player_id, status').eq('session_id', sessionId).eq('club_id', clubId),
        // 3) session_metrics já existentes (valores do analista)
        serviceRole.from('session_metrics').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId),
        // 4) fatigue_responses pós-sessão com srpe_value (valores do jogador)
        serviceRole.from('fatigue_responses').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId).eq('phase', 'post').not('srpe_value', 'is', null),
      ])
      ```
    - Buscar posições primárias (two-step): `serviceRole.from('positions').select('player_id, position').in('player_id', playerIds).eq('is_primary', true)`
    - Construir mapas: `attendanceMap`, `metricsMap`, `fatigueMap`, `positionMap`
    - Mapear em `PlayerSrpeEntry[]`
    - Retornar `ok({ players: entries, duration_min: session.duration_min ?? 0 })`
  - [ ] Implementar `upsertSessionSrpe(input: unknown)`:
    - Validar com `UpsertSessionSrpeInputSchema.safeParse(input)`
    - `requireStaffRole()` + `getServiceRoleClient()`
    - Verificar sessão existe e pertence ao clube: `serviceRole.from('sessions').select('id, club_id, duration_min').eq('id', validated.data.session_id).eq('club_id', clubId).maybeSingle()`
    - Se sessão não encontrada: `return err({ code: 'not_found', message: 'Sessão não encontrada' })`
    - Verificar jogador pertence ao clube: `serviceRole.from('players').select('id, club_id').eq('id', validated.data.player_id).eq('club_id', clubId).maybeSingle()`
    - Se jogador não encontrado: `return err({ code: 'not_found', message: 'Jogador não encontrado' })`
    - Usar `duration_min` da sessão (não do payload — source of truth é a DB):
      ```typescript
      const durationMin = session.duration_min ?? validated.data.duration_min
      ```
    - Validar com `isSrpeInputValid(validated.data.srpe_value, durationMin)`
    - Upsert em `session_metrics`:
      ```typescript
      await serviceRole.from('session_metrics').upsert(
        {
          club_id: clubId,
          session_id: validated.data.session_id,
          player_id: validated.data.player_id,
          srpe_value: validated.data.srpe_value,
          duration_min: durationMin,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,player_id', ignoreDuplicates: false }
      )
      ```
    - Fire-and-forget audit log:
      ```typescript
      void (async () => {
        try {
          await serviceRole.from('audit_logs').insert({
            actor_id: userId,
            action: 'srpe.recorded',
            target_kind: 'session',
            target_id: validated.data.session_id,
            club_id: clubId,
            payload: {
              source: 'analyst',
              player_id: validated.data.player_id,
              srpe_value: validated.data.srpe_value,
              duration_min: durationMin,
            },
          })
        } catch (e) {
          logger.error('session_srpe.audit_log_failed', { error: e instanceof Error ? e.message : String(e) })
        }
      })()
      ```
    - Fire-and-forget readiness refresh:
      ```typescript
      void (async () => {
        try {
          await refreshSnapshotForSession(serviceRole, validated.data.session_id)
        } catch (e) {
          logger.error('session_srpe.readiness_refresh_failed', { error: e instanceof Error ? e.message : String(e) })
        }
      })()
      ```
    - Retornar `ok(undefined)`

- [ ] **Task 3: Registo do handler no outbox `drain.ts`** (AC: #4)
  - [ ] Em `sparta/src/lib/outbox/drain.ts`, dentro do bloco `try { ... }` existente, adicionar após os handlers actuais:
    ```typescript
    registerHandler('srpe.upsert', async (payload: unknown) => {
      const validated = UpsertSessionSrpeInputSchema.safeParse(payload)
      if (!validated.success) {
        const error = new Error(`Payload inválido: ${validated.error.message}`)
        ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
        throw error
      }
      const result = await upsertSessionSrpe(validated.data)
      if (!result.ok) {
        const error = new Error(result.error?.message ?? 'Falha ao registar sRPE')
        ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
        throw error
      }
    })
    ```
  - [ ] Adicionar imports no topo de `drain.ts`:
    ```typescript
    import { UpsertSessionSrpeInputSchema } from '@/lib/schemas/session-srpe'
    import { upsertSessionSrpe } from '@/lib/actions/session-srpe'
    ```

- [ ] **Task 4: Página `/sessoes/[id]/srpe/page.tsx`** (AC: #1, #5)
  - [ ] Server Component em `sparta/src/app/(staff)/sessoes/[id]/srpe/page.tsx`
  - [ ] Auth: staff only (coach/analyst) — padrão idêntico a `presencas/page.tsx`:
    ```typescript
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/login')
    const { data: profile } = await supabase.from('profiles').select('role, club_id').eq('id', user.id).single()
    if (!profile || !profile.club_id || (profile.role !== 'coach' && profile.role !== 'analyst')) redirect('/login')
    ```
  - [ ] Verificar sessão:
    ```typescript
    const { data: session } = await supabase.from('sessions').select('id, club_id, type, scheduled_at, duration_min').eq('id', sessionId).eq('club_id', profile.club_id).single()
    if (!session) redirect('/sessoes')
    ```
  - [ ] Buscar dados:
    ```typescript
    const dataResult = await getSessionSrpeData(sessionId)
    const { players, duration_min } = dataResult.ok ? dataResult.data : { players: [], duration_min: session.duration_min ?? 90 }
    ```
  - [ ] Renderizar:
    ```typescript
    <StickyHeader title="Registar sRPE" backHref={`/sessoes/${sessionId}`} />
    <p className="text-sm text-muted-foreground px-4 pt-2">Duração da sessão: <strong>{duration_min} min</strong></p>
    <SrpePanel players={players} sessionId={sessionId} durationMin={duration_min} />
    ```

- [ ] **Task 5: Client Component `srpe-panel.tsx`** (AC: #1, #2, #3, #4, #5)
  - [ ] Client Component em `sparta/src/app/(staff)/sessoes/[id]/srpe/srpe-panel.tsx`
  - [ ] Props:
    ```typescript
    interface SrpePanelProps {
      players: PlayerSrpeEntry[]
      sessionId: string
      durationMin: number
    }
    ```
  - [ ] Estado local:
    - `srpeValues: Map<string, number>` — inicializar: para cada player, prioridade: `existing_analyst_srpe ?? player_submitted_srpe ?? null` (null = não definido)
    - `isSaving: boolean`
    - `pendingCount: number` — do outbox via `useOutboxStatus`
    - `error: string | null`
  - [ ] Inicialização do Map:
    ```typescript
    const [srpeValues, setSrpeValues] = useState<Map<string, number>>(() => {
      const m = new Map<string, number>()
      for (const p of players) {
        const initial = p.existing_analyst_srpe ?? p.player_submitted_srpe
        if (initial != null) m.set(p.player_id, initial)
      }
      return m
    })
    ```
  - [ ] `handleSliderChange(playerId: string, value: number)`: `setSrpeValues(prev => new Map(prev).set(playerId, value))`
  - [ ] `handleSave()`:
    - Filtrar jogadores: apenas `players` com `attendance_status !== 'absent'` E que têm valor no Map
    - Para cada jogador com valor:
      ```typescript
      const id = newId()
      const payload = { id, session_id: sessionId, player_id: p.player_id, srpe_value: srpeValues.get(p.player_id)!, duration_min: durationMin }
      ```
    - Se online (`navigator.onLine`): `await upsertSessionSrpe(payload)` em paralelo com `Promise.all`
    - Se offline: `await enqueueMutation('srpe.upsert', payload)` para cada
    - Toast "sRPE guardado" em sucesso
  - [ ] Renderização de cada jogador:
    - Se `attendance_status === 'absent'`:
      ```tsx
      <div className="flex items-center gap-2 opacity-50">
        <span>#{p.jersey_num} {p.full_name}</span>
        <span className="text-xs text-muted-foreground">Ausente — sem sRPE</span>
        <FatigueSlider id={`srpe-${p.player_id}`} label="sRPE" minLabel="Muito fácil" maxLabel="Máximo" min={1} max={10} value={null} onChange={() => {}} disabled />
      </div>
      ```
    - Senão:
      ```tsx
      <div>
        <div className="flex items-center gap-2">
          <span>#{p.jersey_num ?? 0} {p.full_name}</span>
          {p.player_submitted_srpe != null && p.existing_analyst_srpe == null && (
            <span className="text-xs text-muted-foreground">Submetido pelo jogador</span>
          )}
        </div>
        <FatigueSlider
          id={`srpe-${p.player_id}`}
          label="sRPE"
          minLabel="Muito fácil"
          maxLabel="Máximo"
          min={1}
          max={10}
          value={srpeValues.get(p.player_id) ?? null}
          onChange={(v) => handleSliderChange(p.player_id, v)}
        />
      </div>
      ```
  - [ ] `<EmptyState>` quando `players.length === 0`: "Sem jogadores no plantel — adiciona em /plantel" (UX-DR8)
  - [ ] `<PendingBadge count={pendingCount} />` quando `pendingCount > 0`
  - [ ] Botão "Guardar sRPE" com `aria-label="Guardar sRPE da sessão"`, desactivado durante `isSaving`
  - [ ] Agrupamento por posição (mesmo padrão de `attendance-panel.tsx`):
    ```typescript
    const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
    ```
  - [ ] axe zero violations: `<ul>` semântico, cada row como `<li>`, sliders com `aria-label`

- [ ] **Task 6: Actualizar `session-detail-actions.tsx`** (AC: #6)
  - [ ] Em `sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx`, adicionar import:
    ```typescript
    import { Gauge } from 'lucide-react'
    ```
  - [ ] Adicionar botão (visível a todos os tipos de sessão e estados, para coach e analyst):
    ```tsx
    <Button asChild variant="ghost" className="w-full justify-start gap-2">
      <Link href={`/sessoes/${sessionId}/srpe`}>
        <Gauge className="h-4 w-4" />
        Registar sRPE
      </Link>
    </Button>
    ```
  - [ ] Posicionar após o botão de Presenças (Story 6.7) — ambos são acções de registo pós-sessão
  - [ ] Verificar que `Gauge` existe em lucide-react (alternativas: `BarChart2`, `ActivitySquare`)

- [ ] **Task 7: Testes** (AC: #7)
  - [ ] `sparta/src/__tests__/lib/actions/session-srpe.test.ts` (CRIAR):
    ```typescript
    vi.mock('@/lib/supabase/service-role', () => ({ getServiceRoleClient: vi.fn() }))
    vi.mock('@/lib/actions/auth', () => ({ requireStaffRole: vi.fn().mockResolvedValue({ ok: true, data: { userId: 'user-uuid', clubId: 'club-uuid' } }) }))
    vi.mock('@/lib/readiness/snapshot', () => ({ refreshSnapshotForSession: vi.fn().mockResolvedValue(undefined) }))
    vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }))
    ```
    - `upsertSessionSrpe`: happy path (novo valor), override (valor existente do jogador → analista sobrescreve), idempotência (2x mesmo jogador+sessão), sessão não encontrada → not_found, requireStaffRole falha → unauthorized, `isSrpeInputValid` falha (srpe=0) → erro, player não encontrado → not_found
    - `getSessionSrpeData`: happy path (presenças + valores jogador + valores analista), sem presenças (fallback todos activos), sessão não encontrada → not_found, lista vazia (sem jogadores)
  - [ ] `sparta/src/__tests__/components/domain/srpe-panel.test.tsx` (CRIAR):
    - Slider 1–10 renderizado por jogador presente
    - Jogador ausente: slider desactivado + "Ausente — sem sRPE"
    - Pre-fill: player_submitted_srpe aparece com meta "Submetido pelo jogador" se sem analyst override
    - Pre-fill: existing_analyst_srpe sem meta line
    - Save online: `upsertSessionSrpe` chamado apenas para jogadores com valor definido
    - Save offline: `enqueueMutation` chamado para cada jogador com valor
    - EmptyState quando `players=[]`
    - PendingBadge quando `pendingCount > 0`
    - `noUncheckedIndexedAccess`: usar `?? null` em todos os acessos indexados

---

## Dev Notes

### CRÍTICO: `getServiceRoleClient` em todas as Server Actions (AGENTS.md Regra 1)

```typescript
// ✅ Correcto
export async function upsertSessionSrpe(input: unknown) {
  const authResult = await requireStaffRole()
  if (!authResult.ok) return authResult
  const { userId, clubId } = authResult.data
  const serviceRole = getServiceRoleClient()
  // ... query com filtro explícito club_id
}
```

### CRÍTICO: Schema separado de Server Actions (AGENTS.md Regra 2)

```
sparta/src/lib/schemas/session-srpe.ts  ← SEM "use server" — schema puro
sparta/src/lib/actions/session-srpe.ts  ← COM "use server" — apenas funções async
```

### CRÍTICO: RLS via EXISTS/profiles (AGENTS.md Regra 3)

Não há nova migração nesta story — `session_metrics` já tem RLS de Story 5.1. O service role bypassa RLS, por isso os filtros explícitos `club_id` são obrigatórios em todas as queries.

### CRÍTICO: SEM nova migração SQL

A tabela `session_metrics` já existe desde `000240_session_metrics.sql` (Story 5.1). O upsert analista usa o mesmo conflito `(session_id, player_id)`. A coluna `srpe_load` é GENERATED ALWAYS AS — nunca passar no INSERT/UPDATE payload.

### `upsertSessionSrpe` — usar `duration_min` da sessão, não do payload

```typescript
// ✅ Correcto — DB é a source of truth para duration_min
const durationMin = session.duration_min ?? validated.data.duration_min

// ❌ Não confiar cegamente no payload do cliente
```

O `duration_min` no payload do cliente é o fallback para casos de edge (sessão sem duração definida), não o valor primário.

### `getSessionSrpeData` — fetch paralelo obrigatório

```typescript
const [playersRes, attendancesRes, metricsRes, fatigueRes] = await Promise.all([
  serviceRole.from('players').select('id, full_name, jersey_num, is_active').eq('club_id', clubId).eq('is_archived', false).order('full_name'),
  serviceRole.from('attendances').select('player_id, status').eq('session_id', sessionId).eq('club_id', clubId),
  serviceRole.from('session_metrics').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId),
  serviceRole.from('fatigue_responses').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId).eq('phase', 'post').not('srpe_value', 'is', null),
])
```

Não fazer fetches sequenciais — são todas queries independentes.

### Prioridade de pré-fill no SrpePanel

```typescript
// Ordem de prioridade decrescente
const initial = p.existing_analyst_srpe ?? p.player_submitted_srpe
if (initial != null) m.set(p.player_id, initial)

// Meta line "Submetido pelo jogador" só aparece se:
p.player_submitted_srpe != null && p.existing_analyst_srpe == null
```

O analista não vê "Submetido pelo jogador" se já tiver feito override anteriormente.

### `noUncheckedIndexedAccess` — padrões obrigatórios (AGENTS.md)

```typescript
// ❌ Erro de TypeScript
const player = players[0]

// ✅ Correcto
const player = players[0] ?? null

// ❌ Erro
srpeValues.get(p.player_id)  // pode ser undefined

// ✅ Correcto — mas só usar ! quando player está em Map por definição de fluxo
const value = srpeValues.get(p.player_id) ?? null
```

### Agrupamento por posição — padrão estabelecido

```typescript
const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
const playersByPosition: Record<string, PlayerSrpeEntry[]> = {}
for (const player of playersToShow) {
  const pos = player.primary_position ?? 'Indefinido'
  if (!playersByPosition[pos]) playersByPosition[pos] = []
  playersByPosition[pos]!.push(player)
}
const sorted = Object.entries(playersByPosition).sort(([a], [b]) =>
  (POSITION_ORDER[a] ?? 999) - (POSITION_ORDER[b] ?? 999)
)
```

### `FatigueSlider` — usar com escala 1–10 para sRPE

```tsx
// ✅ Correcto — reutilizar componente existente
<FatigueSlider
  id={`srpe-${player.player_id}`}
  label="sRPE"
  minLabel="Muito fácil"
  maxLabel="Máximo"
  min={1}
  max={10}
  value={srpeValues.get(player.player_id) ?? null}
  onChange={(v) => handleSliderChange(player.player_id, v)}
/>

// O getValueLabel já suporta escala 1-10 (retorna "muito fácil"/"fácil"/"moderado"/"difícil"/"máximo")
// NÃO criar um novo slider — reutilizar obrigatoriamente
```

### Drain handler — seguir padrão de `attendance.upsert`

```typescript
// Dentro do bloco try existente no final de drain.ts
registerHandler('srpe.upsert', async (payload: unknown) => {
  const validated = UpsertSessionSrpeInputSchema.safeParse(payload)
  if (!validated.success) {
    const error = new Error(`Payload inválido: ${validated.error.message}`)
    ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
    throw error
  }
  const result = await upsertSessionSrpe(validated.data)
  if (!result.ok) {
    const error = new Error(result.error?.message ?? 'Falha ao registar sRPE')
    ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
    throw error
  }
})
```

### Fire-and-forget para readiness refresh — padrão de `fatigue.ts`

```typescript
void (async () => {
  try {
    await refreshSnapshotForSession(serviceRole, validated.data.session_id)
  } catch (e) {
    logger.error('session_srpe.readiness_refresh_failed', {
      session_id: validated.data.session_id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
})()
```

### `isSrpeInputValid` já existe em `lib/readiness/srpe.ts`

```typescript
import { isSrpeInputValid, calculateSrpeLoad } from '@/lib/readiness/srpe'

// Usar ANTES do upsert (defesa em profundidade)
if (!isSrpeInputValid(validated.data.srpe_value, durationMin)) {
  return err({ code: 'validation', message: 'sRPE ou duração fora do intervalo válido' })
}
```

`calculateSrpeLoad` não é necessário na Server Action — a coluna `srpe_load` é GENERATED ALWAYS AS na DB. Mas pode ser usado para logging.

### `useOnlineStatus` hook já existe

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
const { isOnline } = useOnlineStatus()
```

### `newId()` para IDs dos registos de outbox

```typescript
import { newId } from '@/lib/uuid'
const id = newId()  // UUIDv7 — garantia de idempotência no drain
```

### `useOutboxStatus` para pendingCount

```typescript
import { useOutboxStatus } from '@/lib/outbox/status'
const { pendingCount } = useOutboxStatus()  // ou filtrado por kind='srpe.upsert'
```

### Ícone `Gauge` em lucide-react

Se `Gauge` não existir na versão do projeto, usar `BarChart2` como alternativa (verificar antes de usar). O ficheiro `session-detail-actions.tsx` já importa de `lucide-react` — adicionar ao import existente.

### Estrutura de ficheiros a criar/modificar

```
sparta/src/lib/schemas/
└── session-srpe.ts                            CRIAR: UpsertSessionSrpeInputSchema, PlayerSrpeEntry

sparta/src/lib/actions/
└── session-srpe.ts                            CRIAR: getSessionSrpeData, upsertSessionSrpe

sparta/src/lib/outbox/
└── drain.ts                                   MODIFICAR: +srpe.upsert handler + imports

sparta/src/app/(staff)/sessoes/[id]/
├── session-detail-actions.tsx                 MODIFICAR: +botão Registar sRPE
└── srpe/
    ├── page.tsx                               CRIAR: Server Component
    └── srpe-panel.tsx                         CRIAR: Client Component

sparta/src/__tests__/lib/actions/
└── session-srpe.test.ts                       CRIAR

sparta/src/__tests__/components/domain/
└── srpe-panel.test.tsx                        CRIAR
```

### Estado inicial do SrpePanel — jogadores sem presenças

Quando `attendances` está vazio (AC #5 fallback), todos os jogadores activos têm `attendance_status: null`. O slider deve estar habilitado (null não é 'absent'). Só `attendance_status === 'absent'` desactiva o slider.

### Save — apenas jogadores com valor definido

O "Guardar sRPE" apenas persiste jogadores que têm um valor no Map. Jogadores sem toque no slider (mesmo que presentes) não geram row em `session_metrics` — sem sRPE é informação válida (o modelo ACWR trata rows ausentes como dados em falta, não como carga zero).

---

## Inteligência de Stories Anteriores

### Story 6.7 — `attendance-panel.tsx` (MODELO CANÓNICO para este componente)
- Seguir exactamente o mesmo padrão de estado, handleSave, offline/online split, agrupamento por posição
- `drain.ts` handler pattern idêntico a `attendance.upsert`
- `session-detail-actions.tsx` adicionou "Presenças" — seguir o mesmo padrão para "Registar sRPE"

### Story 5.1 — `session_metrics` upsert (REUTILIZAR padrão de fatigue.ts)
- `isSrpeInputValid()` e `calculateSrpeLoad()` já em `lib/readiness/srpe.ts`
- Upsert: `onConflict: 'session_id,player_id'` — NÃO incluir `srpe_load` no payload (GENERATED column)
- Padrão fire-and-forget para `refreshSnapshotForSession`

### Story 4.2 — `<FatigueSlider>` (REUTILIZAR — não criar novo slider)
- `sparta/src/components/ui/fatigue-slider.tsx` já suporta `min=1 max=10`
- `getValueLabel(value, 10)` retorna labels correctos para escala sRPE
- Props: `id, label, minLabel, maxLabel, min, max, value, onChange, disabled`

### Story 4.4 — `enqueueMutation` e `newId` para outbox (REUTILIZAR)
- `import { enqueueMutation } from '@/lib/outbox/enqueue'`
- `import { newId } from '@/lib/uuid'`

### Story 1.8 — `EmptyState`, `PendingBadge`, `StickyHeader` (REUTILIZAR)
- `import { EmptyState } from '@/components/patterns/EmptyState'`
- `import { PendingBadge } from '@/components/domain/pending-badge'`

---

## Referências

- `sparta/src/lib/readiness/srpe.ts:1-79` — `isSrpeInputValid` + `calculateSrpeLoad` + `SRPE_VALUE_MIN/MAX`
- `sparta/src/lib/actions/fatigue.ts:144-297` — padrão de upsert `session_metrics` + fire-and-forget readiness refresh
- `sparta/src/components/ui/fatigue-slider.tsx:1-127` — `FatigueSlider` props completas + escala 1-10
- `sparta/src/lib/outbox/drain.ts` — padrão de registo de handlers no bloco try
- `sparta/src/lib/outbox/enqueue.ts` — `enqueueMutation`
- `sparta/src/lib/outbox/status.ts` — `useOutboxStatus`
- `sparta/src/lib/uuid.ts` — `newId()` UUIDv7
- `sparta/src/lib/actions/attendance.ts` — `getSessionAttendances`, `getPlayersForAttendance` (reutilizar para presença)
- `sparta/src/lib/schemas/attendances.ts` — modelo de schema puro (seguir mesmo padrão)
- `sparta/src/app/(staff)/sessoes/[id]/presencas/attendance-panel.tsx` — componente MODELO
- `sparta/src/app/(staff)/sessoes/[id]/presencas/page.tsx` — page auth pattern
- `sparta/src/app/(staff)/sessoes/[id]/session-detail-actions.tsx:1-72` — a modificar
- `sparta/src/app/(staff)/sessoes/[id]/convocatoria/page.tsx:120-155` — agrupamento por posição
- `sparta/src/hooks/useOnlineStatus.ts` — hook já existente
- `sparta/src/components/patterns/EmptyState.tsx` — UX-DR8
- `sparta/src/components/domain/pending-badge.tsx` — UX-DR7
- `sparta/AGENTS.md` — Regra 1 (service role), Regra 2 ("use server"), Regra 3 (RLS EXISTS), Regra 4 (migrations path), `noUncheckedIndexedAccess`

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
