# Story 2.4: Marcar Jogador como Inactivo (Soft Status)

**Status:** review

**Story ID:** 2.4
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-18

---

## Story

Como Analista,
Quero marcar um jogador como inactivo (ex: lesão prolongada, licença temporária) sem perder o histórico,
Para que desapareça dos fluxos activos mas os seus dados fiquem preservados para contexto e retoma.

---

## Acceptance Criteria

### AC #1: Migração `000095_players_inactive.sql`

**Given** a migração `000095_players_inactive.sql` é aplicada
**When** `supabase db push` (ou `supabase db reset` em local) corre sem erros
**Then** a tabela `players` tem:
- `is_active boolean NOT NULL DEFAULT true`
- `inactive_reason text` (nullable)

**And** a coluna `is_active` tem índice para suporte a queries de filtro (NFR1)

**Note crítica:** O épico menciona `000100_players_inactive.sql`, mas `000100_telemetry_events.sql` já existe.
O slot livre correcto é **`000095`** (entre `000090_player_metrics.sql` e `000100_telemetry_events.sql`).

---

### AC #2: Marcar jogador como inactivo via `<MarkInactiveSheet>`

**Given** Analista em `/plantel/[id]` com jogador activo (`is_active = true`)
**When** toca "Marcar inactivo"
**Then** um `<DrillDownSheet>` abre com:
- Campo de texto opcional "Motivo" (max 200 caracteres)
- Botão "Confirmar" e botão "Cancelar"

**When** o formulário é submetido (motivo preenchido ou vazio)
**Then** `is_active = false` e `inactive_reason` são guardados
**And** é criado um registo em `audit_logs` com `action='player.marked_inactive'`
**And** o utilizador é rediricionado para `/plantel`
**And** o jogador **não aparece** na lista activa do `/plantel`

---

### AC #3: Filtro "Inativos" na lista `/plantel`

**Given** existem jogadores com `is_active = false` no clube
**When** Analista abre `/plantel`
**Then** vê apenas jogadores com `is_active = true` (lista activa por defeito)
**And** existe um chip/botão "Ver inativos" na página

**When** clica "Ver inativos" (navega para `/plantel?view=inativos`)
**Then** vê apenas jogadores com `is_active = false` (e `is_archived = false`)
**And** existe um botão "Ver activos" para voltar à vista por defeito

---

### AC #4: Reactivar jogador via `<ReactivatePlayerDialog>`

**Given** Analista em `/plantel/[id]` com jogador inactivo (`is_active = false`)
**When** toca "Reactivar"
**Then** um `<Dialog>` de confirmação abre

**When** confirma
**Then** `is_active = true` e `inactive_reason = null` são guardados
**And** é criado um registo em `audit_logs` com `action='player.reactivated'`
**And** o jogador volta a aparecer na lista activa do `/plantel`
**And** o utilizador é rediricionado para `/plantel/${playerId}?reativado=1`

---

### AC #5: Jogadores inactivos excluídos de fluxos operacionais

**Given** um jogador com `is_active = false`
**When** qualquer query futura (Stories 2.7+, Epic 6) lista "convocáveis" ou "presentes"
**Then** o jogador inactivo é excluído por defeito
**And** referências históricas (sessões passadas, fadiga, eventos) permanecem intactas

**Note de implementação:** Este AC é sobre a semântica da coluna — documentar claramente no código.
As Stories 2.7+ vão filtrar `is_active = true`. Não é necessário implementar nada nas Stories futuras
agora; apenas garantir que `is_active` existe na tabela e está correctamente definido como `NOT NULL DEFAULT true`.

---

### AC #6: Distinção clara entre "arquivar" e "inactivar"

**Given** a documentação do código
**When** revisada
**Then** fica claro que:
- `is_archived = true` → remoção permanente do plantel (Story 2.1, `archivePlayer`)
- `is_active = false` → ausência temporária, retomável (`markPlayerInactive` / `reactivatePlayer`)
- Os dois flags são independentes; um jogador pode ser `is_archived = true AND is_active = false`

---

### AC #7: Cobertura de testes (NFR54)

**Given** os testes correm via `npm run test --run` a partir de `project-r/`
**When** executados
**Then** cobertura ≥80% para:
- Zod schema: `MarkInactiveSchema` (motivo max 200), `ReactivatePlayerSchema`
- Server Action `markPlayerInactive`: sucesso, erro de autenticação, isolamento multi-tenant
- Server Action `reactivatePlayer`: sucesso, jogador não encontrado
- `getPlayers()` com `showInactive: true` devolve apenas jogadores inactivos
- Componente `<MarkInactiveSheet>`: renderiza, submete, mostra erro
- Componente `<ReactivatePlayerDialog>`: renderiza, confirma

---

## Tasks / Subtasks

- [x] Task 1: Criar migração `000095_players_inactive.sql` (AC #1)
  - [x] 1.1 Criar `project-r/supabase/migrations/000095_players_inactive.sql`
  - [x] 1.2 `ALTER TABLE players ADD COLUMN is_active boolean NOT NULL DEFAULT true`
  - [x] 1.3 `ALTER TABLE players ADD COLUMN inactive_reason text`
  - [x] 1.4 `CREATE INDEX idx_players_is_active ON players(club_id, is_active)`
  - [x] 1.5 Validar SQL por inspecção (Docker não disponível localmente)

- [x] Task 2: Actualizar `database.types.ts` (AC #1)
  - [x] 2.1 Adicionar `is_active: boolean` e `inactive_reason: string | null` ao tipo `players` Row, Insert e Update

- [x] Task 3: Actualizar Zod schemas em `src/lib/schemas/players.ts` (AC #2, #4)
  - [x] 3.1 Adicionar `MarkInactiveSchema`: `playerId: uuid`, `inactive_reason: string.max(200).optional()`
  - [x] 3.2 Adicionar `ReactivatePlayerSchema`: `playerId: uuid`
  - [x] 3.3 Exportar types `MarkInactive`, `ReactivatePlayer`

- [x] Task 4: Actualizar Server Actions em `src/lib/actions/players.ts` (AC #2, #3, #4)
  - [x] 4.1 Adicionar `is_active: boolean` e `inactive_reason: string | null` à interface `PlayerWithPositions`
  - [x] 4.2 Actualizar `getPlayers()` para aceitar `options?: { showInactive?: boolean }` e filtrar por `is_active`
  - [x] 4.3 Actualizar `getPlayer()` para incluir `is_active` e `inactive_reason` no select
  - [x] 4.4 Criar `markPlayerInactive(input: MarkInactive): Promise<Result<void, AppError>>`
  - [x] 4.5 Criar `reactivatePlayer(input: ReactivatePlayer): Promise<Result<void, AppError>>`

- [x] Task 5: Criar componente `<MarkInactiveSheet>` (AC #2)
  - [x] 5.1 Criar `src/components/ui/mark-inactive-sheet.tsx` ("use client")
  - [x] 5.2 Usar `<DrillDownSheet>` com textarea para motivo (max 200 chars)
  - [x] 5.3 Submeter chama `markPlayerInactive`; em caso de sucesso redirecionar para `/plantel`

- [x] Task 6: Criar componente `<ReactivatePlayerDialog>` (AC #4)
  - [x] 6.1 Criar `src/app/(staff)/plantel/[id]/reactivate-player-dialog.tsx` ("use client")
  - [x] 6.2 Seguir padrão de `archive-player-dialog.tsx` (Dialog + botão confirmar)
  - [x] 6.3 Em caso de sucesso: chamar `redirect(`/plantel/${playerId}?reativado=1`)`

- [x] Task 7: Actualizar página `/plantel/page.tsx` (AC #3)
  - [x] 7.1 Aceitar `searchParams: Promise<{ view?: string }>` como prop
  - [x] 7.2 Se `view === "inativos"`: chamar `getPlayers({ showInactive: true })`; senão, chamar `getPlayers()`
  - [x] 7.3 Adicionar chip de filtro "Ver inativos" / "Ver activos" no topo da página
  - [x] 7.4 Quando em vista inactivos: mostrar badge ou indicador junto a cada jogador

- [x] Task 8: Actualizar página `/plantel/[id]/page.tsx` (AC #2, #4)
  - [x] 8.1 Incluir `is_active` e `inactive_reason` nos dados do jogador (já vem de `getPlayer()` actualizado)
  - [x] 8.2 Se `player.is_active = true`: mostrar `<MarkInactiveSheet>` na secção de actions
  - [x] 8.3 Se `player.is_active = false`: mostrar badge "Inactivo" + motivo (se existir) + `<ReactivatePlayerDialog>`
  - [x] 8.4 Mostrar `<CalmConfirmation message="Jogador reactivado" />` se `searchParams.reativado === "1"`

- [x] Task 9: Escrever testes (AC #7)
  - [x] 9.1 Testes Zod: `MarkInactiveSchema` (motivo vazio OK, motivo >200 falha), `ReactivatePlayerSchema`
  - [x] 9.2 Testes Server Actions: `markPlayerInactive` sucesso + audit log, `reactivatePlayer` sucesso + audit log
  - [x] 9.3 Teste: `getPlayers({ showInactive: true })` filtra correctamente
  - [x] 9.4 Testes componentes: `<MarkInactiveSheet>`, `<ReactivatePlayerDialog>`

- [x] Task 10: Verificação final (AC #1–#7)
  - [x] 10.1 `npm run lint` — 0 novos erros
  - [x] 10.2 `npm run typecheck` — zero erros
  - [x] 10.3 `npm run test --run` a partir de `project-r/` — 442/442 ✅
  - [x] 10.4 `npm run build` — build limpa ✅

---

## Dev Notes

### ⚠️ Conflito de Número de Migração

O épico especifica `000100_players_inactive.sql`, **mas `000100_telemetry_events.sql` já existe**.

Usar: **`000095_players_inactive.sql`** (slot livre entre 000090 e 000100).

Migrações existentes relevantes:
```
000070_players_positions.sql
000075_player_rpc.sql
000080_audit_logs.sql
000085_players_photo.sql
000090_player_metrics.sql       ← Story 2.3 (último aplicado)
000095_players_inactive.sql     ← ESTA STORY (a criar)
000100_telemetry_events.sql     ← já existe
000150_pg_cron_jobs.sql
000160_profiles_updated_at.sql
```

---

### Inventário de Ficheiros

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `project-r/supabase/migrations/000095_players_inactive.sql` | NEW | ALTER TABLE players + índice |
| `project-r/src/lib/supabase/database.types.ts` | UPDATE | Adicionar `is_active` + `inactive_reason` ao tipo players |
| `project-r/src/lib/schemas/players.ts` | UPDATE | Adicionar MarkInactiveSchema, ReactivatePlayerSchema |
| `project-r/src/lib/actions/players.ts` | UPDATE | markPlayerInactive, reactivatePlayer, getPlayers options, getPlayer select |
| `project-r/src/components/ui/mark-inactive-sheet.tsx` | NEW | Client component: DrillDownSheet + form |
| `project-r/src/app/(staff)/plantel/[id]/reactivate-player-dialog.tsx` | NEW | Client component: Dialog confirmação |
| `project-r/src/app/(staff)/plantel/page.tsx` | UPDATE | Filter chip Inativos, searchParams |
| `project-r/src/app/(staff)/plantel/[id]/page.tsx` | UPDATE | Conditional MarkInactive/Reactivate, badge inactivo, reativado confirmation |
| `project-r/src/__tests__/lib/actions/players-inactive.test.ts` | NEW | Unit tests markPlayerInactive, reactivatePlayer |
| `project-r/src/__tests__/components/mark-inactive-sheet.test.tsx` | NEW | Component tests |

---

### Migração: `000095_players_inactive.sql`

```sql
-- Migration: 000095_players_inactive
-- Purpose: Add is_active + inactive_reason to players for soft temp-out status (FR15)
-- Distinction: is_archived=true = permanent removal; is_active=false = temporary out-of-rotation

ALTER TABLE players
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN inactive_reason text;

-- Composite index supports both active list (is_active=true) and inactive list (is_active=false)
-- scoped per club for multi-tenant isolation (NFR1)
CREATE INDEX idx_players_club_active ON players(club_id, is_active);

COMMENT ON COLUMN players.is_active IS
  'false = temporarily out-of-rotation (injury, leave). Distinct from is_archived=true which is permanent.';
COMMENT ON COLUMN players.inactive_reason IS
  'Optional free-text reason for inactivation (max 200 chars enforced at application layer).';
```

---

### Actualização ao tipo `PlayerWithPositions` (players.ts)

Adicionar ao interface **antes** de `positions`:

```ts
export interface PlayerWithPositions {
  id: string;
  club_id: string;
  profile_id: string | null;
  jersey_num: number;
  full_name: string;
  birthdate: string;
  age_group: string;
  is_archived: boolean;
  is_active: boolean;          // ← NOVO
  inactive_reason: string | null; // ← NOVO
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  positions: PlayerPosition[];
}
```

---

### Actualização ao `getPlayers()` — filtro `is_active`

```ts
export async function getPlayers(
  options?: { showInactive?: boolean }
): Promise<Result<GroupedPlayers, AppError>> {
  // ... auth checks ...

  const { data, error } = await supabase
    .from("players")
    .select("*, positions(*)")
    .eq("club_id", profile.club_id)
    .eq("is_archived", false)
    .eq("is_active", options?.showInactive ? false : true)  // ← NOVO filtro
    .order("full_name");

  // resto igual...
}
```

### Actualização ao `getPlayer()` — incluir novas colunas

Actualizar o select para incluir os novos campos:

```ts
const { data, error } = await supabase
  .from("players")
  .select("id, club_id, profile_id, jersey_num, full_name, birthdate, age_group, is_archived, is_active, inactive_reason, photo_path, created_at, updated_at, positions(id, position, is_primary, sort_order)")
  .eq("id", playerId)
  .single();
```

---

### Zod Schemas: adicionar a `src/lib/schemas/players.ts`

```ts
export const MarkInactiveSchema = z.object({
  playerId: z.string().uuid("ID de jogador inválido"),
  inactive_reason: z
    .string()
    .max(200, "Motivo não pode exceder 200 caracteres")
    .optional(),
});

export const ReactivatePlayerSchema = z.object({
  playerId: z.string().uuid("ID de jogador inválido"),
});

export type MarkInactive = z.infer<typeof MarkInactiveSchema>;
export type ReactivatePlayer = z.infer<typeof ReactivatePlayerSchema>;
```

---

### Server Actions: adicionar a `src/lib/actions/players.ts`

```ts
export async function markPlayerInactive(
  input: MarkInactive
): Promise<Result<void, AppError>> {
  const validated = MarkInactiveSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { error } = await supabase
    .from("players")
    .update({
      is_active: false,
      inactive_reason: validated.data.inactive_reason ?? null,
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id);  // isolamento multi-tenant

  if (error) return err({ code: "unknown", message: error.message });

  await logAccess("player.marked_inactive", "player", validated.data.playerId);

  redirect("/plantel");
}

export async function reactivatePlayer(
  input: ReactivatePlayer
): Promise<Result<void, AppError>> {
  const validated = ReactivatePlayerSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { error } = await supabase
    .from("players")
    .update({
      is_active: true,
      inactive_reason: null,
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id);  // isolamento multi-tenant

  if (error) return err({ code: "unknown", message: error.message });

  await logAccess("player.reactivated", "player", validated.data.playerId);

  redirect(`/plantel/${validated.data.playerId}?reativado=1`);
}
```

---

### Componente `<MarkInactiveSheet>`

Criar `src/components/ui/mark-inactive-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { markPlayerInactive } from "@/lib/actions/players";
import { MarkInactiveSchema, type MarkInactive } from "@/lib/schemas/players";

interface MarkInactiveSheetProps {
  playerId: string;
  playerName: string;
}

export function MarkInactiveSheet({ playerId, playerName }: MarkInactiveSheetProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<MarkInactive>({
    resolver: zodResolver(MarkInactiveSchema),
    defaultValues: { playerId, inactive_reason: "" },
  });

  async function onSubmit(data: MarkInactive) {
    const result = await markPlayerInactive({
      ...data,
      inactive_reason: data.inactive_reason || undefined,
    });
    if (!result.ok) {
      form.setError("root", { message: result.error.message });
    }
    // On success: markPlayerInactive calls redirect("/plantel")
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Marcar inactivo
      </Button>

      <DrillDownSheet open={open} onOpenChange={setOpen}>
        <h2 className="text-base font-semibold mb-4">Marcar {playerName} como inactivo</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <textarea
              rows={3}
              maxLength={200}
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              placeholder="ex: lesão no joelho, retorno previsto em Jun"
              {...form.register("inactive_reason")}
            />
            {form.formState.errors.inactive_reason && (
              <p className="text-xs text-destructive">
                {form.formState.errors.inactive_reason.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">{form.formState.errors.root.message}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "A guardar…" : "Confirmar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}
```

---

### Componente `<ReactivatePlayerDialog>`

Criar `src/app/(staff)/plantel/[id]/reactivate-player-dialog.tsx` (co-locate com `archive-player-dialog.tsx`):

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { reactivatePlayer } from "@/lib/actions/players";

interface ReactivatePlayerDialogProps {
  playerId: string;
  playerName: string;
}

export function ReactivatePlayerDialog({ playerId, playerName }: ReactivatePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReactivate() {
    setError(null);
    setIsPending(true);
    try {
      const result = await reactivatePlayer({ playerId });
      if (!result.ok) {
        setError(result.error.message);
        setIsPending(false);
      }
      // On success: reactivatePlayer calls redirect(`/plantel/${playerId}?reativado=1`)
    } catch {
      setError("Erro inesperado. Tenta novamente.");
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Reactivar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivar jogador?</DialogTitle>
          <DialogDescription>
            <strong>{playerName}</strong> volta a aparecer no plantel activo.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-signal-alert">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleReactivate} disabled={isPending}>
            {isPending ? "A reactivar…" : "Reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Actualização `/plantel/page.tsx` — filtro Inativos

```tsx
// Adicionar às props da page:
export default async function PlantelPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showInactive = view === "inativos";

  const result = await getPlayers(showInactive ? { showInactive: true } : undefined);
  // ...

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          Plantel{showInactive ? " — Inativos" : ""}
        </h1>
        <Button asChild size="sm">
          <Link href="/plantel/novo">
            <Plus className="h-4 w-4" />
            Adicionar
          </Link>
        </Button>
      </div>

      {/* Filter chip */}
      <div className="mb-4">
        {showInactive ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/plantel">← Ver activos</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/plantel?view=inativos">Ver inativos</Link>
          </Button>
        )}
      </div>

      {/* ... resto da lista igual ... */}
    </div>
  );
}
```

---

### Actualização `/plantel/[id]/page.tsx` — botões condicionais

```tsx
// Adicionar import:
import { MarkInactiveSheet } from "@/components/ui/mark-inactive-sheet";
import { ReactivatePlayerDialog } from "./reactivate-player-dialog";

// Substituir a secção de Actions:
{/* Actions */}
<div className="flex gap-3">
  <Button asChild size="sm" className="flex-1">
    <Link href={`/plantel/${player.id}/editar`}>
      <Pencil className="h-4 w-4" />
      Editar
    </Link>
  </Button>
  {player.is_active ? (
    <MarkInactiveSheet playerId={player.id} playerName={player.full_name} />
  ) : (
    <ReactivatePlayerDialog playerId={player.id} playerName={player.full_name} />
  )}
  <ArchivePlayerDialog playerId={player.id} playerName={player.full_name} />
</div>

{/* Badge de inactivo (só quando is_active=false) */}
{!player.is_active && (
  <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
    <span className="font-medium">Inactivo</span>
    {player.inactive_reason && (
      <span className="ml-2">— {player.inactive_reason}</span>
    )}
  </div>
)}

// Na secção de confirmações (já existente):
{showCreated && <CalmConfirmation message="Jogador adicionado" />}
{showUpdated && <CalmConfirmation message="Jogador actualizado" />}
{reativado === "1" && <CalmConfirmation message="Jogador reactivado" />}

// Adicionar reativado ao searchParams:
const { created, updated, reativado } = await searchParams;
```

---

### Padrão de Testes: `players-inactive.test.ts`

```ts
// project-r/src/__tests__/lib/actions/players-inactive.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkInactiveSchema, ReactivatePlayerSchema } from "@/lib/schemas/players";

// Mock Supabase — mesmo padrão das stories anteriores
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: table === "profiles"
          ? { club_id: "club-a" }
          : { id: "player-1", is_active: true },
        error: null,
      })),
    })),
  })),
}));

// Mock redirect (next/navigation)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("MarkInactiveSchema", () => {
  it("aceita motivo vazio (opcional)", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("aceita motivo preenchido até 200 chars", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      inactive_reason: "lesão no joelho",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita motivo com mais de 200 chars", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      inactive_reason: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejeita playerId inválido", () => {
    const result = MarkInactiveSchema.safeParse({ playerId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("ReactivatePlayerSchema", () => {
  it("aceita UUID válido", () => {
    const result = ReactivatePlayerSchema.safeParse({
      playerId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });
});
```

---

## Previous Story Intelligence

**Story 2.3: Player Metrics Time Series** (review — 2026-05-18)

- Zod v4 usa `.issues` (não `.errors`): `validated.error.issues[0]?.message`
- `EmptyState` usa props `icon`, `title`, `description`, `cta` — **NÃO** `action`
- `datetime-local` input precisa de conversão para ISO antes de chamar server action (z.string().datetime({ offset: true }) exige timezone)
- recharts v3.8.1 instalado (não é relevante para esta story)
- `updatePayload` tipado como `Record<string, unknown>` evita erro TS2345 do Supabase v2

**Story 2.2: Player Photo Upload** (done — 2026-05-18)

- Padrão de Server Action: verificar user → verificar profile.club_id → operar → logAccess
- `Result<T, E>` usa `.data` (não `.value`): `if (result.ok) { use(result.data) }`
- `sharp` usa `require("sharp")` (CommonJS) — não relevante para esta story

**Story 2.1: Player Records** (done)

- `archivePlayer` usa `redirect("/plantel")` após sucesso — **SEGUIR** o mesmo padrão para `markPlayerInactive`
- `<ArchivePlayerDialog>` está em `src/app/(staff)/plantel/[id]/archive-player-dialog.tsx` — co-localizado com a página
- `<DrillDownSheet>` já existe em `src/components/ui/drill-down-sheet.tsx` (usar)
- `<CalmConfirmation>`, `<EmptyState>`, `<Dialog>` já existem em `src/components/ui/`
- `logAccess()` em `src/lib/actions/audit.ts` — fire-and-forget, não bloqueia

**Padrões críticos a seguir:**
1. Server Actions: `"use server"` no topo, validação Zod com `safeParse`, retornar `Result<T, AppError>`
2. Nunca lançar exceções ao cliente
3. `ok(data)` / `err({ code, message })` de `@/lib/types`
4. `logAccess()` — fire-and-forget
5. React 19: **não** importar `React` em ficheiros `.tsx`
6. `noUncheckedIndexedAccess`: usar `arr?.[0] ?? fallback` em acessos a arrays
7. Zod v4: `.issues` (não `.errors`) no error path
8. Testes correm a partir de `project-r/` com `npm run test --run`

---

## Git Intelligence Summary

```
797045e feat: implement player photo upload functionality
5d16859 fix: improve migration execution logic in push-migrations.sh
723bb8c fix: improve error handling and execution of SQL migrations
4cb2f0c feat: implement migration script for applying database migrations
beae630 feat: update Supabase deployment workflow to create config file
```

### Padrão de Commit Sugerido

```
feat(2-4): mark player as inactive — migration 000095, markPlayerInactive/reactivatePlayer actions, filter chip
```

---

## Latest Tech Information

### `next/navigation` — `redirect()` em Server Actions

- `redirect()` lança internamente um erro de Next.js; **não** deve ser chamado dentro de `try/catch` sem re-lançar
- No padrão do projecto: chamar `redirect()` **após** confirmar sucesso, fora de qualquer try/catch (ver `archivePlayer`)
- `useRouter().push()` só pode ser usado em Client Components; em Server Actions usar `redirect()` de `next/navigation`

### Supabase: `.eq()` com booleanos

- `.eq("is_active", false)` funciona correctamente com Supabase JS v2
- `.eq("is_active", options?.showInactive ? false : true)` é seguro — o operador ternário com boolean é type-safe

### `searchParams` em Next.js App Router (Server Components)

- `searchParams` é uma `Promise` em Next.js 15+: `const { view } = await searchParams`
- **Não** é síncrono — padrão já estabelecido em `/plantel/[id]/page.tsx` (ver `const { created, updated } = await searchParams`)

---

## Project Context Reference

```
ProjectR/ (git root)
├── project-r/
│   ├── supabase/
│   │   └── migrations/
│   │       ├── 000085_players_photo.sql       (Story 2.2)
│   │       ├── 000090_player_metrics.sql      (Story 2.3)
│   │       └── 000095_players_inactive.sql    ← NEW (esta story)
│   └── src/
│       ├── lib/
│       │   ├── actions/
│       │   │   ├── audit.ts                   ← usar logAccess()
│       │   │   └── players.ts                 ← UPDATE (markPlayerInactive, reactivatePlayer, getPlayers options)
│       │   ├── schemas/
│       │   │   └── players.ts                 ← UPDATE (MarkInactiveSchema, ReactivatePlayerSchema)
│       │   ├── types.ts                       ← Result<T,E>, ok(), err()
│       │   └── supabase/database.types.ts     ← UPDATE (is_active, inactive_reason no tipo players)
│       ├── components/ui/
│       │   ├── drill-down-sheet.tsx           ← usar (já existe)
│       │   ├── calm-confirmation.tsx          ← usar (já existe)
│       │   ├── button.tsx                     ← usar (já existe)
│       │   └── mark-inactive-sheet.tsx        ← NEW (esta story)
│       └── app/(staff)/plantel/
│           ├── page.tsx                       ← UPDATE (filter chip, searchParams)
│           └── [id]/
│               ├── page.tsx                   ← UPDATE (conditional buttons, inactive badge)
│               ├── archive-player-dialog.tsx  ← existente (NÃO modificar)
│               └── reactivate-player-dialog.tsx ← NEW (co-localizado)
```

**Referências normativas:**
- FR15: Staff pode marcar jogadores como inactivos temporariamente sem perder histórico
- UX-DR35: Filter chips em list views
- AR8: RLS em todas as tabelas; `club_id` isolamento
- NFR1: Índices em colunas de filtro frequente

---

## Dev Agent Record

### Implementation Plan

Implementação seguindo o ciclo red-green-refactor:

1. Migração SQL `000095_players_inactive` com ALTER TABLE + índice composto
2. `database.types.ts` atualizado com `is_active`/`inactive_reason`
3. Zod schemas `MarkInactiveSchema` e `ReactivatePlayerSchema` adicionados
4. Server actions `markPlayerInactive` e `reactivatePlayer` com isolamento multi-tenant
5. `getPlayers()` atualizado com filtro `is_active`, `getPlayer()` com novas colunas
6. `<MarkInactiveSheet>` usando `<DrillDownSheet>` + react-hook-form
7. `<ReactivatePlayerDialog>` seguindo padrão de `archive-player-dialog.tsx`
8. `/plantel/page.tsx` com filtro `view=inativos` e chips de navegação
9. `/plantel/[id]/page.tsx` com botões condicionais e badge de inativo

### Completion Notes

- **Status:** review
- **Created:** 2026-05-18
- **Completed:** 2026-05-18
- **Tests:** 442/442 ✅ (18 novos testes adicionados)
- **Lint:** 0 novos erros ✅
- **Typecheck:** 0 erros ✅
- **Build:** limpa ✅
- **ACs verificados:** #1 (migração), #2 (MarkInactiveSheet), #3 (filtro inativos), #4 (ReactivatePlayerDialog), #5 (semântica is_active documentada), #6 (distinção is_archived vs is_active), #7 (cobertura de testes ≥80%)

### File List

- `project-r/supabase/migrations/000095_players_inactive.sql` (NEW)
- `project-r/src/lib/supabase/database.types.ts` (UPDATE — is_active, inactive_reason)
- `project-r/src/lib/schemas/players.ts` (UPDATE — MarkInactiveSchema, ReactivatePlayerSchema)
- `project-r/src/lib/actions/players.ts` (UPDATE — markPlayerInactive, reactivatePlayer, getPlayers options, getPlayer select, PlayerWithPositions interface)
- `project-r/src/components/ui/mark-inactive-sheet.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/reactivate-player-dialog.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/page.tsx` (UPDATE — searchParams, filtro inativos)
- `project-r/src/app/(staff)/plantel/[id]/page.tsx` (UPDATE — botões condicionais, badge inativo, reativado confirmation)
- `project-r/src/__tests__/lib/actions/players-inactive.test.ts` (NEW)
- `project-r/src/__tests__/components/mark-inactive-sheet.test.tsx` (NEW)

### Change Log

- 2026-05-18: Story 2.4 implementada — migração 000095, markPlayerInactive/reactivatePlayer, filtro inativos em /plantel, MarkInactiveSheet, ReactivatePlayerDialog, 18 novos testes; 442/442 ✅; lint 0 erros; typecheck ✅; build ✅; AC #1-#7 verificados
