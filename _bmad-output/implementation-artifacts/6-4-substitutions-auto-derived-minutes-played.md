# Story 6.4: Substituições & Minutos Jogados Auto-Derivados

**Status:** ready-for-dev

**Story ID:** 6.4
**Epic:** Epic 6 — Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)
**Criado:** 2026-05-30
**Story anterior:** 6-3-recent-events-ring-last-6-for-audit-on-the-go (ready-for-dev)

> ⚠️ **DEPENDÊNCIAS:**
> - Story **2.8** done — `match_lineups` tabela existe com colunas `started_minute`, `ended_minute`, `role`
> - Story **6.1** done — padrão `requireStaffRole()` + `getServiceRoleClient()` estabelecido em `events.ts`
> - Story **6.2** done — `/sessoes/[id]/captura`, `MatchEventCapture` header + `ZoneSelectorSheet` existem
> - Story **6.6** (janela de edição) é **backlog** — ajuste de minutos de substituição pós-sessão fica para 6.6

---

## Story

As an Analista,
I want to register substitutions during a match and have minutes-played derived automatically per player,
So that the post-match per-player minute totals are correct without any manual math.

---

## Acceptance Criteria

### AC #1 — Botão "Substituição" no header de `MatchEventCapture`

**Given** o Analista está em `/sessoes/[id]/captura`

**When** a página renderiza

**Then** o header contém um botão "Substituição" (com ícone lucide `ArrowLeftRight`)
**And** o botão fica sempre visível (não depende de player selecionado)
**And** ao tap, abre `<SubstitutionSheet>` (AC #2)
**And** toque alvo mínimo: `min-h-[44px] min-w-[44px]` (NFR40)

---

### AC #2 — `<SubstitutionSheet>` abre com minuto auto-preenchido

**Given** o Analista toca "Substituição"

**When** o sheet abre

**Then** é mostrado um `<DrillDownSheet>` (modal bottom-sheet) com:
- Minuto: campo numérico pré-preenchido com `Math.round((now - scheduled_at) / 60000)` clipped `[0, 120]`
- Coluna "Sai": lista de starters actualmente em campo (`role='starter'` E `ended_minute IS NULL`)
- Coluna "Entra": lista de jogadores no banco (`role='bench'`)
- Cada jogador mostra: nome abreviado + `#jersey`
- Botão "Confirmar Substituição" (primário, disabled até ambos selecionados)
- Botão "Cancelar" (ghost)
**And** zero animações (UX-DR3)
**And** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`

---

### AC #3 — Seleção de jogadores e validação

**Given** o sheet está aberto

**When** o Analista toca um jogador em "Sai" e um jogador em "Entra"

**Then** ambos ficam visualmente highlighted
**And** o botão "Confirmar Substituição" fica activo
**And** apenas um jogador pode ser selecionado por coluna de cada vez

**Given** a coluna "Sai" está vazia (todos os starters foram substituídos)

**When** o sheet renderiza

**Then** a coluna "Sai" mostra `<EmptyState>` com "Sem jogadores em campo"

**Given** a coluna "Entra" está vazia (banco vazio)

**When** o sheet renderiza

**Then** a coluna "Entra" mostra `<EmptyState>` com "Sem jogadores no banco"

---

### AC #4 — Confirmação regista substituição e actualiza lineup

**Given** ambos os jogadores estão selecionados e o Analista toca "Confirmar Substituição"

**When** `registerSubstitution(sessionId, outPlayerId, inPlayerId, minute)` é invocado

**Then** o `match_lineups` do jogador que **sai**:
- `ended_minute = minute`
- (role permanece 'starter')

**Then** o `match_lineups` do jogador que **entra**:
- `started_minute = minute`
- `role = 'starter'` (de 'bench')

**And** um `audit_logs` entry é criado: `action='lineup.substitution'`, `payload = { out_player_id, in_player_id, minute, session_id }`
**And** o sheet fecha
**And** a lista de "Sai"/"Entra" actualiza-se na próxima abertura

**Given** `registerSubstitution` retorna erro

**When** o erro ocorre

**Then** uma mensagem de erro é mostrada inline (sem fechar o sheet)

---

### AC #5 — "Encerrar registo de jogo" persiste minutos finais

**Given** o Analista toca "Encerrar registo" (botão no header/footer da página)

**When** `closeMatchRecord(sessionId)` é invocado

**Then** para todos os `match_lineups` com `session_id = sessionId` E `role = 'starter'` E `ended_minute IS NULL`:
- `ended_minute = session.duration_min`

**And** um `audit_logs` entry: `action='lineup.closed'`, `payload = { session_id, updated_count }`
**And** uma confirmação visual é mostrada ("Registo encerrado")

**Given** já foi encerrado anteriormente (nenhum row com `ended_minute IS NULL`)

**When** `closeMatchRecord` é invocado novamente

**Then** retorna sucesso sem erro (idempotente)

---

### AC #6 — View `match_minutes_played` deriva minutos automaticamente

**Given** migration `000275_match_minutes_played.sql`

**When** aplicada

**Then** view `match_minutes_played` existe com colunas:
- `session_id, player_id, duration_min, started_minute, ended_minute, minutes_played`
- `minutes_played = COALESCE(ended_minute, duration_min) - COALESCE(started_minute, 0)`

**And** a view só inclui jogadores com `role = 'starter'` (excluindo bench que nunca entrou)
**And** queries do Painel/dashboards usam esta view (não calcular inline)

---

### AC #7 — Cobertura de testes ≥80% (NFR54)

**Given** testes em `sparta/src/__tests__/`

**When** executados com `npm run test --run` (dentro de `sparta/`)

**Then** cobrem ≥80% das novas funções:
- `registerSubstitution`: happy path, out-player não encontrado, in-player não é bench, minuto fora de range
- `closeMatchRecord`: happy path, idempotente (sem rows a actualizar)
- `getMatchLineupForSubs`: retorna starters em campo + bench separados
- `<SubstitutionSheet>`: abre com minuto correcto, seleção dupla, confirm, cancel, erro
- Kickoff math: múltiplas subs, edge case on-then-off-then-on, `closeMatchRecord` com starters e bench

---

## Tasks / Subtasks

- [ ] **Task 1: Migration `000275_match_minutes_played.sql`** (AC: #6)
  - [ ] Criar `sparta/supabase/migrations/000275_match_minutes_played.sql`
  - [ ] `CREATE OR REPLACE VIEW match_minutes_played AS SELECT ... FROM match_lineups ml JOIN sessions s ON s.id = ml.session_id WHERE ml.role = 'starter'`
  - [ ] `minutes_played = COALESCE(ml.ended_minute, s.duration_min) - COALESCE(ml.started_minute, 0)`
  - [ ] Conceder `GRANT SELECT ON match_minutes_played TO authenticated`
  - [ ] Seguir naming convention `sparta/supabase/migrations/` (não raiz do repo)

- [ ] **Task 2: Server Actions em `substitutions.ts`** (AC: #4, #5)
  - [ ] Criar `sparta/src/lib/actions/substitutions.ts` com `"use server"`
  - [ ] `getMatchLineupForSubs(sessionId)` — retorna `{ starters: MatchLineupRow[], bench: MatchLineupRow[] }` (AC #2, #3)
    - [ ] `requireStaffRole()` + `getServiceRoleClient()` (regra obrigatória AGENTS.md)
    - [ ] Starters: `role='starter'` E `ended_minute IS NULL` (em campo agora)
    - [ ] Bench: `role='bench'`
    - [ ] Enrich com `players(full_name, jersey_num)` via cast `as any` (padrão `lineups.ts`)
  - [ ] `registerSubstitution(sessionId, outPlayerId, inPlayerId, minute)` (AC #4)
    - [ ] `requireStaffRole()` + `getServiceRoleClient()`
    - [ ] Validar: sessão pertence ao clube, `minute` em `[0, 120]`
    - [ ] Verificar `outPlayer` tem `role='starter'` e `ended_minute IS NULL`
    - [ ] Verificar `inPlayer` tem `role='bench'`
    - [ ] Verificar `outPlayer.processing_restricted !== true`
    - [ ] Update `outPlayer`: `ended_minute = minute`
    - [ ] Update `inPlayer`: `started_minute = minute`, `role = 'starter'`
    - [ ] `after(() => logAccess('lineup.substitution', 'session', sessionId, { out_player_id, in_player_id, minute }))` — fire-and-forget
    - [ ] Retorna `Result<void, AppError>`
  - [ ] `closeMatchRecord(sessionId)` (AC #5)
    - [ ] `requireStaffRole()` + `getServiceRoleClient()`
    - [ ] Obter `session.duration_min` para o `sessionId` do clube
    - [ ] Update todos `match_lineups` onde `session_id = sessionId AND role = 'starter' AND ended_minute IS NULL`: `ended_minute = duration_min`
    - [ ] `after(() => logAccess('lineup.closed', 'session', sessionId, { updated_count }))` — fire-and-forget
    - [ ] Retorna `Result<{ updated_count: number }, AppError>`

- [ ] **Task 3: `<SubstitutionSheet>` componente** (AC: #2, #3, #4)
  - [ ] Criar `sparta/src/components/domain/match-event-capture/substitution-sheet.tsx`
  - [ ] Props: `sessionId: string`, `scheduledAt: string` (ISO), `isOpen: boolean`, `onClose: () => void`
  - [ ] On open: `const autoMinute = Math.min(120, Math.max(0, Math.round((Date.now() - new Date(scheduledAt).getTime()) / 60000)))`
  - [ ] State: `selectedOut: string | null`, `selectedIn: string | null`, `minute: number`, `starters: MatchLineupRow[]`, `bench: MatchLineupRow[]`, `isSubmitting: boolean`, `error: string | null`
  - [ ] On open: chamar `getMatchLineupForSubs(sessionId)` para carregar listas
  - [ ] Layout: `role="dialog"` + `aria-modal="true"` + `aria-labelledby="sub-sheet-title"`
  - [ ] Campo de minuto: `<input type="number" min={0} max={120}>` pré-preenchido
  - [ ] Coluna "Sai": lista de starters (botões com `aria-pressed`)
  - [ ] Coluna "Entra": lista de bench (botões com `aria-pressed`)
  - [ ] "Confirmar" disabled até `selectedOut && selectedIn` — chama `registerSubstitution()`
  - [ ] "Cancelar" fecha sem chamar action
  - [ ] Zero `transition` ou `animation` classes (UX-DR3)
  - [ ] Erro inline sob o botão Confirmar

- [ ] **Task 4: Modificar `MatchEventCapture`** (AC: #1, #5)
  - [ ] Adicionar props: `scheduledAt: string`, `durationMin: number` a `MatchEventCaptureProps`
  - [ ] Adicionar estado local: `isSubSheetOpen: boolean`
  - [ ] No header: adicionar botão "Substituição" com ícone `ArrowLeftRight` (lucide)
    - Posição: ao lado do `PendingBadge`, sempre visível
    - `onClick={() => setIsSubSheetOpen(true)}`
    - `aria-label="Abrir registo de substituição"`
    - `min-h-[44px] min-w-[44px]`
  - [ ] No header: adicionar botão "Encerrar" com ícone `Flag` (lucide)
    - `onClick={() => handleCloseMatch()}`
    - Confirmação via `confirm()` ou `<Dialog>` simples antes de `closeMatchRecord()`
  - [ ] Adicionar `<SubstitutionSheet sessionId={sessionId} scheduledAt={scheduledAt} isOpen={isSubSheetOpen} onClose={() => setIsSubSheetOpen(false)} />`
  - [ ] `handleCloseMatch`: chama `closeMatchRecord(sessionId)`, mostra toast/mensagem de sucesso ou erro

- [ ] **Task 5: Modificar `MatchCapturePage`** (AC: #1, #2)
  - [ ] `sparta/src/app/(staff)/sessoes/[id]/captura/page.tsx`
  - [ ] Actualizar query: `sessions.select("id, club_id, type, scheduled_at, duration_min")`
  - [ ] Passar `scheduledAt={session.scheduled_at}` e `durationMin={session.duration_min}` a `<MatchEventCapture>`

- [ ] **Task 6: Testes** (AC: #7)
  - [ ] `sparta/src/__tests__/lib/actions/substitutions.test.ts`
    - [ ] `registerSubstitution` happy path
    - [ ] `registerSubstitution` out-player não está em campo (ended_minute já set)
    - [ ] `registerSubstitution` in-player não é bench
    - [ ] `registerSubstitution` minuto fora de [0,120]
    - [ ] `closeMatchRecord` happy path (atualiza N rows)
    - [ ] `closeMatchRecord` idempotente (0 rows a atualizar)
    - [ ] `getMatchLineupForSubs` retorna starters+bench separados
  - [ ] `sparta/src/__tests__/components/domain/match-event-capture/substitution-sheet.test.tsx`
    - [ ] Renderiza dois painéis Sai/Entra
    - [ ] Seleção de jogadores activa botão Confirmar
    - [ ] Cancelar fecha sem chamar `registerSubstitution`
    - [ ] Confirmar chama action com parâmetros correctos
    - [ ] Erro da action mostrado inline
    - [ ] Minuto auto-calculado (mock `Date.now()`)
    - [ ] Axe zero violations

---

## Dev Notes

### CRÍTICO: Padrão obrigatório para Server Actions (AGENTS.md Regra 1)

Toda a lógica em `substitutions.ts` DEVE usar `requireStaffRole()` + `getServiceRoleClient()`. A tabela `match_lineups` não tem tipos no `database.types.ts` — usar o padrão `(serviceRole.from as any)("match_lineups")` estabelecido em `lineups.ts:170` e `events.ts:72`.

```typescript
// sparta/src/lib/actions/substitutions.ts
"use server";

import { requireStaffRole } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { after } from "next/server";
import { logAccess } from "@/lib/actions/audit";

export async function registerSubstitution(
  sessionId: string,
  outPlayerId: string,
  inPlayerId: string,
  minute: number
): Promise<Result<void, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  // Validar minuto
  if (minute < 0 || minute > 120) {
    return err({ code: "validation", message: "Minuto deve estar entre 0 e 120." });
  }

  const serviceRole = getServiceRoleClient();

  // Verificar sessão pertence ao clube
  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, duration_min")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  // Verificar outPlayer: role='starter', ended_minute IS NULL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outRow } = await (serviceRole.from as any)("match_lineups")
    .select("id, role, ended_minute")
    .eq("session_id", sessionId)
    .eq("player_id", outPlayerId)
    .maybeSingle();

  if (!outRow || outRow.role !== "starter" || outRow.ended_minute !== null) {
    return err({ code: "validation", message: "Jogador que sai não está em campo." });
  }

  // Verificar inPlayer: role='bench'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inRow } = await (serviceRole.from as any)("match_lineups")
    .select("id, role")
    .eq("session_id", sessionId)
    .eq("player_id", inPlayerId)
    .maybeSingle();

  if (!inRow || inRow.role !== "bench") {
    return err({ code: "validation", message: "Jogador que entra não está no banco." });
  }

  // Update outPlayer: ended_minute
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: outError } = await (serviceRole.from as any)("match_lineups")
    .update({ ended_minute: minute })
    .eq("id", outRow.id);

  if (outError) return err({ code: "unknown", message: outError.message });

  // Update inPlayer: started_minute + role = 'starter'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: inError } = await (serviceRole.from as any)("match_lineups")
    .update({ started_minute: minute, role: "starter" })
    .eq("id", inRow.id);

  if (inError) return err({ code: "unknown", message: inError.message });

  // Audit log fire-and-forget
  after(() =>
    logAccess("lineup.substitution", "session", sessionId, {
      out_player_id: outPlayerId,
      in_player_id: inPlayerId,
      minute,
    })
  );

  return ok(undefined);
}
```

### Migration `000275_match_minutes_played.sql`

```sql
-- 000275_match_minutes_played.sql
-- Story 6.4: View derivada para minutos jogados por jogador por sessão
-- Lida por Painel, dashboards e story 6.8 (Session-RPE)
-- Apenas inclui jogadores que estiveram em campo (role='starter')
-- started_minute DEFAULT 0 (set no submitLineup para todos os jogadores)
-- ended_minute NULL = ainda em campo → usa duration_min no COALESCE

CREATE OR REPLACE VIEW match_minutes_played AS
SELECT
  ml.session_id,
  ml.player_id,
  s.duration_min,
  ml.started_minute,
  ml.ended_minute,
  COALESCE(ml.ended_minute, s.duration_min) - COALESCE(ml.started_minute, 0) AS minutes_played
FROM match_lineups ml
JOIN sessions s ON s.id = ml.session_id
WHERE ml.role = 'starter';

-- Bench que nunca entrou: excluídos pela WHERE clause
-- Jogador substituído: ended_minute set → minutes_played = ended_minute - started_minute
-- Starter até ao fim: ended_minute NULL → minutes_played = duration_min - 0

GRANT SELECT ON match_minutes_played TO authenticated;
GRANT SELECT ON match_minutes_played TO service_role;
```

### `getMatchLineupForSubs()` — Two-step para enrich com player data

```typescript
export interface SubstitutionLineupRow {
  lineup_id: string;
  player_id: string;
  name: string;
  jersey_number: number;
  started_minute: number;
  ended_minute: number | null;
}

export async function getMatchLineupForSubs(
  sessionId: string
): Promise<Result<{ starters: SubstitutionLineupRow[]; bench: SubstitutionLineupRow[] }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  // Verificar sessão pertence ao clube
  const { data: session } = await serviceRole
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  // Step 1: buscar todos match_lineups da sessão
  type LineupRaw = {
    id: string;
    player_id: string;
    role: string;
    shirt_num: number | null;
    started_minute: number;
    ended_minute: number | null;
    players: { full_name: string; jersey_num: number } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (serviceRole.from as any)("match_lineups")
    .select("id, player_id, role, shirt_num, started_minute, ended_minute, players(full_name, jersey_num)")
    .eq("session_id", sessionId) as { data: LineupRaw[] | null; error: { message: string } | null };

  if (error) return err({ code: "unknown", message: error.message });
  if (!rows) return ok({ starters: [], bench: [] });

  const toRow = (r: LineupRaw): SubstitutionLineupRow => ({
    lineup_id: r.id,
    player_id: r.player_id,
    name: r.players?.full_name ?? "—",
    jersey_number: r.shirt_num ?? r.players?.jersey_num ?? 0,
    started_minute: r.started_minute,
    ended_minute: r.ended_minute,
  });

  // Starters em campo = role='starter' AND ended_minute IS NULL
  const starters = rows
    .filter((r) => r.role === "starter" && r.ended_minute === null)
    .map(toRow);

  // Banco = role='bench'
  const bench = rows
    .filter((r) => r.role === "bench")
    .map(toRow);

  return ok({ starters, bench });
}
```

### `closeMatchRecord()` — Encerrar registo

```typescript
export async function closeMatchRecord(
  sessionId: string
): Promise<Result<{ updated_count: number }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, duration_min")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  // Update starters sem ended_minute
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (serviceRole.from as any)("match_lineups")
    .update({ ended_minute: session.duration_min })
    .eq("session_id", sessionId)
    .eq("role", "starter")
    .is("ended_minute", null)
    .select("id") as { data: { id: string }[] | null; error: { message: string } | null };

  if (error) return err({ code: "unknown", message: error.message });

  const updated_count = updated?.length ?? 0;

  after(() =>
    logAccess("lineup.closed", "session", sessionId, { updated_count })
  );

  return ok({ updated_count });
}
```

### Cálculo de minuto auto-preenchido — `SubstitutionSheet`

```typescript
// sparta/src/components/domain/match-event-capture/substitution-sheet.tsx
const autoMinute = useMemo(() => {
  const elapsed = Date.now() - new Date(scheduledAt).getTime();
  const minutes = Math.round(elapsed / 60_000);
  return Math.min(120, Math.max(0, minutes));
}, []); // calculado apenas no mount (isOpen muda)
```

**Nota:** O campo de minuto é editável — o Analista pode corrigir se o relógio do dispositivo estiver ligeiramente desfasado.

### Estrutura do `<SubstitutionSheet>`

```tsx
// sparta/src/components/domain/match-event-capture/substitution-sheet.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getMatchLineupForSubs, registerSubstitution } from "@/lib/actions/substitutions";
import type { SubstitutionLineupRow } from "@/lib/actions/substitutions";
import { EmptyState } from "@/components/domain/empty-state";

interface SubstitutionSheetProps {
  sessionId: string;
  scheduledAt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SubstitutionSheet({ sessionId, scheduledAt, isOpen, onClose }: SubstitutionSheetProps) {
  const [starters, setStarters] = useState<SubstitutionLineupRow[]>([]);
  const [bench, setBench] = useState<SubstitutionLineupRow[]>([]);
  const [selectedOut, setSelectedOut] = useState<string | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoMinute = useMemo(() => {
    const elapsed = Date.now() - new Date(scheduledAt).getTime();
    return Math.min(120, Math.max(0, Math.round(elapsed / 60_000)));
  }, [scheduledAt]);

  useEffect(() => {
    if (!isOpen) return;
    setMinute(autoMinute);
    setSelectedOut(null);
    setSelectedIn(null);
    setError(null);
    getMatchLineupForSubs(sessionId).then((res) => {
      if (res.ok) {
        setStarters(res.data.starters);
        setBench(res.data.bench);
      }
    });
  }, [isOpen, sessionId, autoMinute]);

  const handleConfirm = async () => {
    if (!selectedOut || !selectedIn || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const result = await registerSubstitution(sessionId, selectedOut, selectedIn, minute);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-labelledby="sub-sheet-title">
      <div className="absolute inset-0 bg-black/50" onClick={() => !isSubmitting && onClose()} />
      <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto">
        <h2 id="sub-sheet-title" className="text-lg font-semibold mb-4">Substituição</h2>

        {/* Minuto */}
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="sub-minute" className="text-sm font-medium">Minuto</label>
          <input
            id="sub-minute"
            type="number"
            min={0}
            max={120}
            value={minute}
            onChange={(e) => setMinute(Math.min(120, Math.max(0, Number(e.target.value))))}
            className="w-20 border rounded-md px-2 py-1 text-sm text-center"
          />
        </div>

        {/* Duas colunas */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Sai */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">SAI</p>
            {starters.length === 0 ? (
              <EmptyState title="Sem jogadores em campo" />
            ) : (
              starters.map((p) => (
                <button
                  key={p.player_id}
                  onClick={() => setSelectedOut(p.player_id)}
                  aria-pressed={selectedOut === p.player_id}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm min-h-[44px] ${
                    selectedOut === p.player_id
                      ? "bg-red-100 dark:bg-red-900/30 border border-red-400"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  #{p.jersey_number} {p.name}
                </button>
              ))
            )}
          </div>

          {/* Entra */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">ENTRA</p>
            {bench.length === 0 ? (
              <EmptyState title="Sem jogadores no banco" />
            ) : (
              bench.map((p) => (
                <button
                  key={p.player_id}
                  onClick={() => setSelectedIn(p.player_id)}
                  aria-pressed={selectedIn === p.player_id}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm min-h-[44px] ${
                    selectedIn === p.player_id
                      ? "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-400"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  #{p.jersey_number} {p.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!selectedOut || !selectedIn || isSubmitting}
            className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md py-2 text-sm font-medium disabled:opacity-50"
          >
            {isSubmitting ? "A registar..." : "Confirmar Substituição"}
          </button>
          <button
            onClick={() => !isSubmitting && onClose()}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 rounded-md bg-slate-100 dark:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Modificação em `MatchEventCapture` — adicionar props e botões

```typescript
// sparta/src/components/domain/match-event-capture/match-event-capture.tsx
// ADICIONAR ao MatchEventCaptureProps:
interface MatchEventCaptureProps {
  sessionId: string;
  scheduledAt: string;  // ← NOVO
  durationMin: number;  // ← NOVO (para pass-through, pode não ser usado directamente no componente)
}

// ADICIONAR estado:
const [isSubSheetOpen, setIsSubSheetOpen] = useState(false);
const [closeError, setCloseError] = useState<string | null>(null);

// Handler Encerrar:
const handleCloseMatch = async () => {
  const confirmed = window.confirm("Encerrar registo de jogo? Os minutos finais serão registados.");
  if (!confirmed) return;
  const result = await closeMatchRecord(sessionId);
  if (!result.ok) {
    setCloseError(result.error.message);
  } else {
    // Feedback visual — ex: badge ou toast simples
    alert(`Registo encerrado. ${result.data.updated_count} jogador(es) actualizados.`);
  }
};

// NO HEADER, adicionar após o PendingBadge existente:
<button
  onClick={() => setIsSubSheetOpen(true)}
  aria-label="Abrir registo de substituição"
  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
>
  <ArrowLeftRight className="w-5 h-5" />
</button>
<button
  onClick={handleCloseMatch}
  aria-label="Encerrar registo de jogo"
  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
>
  <Flag className="w-5 h-5" />
</button>

// ADICIONAR após ZoneSelectorSheet:
<SubstitutionSheet
  sessionId={sessionId}
  scheduledAt={scheduledAt}
  isOpen={isSubSheetOpen}
  onClose={() => setIsSubSheetOpen(false)}
/>
```

### Modificação em `MatchCapturePage`

```typescript
// sparta/src/app/(staff)/sessoes/[id]/captura/page.tsx
// Actualizar query para incluir campos necessários:
const { data: session } = await supabase
  .from("sessions")
  .select("id, club_id, type, scheduled_at, duration_min")  // ← adicionar scheduled_at, duration_min
  .eq("id", sessionId)
  .eq("club_id", profile.club_id)
  .single();

// Passar novas props:
<MatchEventCapture
  sessionId={sessionId}
  scheduledAt={session.scheduled_at}   // ← NOVO
  durationMin={session.duration_min}   // ← NOVO
/>
```

### noUncheckedIndexedAccess — padrão obrigatório

```typescript
// ❌ Erro de compilação
const first = starters[0];

// ✅ Correcto
const first = starters[0] ?? null;
// ou
if (starters[0] !== undefined) { ... }
```

### `after()` para audit log

Usar `after()` do `next/server` (padrão estabelecido em Stories 3.11, 5.1, etc.) para fire-and-forget do audit log. NÃO usar `await` no audit log — não bloqueia a resposta.

```typescript
import { after } from "next/server";
// ...
after(() => logAccess("lineup.substitution", "session", sessionId, { ... }));
```

### Estrutura de ficheiros

```
sparta/supabase/migrations/
└── 000275_match_minutes_played.sql     CRIAR: view match_minutes_played

sparta/src/lib/actions/
└── substitutions.ts                    CRIAR: getMatchLineupForSubs + registerSubstitution + closeMatchRecord

sparta/src/components/domain/match-event-capture/
├── substitution-sheet.tsx              CRIAR: modal de substituição
└── match-event-capture.tsx             MODIFICAR: props scheduledAt+durationMin, botões Substituição+Encerrar

sparta/src/app/(staff)/sessoes/[id]/captura/
└── page.tsx                            MODIFICAR: passar scheduled_at + duration_min

sparta/src/__tests__/
├── lib/actions/substitutions.test.ts   CRIAR
└── components/domain/match-event-capture/substitution-sheet.test.tsx  CRIAR
```

---

## Testes — Padrão e Fixtures

### `substitutions.test.ts`

```typescript
// Fixtures
const SESSION_ID = "01920000-0000-7000-0000-000000000001";
const CLUB_ID    = "01920000-0000-7000-0000-000000000002";
const OUT_ID     = "01920000-0000-7000-0000-000000000003";
const IN_ID      = "01920000-0000-7000-0000-000000000004";

// Mock requireStaffRole → ok({ userId: "u1", clubId: CLUB_ID })
// Mock getServiceRoleClient → mock de from() com chain

describe("registerSubstitution", () => {
  it("substitui jogadores e cria audit log", async () => { ... });
  it("rejeita minuto > 120", async () => { ... });
  it("rejeita outPlayer já substituído (ended_minute !== null)", async () => { ... });
  it("rejeita inPlayer não é bench", async () => { ... });
  it("rejeita sessão de outro clube", async () => { ... });
});

describe("closeMatchRecord", () => {
  it("actualiza ended_minute = duration_min para starters em campo", async () => { ... });
  it("idempotente: 0 updates quando já encerrado", async () => { ... });
});

describe("getMatchLineupForSubs", () => {
  it("separa starters em campo vs bench", async () => { ... });
  it("exclui starters que já saíram (ended_minute set)", async () => { ... });
});
```

### `substitution-sheet.test.tsx`

```typescript
vi.mock("@/lib/actions/substitutions", () => ({
  getMatchLineupForSubs: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      starters: [{ lineup_id: "l1", player_id: "p1", name: "João", jersey_number: 10, started_minute: 0, ended_minute: null }],
      bench: [{ lineup_id: "l2", player_id: "p2", name: "Carlos", jersey_number: 14, started_minute: 0, ended_minute: null }],
    },
  }),
  registerSubstitution: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

describe("<SubstitutionSheet>", () => {
  const props = {
    sessionId: "sess-1",
    scheduledAt: new Date(Date.now() - 45 * 60_000).toISOString(), // 45 min ago
    isOpen: true,
    onClose: vi.fn(),
  };

  it("renderiza starters em Sai e bench em Entra", async () => { ... });
  it("minuto auto-calculado ≈ 45", () => { ... });
  it("botão Confirmar desactivado sem seleção", () => { ... });
  it("seleção dupla activa botão Confirmar", async () => { ... });
  it("Confirmar chama registerSubstitution com args correctos", async () => { ... });
  it("Cancelar chama onClose", async () => { ... });
  it("erro da action mostrado inline", async () => { ... });
  it("zero violações axe", async () => { ... });
});
```

---

## Critical Design Decisions

### 1. `match_lineups` via cast `as any` (sem tipo gerado)

**Decisão:** `(serviceRole.from as any)("match_lineups")` em todos os queries de `substitutions.ts`.

**Razão:** A tabela `match_lineups` não está tipada em `database.types.ts` (gerado pelo Supabase CLI). O padrão `as any` está já estabelecido em `lineups.ts:170` e `events.ts:72`. Não adicionar tipos manuais — o gerador sobrescreve.

### 2. Substituição actualiza `role` de 'bench' para 'starter'

**Decisão:** Quando um jogador entra, o seu `role` é actualizado de `'bench'` para `'starter'`.

**Razão:** A view `match_minutes_played` filtra `WHERE role = 'starter'` para calcular minutos. Se o role não mudar, o substituto não aparece na view. Após a mudança, é incluído com `started_minute = minute` e `ended_minute = null` (ou até ser substituído novamente).

### 3. Sem nova tabela — tudo em `match_lineups`

**Decisão:** Substituições são representadas actualizando as colunas `started_minute`, `ended_minute`, `role` já existentes em `match_lineups`.

**Razão:** A migration 000130 já tem os campos necessários (`started_minute`, `ended_minute`) com comentários explícitos "populated by Epic 6 (FR36)". Não duplicar dados.

### 4. `closeMatchRecord` como acção explícita (não automática)

**Decisão:** O encerramento do registo é accionado manualmente pelo Analista (botão "Encerrar").

**Razão:** Um trigger automático (ex: quando `session.status = 'completed'`) seria complicado — o Analista pode encerrar o registo antes ou depois de marcar a sessão como completa. A acção explícita é mais previsível e auditável.

### 5. Edição de substituições pós-sessão → Story 6.6

**Decisão:** A janela de edição para corrigir minutos de substituição é da Story 6.6 (backlog).

**Razão:** Igual ao padrão de `deleteMatchEvent` — o stub `isWithinEditWindow = true` está preparado mas não activado. Story 6.6 implementará a verificação real.

---

## Previous Story Intelligence (6-2 done, 6-3 ready-for-dev)

**Ficheiros existentes (NÃO criar de novo):**
- `sparta/src/lib/actions/events.ts` — padrão `requireStaffRole()` + `getServiceRoleClient()` + `as any` para match_lineups
- `sparta/src/lib/stores/match-session.ts` — Zustand com `selectedPlayer`, `selectedAction`, etc.
- `sparta/src/components/domain/match-event-capture/match-event-capture.tsx` — layout `flex flex-col h-screen`
- `sparta/src/components/domain/match-event-capture/zone-selector-sheet.tsx` — padrão de modal com `fixed inset-0 z-50`

**Padrões do code-review 6.2 a manter:**
- `startTransition(() => clearAction(polarity))` após submit bem-sucedido
- AbortController em `useEffect` para cancelar fetches quando componente desmonta
- Double-submit guard `if (isSubmitting) return`
- Import `PendingBadge` de `@/components/domain/pending-badge` (não `@/components/ui`)
- Dois clientes Supabase no mesmo request → usar apenas service role + `requireStaffRole()`

**Story 6.3 (ready-for-dev):** Implementa `<RecentEventsRing>` como sticky footer. A Story 6.4 NÃO deve interferir com o ring — adicionar `<SubstitutionSheet>` APÓS o ring no JSX.

---

## Referências

- [Epic 6 — Story 6.4](../planning-artifacts/epics.md) — AC completos
- [Story 6.1](./6-1-match-events-schema-idempotent-server-action.md) — padrão events.ts
- [Story 6.2](./6-2-touchscreen-b-sticky-player-stack-with-action-and-zone.md) — MatchEventCapture + ZoneSelectorSheet
- [Story 6.3](./6-3-recent-events-ring-last-6-for-audit-on-the-go.md) — RecentEventsRing footer
- [Story 6.6](./6-6-edit-delete-events-within-configurable-post-session-window.md) — janela de edição (backlog)
- [Architecture AGENTS.md](../../sparta/AGENTS.md) — Regra 1 (service role), Regra 4 (migration path), `noUncheckedIndexedAccess`
- `sparta/supabase/migrations/000130_match_lineups.sql` — schema: `started_minute`, `ended_minute`, `role`
- `sparta/supabase/migrations/000120_sessions.sql` — `scheduled_at`, `duration_min`
- `sparta/src/lib/actions/events.ts:70-83` — padrão `(serviceRole.from as any)("match_lineups")`
- `sparta/src/lib/actions/lineups.ts:168-205` — padrão delete+insert via `as any`
- `sparta/src/app/(staff)/sessoes/[id]/captura/page.tsx` — page a modificar

---

## Dev Agent Record

### Agent Model Used

_a preencher pelo dev agent_

### Completion Notes List

_a preencher pelo dev agent_

### File List

_a preencher pelo dev agent_
