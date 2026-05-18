# Story 2.5: Season Management (Épocas)

**Status:** review

**Story ID:** 2.5
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-18

---

## Story

Como Treinador ou Analista,
Quero criar e gerir épocas com datas de início/fim e marcar qual é a época atual,
Para que os dados históricos possam ser filtrados pelo período correto sem contaminação entre épocas.

---

## Acceptance Criteria

### AC #1: Migração `000110_seasons.sql`

**Given** a migração `000110_seasons.sql` é aplicada
**When** `supabase db push` (ou `supabase db reset` em local) corre sem erros
**Then** a tabela `seasons` existe com:
- `id uuid PRIMARY KEY DEFAULT public.uuidv7()`
- `club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`
- `name text NOT NULL`
- `start_date date NOT NULL`
- `end_date date NOT NULL`
- `is_current boolean NOT NULL DEFAULT false`
- `created_at timestamptz NOT NULL DEFAULT now()`

**And** existe um partial unique index `idx_seasons_one_current ON seasons(club_id) WHERE is_current = true` (garante apenas uma época atual por clube)

**And** existe um índice de performance `idx_seasons_club ON seasons(club_id)` (NFR1)

**And** RLS está activo com políticas de isolamento por clube:
- SELECT: `club_id = auth.club_id()` (todos os utilizadores autenticados do clube)
- INSERT: `club_id = auth.club_id() AND auth.user_role() IN ('coach', 'analyst')`
- UPDATE: `club_id = auth.club_id() AND auth.user_role() IN ('coach', 'analyst')`

**And** existe a função RPC `public.set_current_season(p_season_id uuid, p_club_id uuid)` com `SECURITY DEFINER` para troca atómica de época atual

---

### AC #2: Criar época via `/configuracoes/epocas`

**Given** Treinador ou Analista acede a `/configuracoes/epocas`
**When** clica "Nova época"
**Then** um formulário abre (DrillDownSheet) com:
- Campo "Nome" obrigatório (ex: "2026/27", max 50 chars)
- Campo "Data de início" obrigatório (date input)
- Campo "Data de fim" obrigatório (date input)
- Checkbox "Definir como época atual"

**When** o formulário é submetido com dados válidos
**Then** a época é criada na tabela `seasons`
**And** se "Definir como atual" está marcado, a função RPC `set_current_season` é chamada (troca atómica)
**And** é criado um registo em `audit_logs` com `action='season.created'`
**And** `<CalmConfirmation message="Época criada" />` é mostrado

**When** `end_date <= start_date`
**Then** Zod rejeita com mensagem "Data de fim deve ser posterior à data de início"

---

### AC #3: Editar época existente

**Given** Treinador ou Analista em `/configuracoes/epocas`
**When** clica numa época existente para editar
**Then** o mesmo formulário abre pré-preenchido com os dados actuais

**When** o formulário é submetido com dados válidos
**Then** o registo é actualizado na tabela `seasons`
**And** é criado um registo em `audit_logs` com `action='season.updated'`
**And** `<CalmConfirmation message="Época actualizada" />` é mostrado

---

### AC #4: Hook `useSeasonView` e componente `<SeasonToggle>`

**Given** qualquer vista de dados futura (Épicas 5, 7) integra `<SeasonToggle>`
**When** o utilizador alterna entre "Época atual" e "Cumulativo"
**Then** o estado é preservado em `localStorage` sob a chave `season_view`
**And** a vista de dados filtra por `season_id = currentSeason.id` (mode "current") ou sem filtro (mode "cumulative")

**Note de implementação:** Esta story cria o hook `useSeasonView` e o componente `<SeasonToggle>` como fundação reutilizável. As vistas de dados que usam este toggle são implementadas nas Épicas 5 e 7.

---

### AC #5: Degradação graciosa sem época atual

**Given** nenhuma época do clube tem `is_current = true`
**When** qualquer fluxo que requer época atual corre (ou quando `<SeasonToggle>` está em modo "current")
**Then** a UI mostra uma mensagem de alerta: "Sem época atual definida. Configure em /configuracoes/epocas."
**And** o fluxo não quebra — degradação graciosa

**Note:** A função `getCurrentSeason()` retorna `null` quando não existe época atual; os consumidores devem lidar com este caso.

---

### AC #6: Listar épocas do clube

**Given** Treinador ou Analista em `/configuracoes/epocas`
**When** a página carrega
**Then** vê a lista de épocas do seu clube ordenadas por `start_date DESC`
**And** a época atual tem um badge "Atual" visível
**And** se não existem épocas, é mostrado `<EmptyState>` com CTA para criar a primeira

---

### AC #7: Cobertura de testes (NFR54)

**Given** os testes correm via `npm run test --run` a partir de `project-r/`
**When** executados
**Then** cobertura ≥80% para:
- Zod schema: `SeasonCreateSchema` (refine end>start, campos obrigatórios), `SeasonUpdateSchema`
- Server Action `createSeason`: sucesso, `setAsCurrent=true`, erro de autenticação, isolamento multi-tenant
- Server Action `updateSeason`: sucesso, época não encontrada
- Server Action `getSeasonsForClub`: devolve lista ordenada
- Server Action `getCurrentSeason`: devolve época atual ou null
- Hook `useSeasonView`: lê/escreve localStorage, toggle correcto
- Componente `<SeasonForm>`: renderiza, submete, mostra erro de validação

---

## Tasks / Subtasks

- [x] Task 1: Criar migração `000110_seasons.sql` (AC #1)
  - [x] 1.1 Criar `project-r/supabase/migrations/000110_seasons.sql`
  - [x] 1.2 CREATE TABLE seasons com todos os campos
  - [x] 1.3 CREATE UNIQUE INDEX parcial `idx_seasons_one_current`
  - [x] 1.4 CREATE INDEX `idx_seasons_club`
  - [x] 1.5 ALTER TABLE ENABLE ROW LEVEL SECURITY + 3 policies
  - [x] 1.6 Criar função RPC `set_current_season` (SECURITY DEFINER)
  - [x] 1.7 Validar SQL por inspecção

- [x] Task 2: Actualizar `database.types.ts` (AC #1)
  - [x] 2.1 Adicionar tipo `seasons` (Row, Insert, Update, Relationships) a `Database["public"]["Tables"]`

- [x] Task 3: Criar Zod schemas `src/lib/schemas/seasons.ts` (AC #2, #3)
  - [x] 3.1 `SeasonCreateSchema`: name (min1, max50), startDate (z.string().date()), endDate (z.string().date()), setAsCurrent (boolean, default false) + `.refine(end > start)`
  - [x] 3.2 `SeasonUpdateSchema`: id (uuid) + campos iguais ao Create + `.refine(end > start)`
  - [x] 3.3 Exportar types `SeasonCreate`, `SeasonUpdate`
  - [x] 3.4 Exportar `type Season` (equivalente a `Database["public"]["Tables"]["seasons"]["Row"]`)

- [x] Task 4: Criar Server Actions `src/lib/actions/seasons.ts` (AC #2, #3, #5, #6)
  - [x] 4.1 `getSeasonsForClub()`: SELECT seasons WHERE club_id = auth club, ORDER BY start_date DESC
  - [x] 4.2 `getCurrentSeason()`: SELECT seasons WHERE club_id = ? AND is_current = true, devolve `Season | null`
  - [x] 4.3 `createSeason(input: SeasonCreate)`: INSERT + se setAsCurrent, chamar RPC `set_current_season` + logAccess
  - [x] 4.4 `updateSeason(input: SeasonUpdate)`: UPDATE + se setAsCurrent, chamar RPC `set_current_season` + logAccess

- [x] Task 5: Criar hook e componente do toggle (AC #4)
  - [x] 5.1 Criar `src/hooks/useSeasonView.ts` — hook "use client", localStorage key `season_view`, tipo `SeasonView = "current" | "cumulative"`
  - [x] 5.2 Criar `src/components/ui/season-toggle.tsx` — "use client", usa `useSeasonView`, dois botões toggle (como chip group)

- [x] Task 6: Criar `<SeasonForm>` (AC #2, #3)
  - [x] 6.1 Criar `src/app/configuracoes/epocas/season-form.tsx` ("use client")
  - [x] 6.2 Usar `<DrillDownSheet>` com react-hook-form + zodResolver(SeasonCreateSchema | SeasonUpdateSchema)
  - [x] 6.3 Campos: `name` (text input), `start_date` (date input), `end_date` (date input), `set_as_current` (checkbox)
  - [x] 6.4 `useTransition()` para chamar server action (NÃO try/catch com redirect)
  - [x] 6.5 Em sucesso: fechar sheet + mostrar `<CalmConfirmation>` (via `router.refresh()` + `searchParams.criada=1`)

- [x] Task 7: Criar página `/configuracoes/epocas/page.tsx` (AC #2, #3, #5, #6)
  - [x] 7.1 Server Component com auth check: `getUser()` → `getProfile()` → verificar role in ('coach', 'analyst')
  - [x] 7.2 Chamar `getSeasonsForClub()` para carregar lista
  - [x] 7.3 Mostrar lista de épocas com badge "Atual" quando `is_current = true`
  - [x] 7.4 Botão "Nova época" que abre `<SeasonForm mode="create">`
  - [x] 7.5 Botão de editar por linha que abre `<SeasonForm mode="edit" season={season}>`
  - [x] 7.6 `<EmptyState>` quando lista vazia
  - [x] 7.7 `<StickyHeader title="Épocas" backHref="/configuracoes" />` no topo
  - [x] 7.8 Suportar `searchParams.criada` e `searchParams.actualizada` para `<CalmConfirmation>`

- [x] Task 8: Actualizar `/configuracoes/page.tsx` (AC #6)
  - [x] 8.1 Adicionar link para `/configuracoes/epocas` na página de configurações

- [x] Task 9: Escrever testes (AC #7)
  - [x] 9.1 `project-r/src/__tests__/lib/schemas/seasons.test.ts` — schemas Zod
  - [x] 9.2 `project-r/src/__tests__/lib/actions/seasons.test.ts` — server actions
  - [x] 9.3 `project-r/src/__tests__/hooks/useSeasonView.test.ts` — hook localStorage
  - [x] 9.4 `project-r/src/__tests__/components/season-form.test.tsx` — componente

- [x] Task 10: Verificação final (AC #1–#7)
  - [x] 10.1 `npm run lint` — 0 novos erros
  - [x] 10.2 `npm run typecheck` — zero erros
  - [x] 10.3 `npm run test --run` a partir de `project-r/` — 543 testes ✅ (base: 442 + 101 novos)
  - [x] 10.4 `npm run build` — build limpa ✅

---

## Dev Notes

### ⚠️ Número de Migração Correto

O ficheiro de arquitectura original previa `000030_seasons_sessions.sql`, mas esse slot **já está ocupado** por `000030_auth_helpers.sql`.

Usar: **`000110_seasons.sql`** (slot livre entre `000100_telemetry_events.sql` e `000150_pg_cron_jobs.sql`).

Nota: `000096_player_invite.sql` e `000097_rls_policy_migration.sql` também existem agora.

Sequência actual relevante:
```
000095_players_inactive.sql       ← Story 2.4
000096_player_invite.sql          ← Story 2.10
000097_rls_policy_migration.sql   ← RLS fixe
000100_telemetry_events.sql       ← Story 1.12
000110_seasons.sql                ← ESTA STORY (a criar)
000150_pg_cron_jobs.sql           ← já existe
000160_profiles_updated_at.sql    ← já existe
```

---

### ⚠️ `configuracoes/` está FORA do route group `(staff)`

A rota `/configuracoes/epocas` vive em `src/app/configuracoes/epocas/` — **fora** do grupo `(staff)`.
Isso significa que **não** herda automaticamente o layout de staff (`(staff)/layout.tsx`).

**Consequência:** A página DEVE verificar autenticação e role internamente:
```ts
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");

const { data: profile } = await supabase
  .from("profiles").select("club_id, role").eq("id", user.id).single();
if (!profile || !["coach", "analyst"].includes(profile.role)) redirect("/");
```

Seguir o padrão existente de `configuracoes/page.tsx` (usa `<StickyHeader>` directamente sem layout de staff).

---

### Migração `000110_seasons.sql`

```sql
-- Migration: 000110_seasons
-- Purpose: Seasons table for temporal scoping of session/match data (FR20)

CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one current season per club (enforced at DB level)
CREATE UNIQUE INDEX idx_seasons_one_current ON seasons(club_id) WHERE is_current = true;

-- Performance: club_id queries scoped per tenant (NFR1)
CREATE INDEX idx_seasons_club ON seasons(club_id);

COMMENT ON TABLE seasons IS 'Temporal boundaries for session/match data per club';
COMMENT ON COLUMN seasons.is_current IS
  'true = active season for data entry. Only one per club enforced via partial unique index.';

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- All authenticated club members can read seasons
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT USING (club_id = auth.club_id());

-- Only coach/analyst can create seasons
CREATE POLICY "seasons_insert" ON seasons
  FOR INSERT WITH CHECK (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

-- Only coach/analyst can update their own club's seasons
CREATE POLICY "seasons_update" ON seasons
  FOR UPDATE USING (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

-- Atomic swap: unsets all current seasons for club, then sets the given one
-- SECURITY DEFINER bypasses RLS for the swap operation
CREATE OR REPLACE FUNCTION public.set_current_season(p_season_id uuid, p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE seasons SET is_current = false WHERE club_id = p_club_id;
  UPDATE seasons SET is_current = true WHERE id = p_season_id AND club_id = p_club_id;
END;
$$;
```

---

### Tipo `Season` — adicionar a `database.types.ts`

Adicionar à secção `Tables` em `Database["public"]["Tables"]`:

```ts
seasons: {
  Row: {
    id: string
    club_id: string
    name: string
    start_date: string
    end_date: string
    is_current: boolean
    created_at: string
  }
  Insert: {
    id?: string
    club_id: string
    name: string
    start_date: string
    end_date: string
    is_current?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    club_id?: string
    name?: string
    start_date?: string
    end_date?: string
    is_current?: boolean
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "seasons_club_id_fkey"
      columns: ["club_id"]
      isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
  ]
}
```

---

### Zod Schemas — `src/lib/schemas/seasons.ts`

```ts
import { z } from "zod";

export const SeasonCreateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(50, "Nome demasiado longo"),
  startDate: z.string().date("Data de início inválida"),
  endDate: z.string().date("Data de fim inválida"),
  setAsCurrent: z.boolean().default(false),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: "Data de fim deve ser posterior à data de início", path: ["endDate"] }
);

export const SeasonUpdateSchema = z.object({
  id: z.string().uuid("ID de época inválido"),
  name: z.string().min(1, "Nome obrigatório").max(50, "Nome demasiado longo"),
  startDate: z.string().date("Data de início inválida"),
  endDate: z.string().date("Data de fim inválida"),
  setAsCurrent: z.boolean().default(false),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: "Data de fim deve ser posterior à data de início", path: ["endDate"] }
);

export type SeasonCreate = z.infer<typeof SeasonCreateSchema>;
export type SeasonUpdate = z.infer<typeof SeasonUpdateSchema>;
export type Season = {
  id: string;
  club_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};
```

---

### Server Actions — `src/lib/actions/seasons.ts`

```ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/actions/audit";
import { SeasonCreateSchema, SeasonUpdateSchema } from "@/lib/schemas/seasons";
import type { SeasonCreate, SeasonUpdate, Season } from "@/lib/schemas/seasons";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

async function getAuthContext() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

export async function getSeasonsForClub(): Promise<Result<Season[], AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("club_id", profile.club_id)
    .order("start_date", { ascending: false });

  if (error) return err({ code: "unknown", message: error.message });
  return ok((data ?? []) as Season[]);
}

export async function getCurrentSeason(): Promise<Result<Season | null, AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("club_id", profile.club_id)
    .eq("is_current", true)
    .maybeSingle();

  if (error) return err({ code: "unknown", message: error.message });
  return ok(data as Season | null);
}

export async function createSeason(input: SeasonCreate): Promise<Result<Season, AppError>> {
  const validated = SeasonCreateSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      club_id: profile.club_id,
      name: validated.data.name,
      start_date: validated.data.startDate,
      end_date: validated.data.endDate,
      is_current: false,  // set via RPC if needed
    })
    .select("*")
    .single();

  if (error) return err({ code: "unknown", message: error.message });
  const season = data as Season;

  if (validated.data.setAsCurrent) {
    const { error: rpcError } = await supabase.rpc("set_current_season", {
      p_season_id: season.id,
      p_club_id: profile.club_id,
    });
    if (rpcError) return err({ code: "unknown", message: rpcError.message });
  }

  try {
    await logAccess("season.created", "season", season.id);
  } catch (e) {
    console.error("audit log failed", e);
  }

  return ok(season);
}

export async function updateSeason(input: SeasonUpdate): Promise<Result<Season, AppError>> {
  const validated = SeasonUpdateSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .update({
      name: validated.data.name,
      start_date: validated.data.startDate,
      end_date: validated.data.endDate,
    })
    .eq("id", validated.data.id)
    .eq("club_id", profile.club_id)  // multi-tenant isolation
    .select("*")
    .single();

  if (error) return err({ code: "unknown", message: error.message });
  const season = data as Season;

  if (validated.data.setAsCurrent) {
    const { error: rpcError } = await supabase.rpc("set_current_season", {
      p_season_id: season.id,
      p_club_id: profile.club_id,
    });
    if (rpcError) return err({ code: "unknown", message: rpcError.message });
  }

  try {
    await logAccess("season.updated", "season", season.id);
  } catch (e) {
    console.error("audit log failed", e);
  }

  return ok(season);
}
```

---

### Hook `useSeasonView` — `src/hooks/useSeasonView.ts`

```ts
"use client";

import { useState, useEffect } from "react";

export type SeasonView = "current" | "cumulative";

const STORAGE_KEY = "season_view";

export function useSeasonView(): [SeasonView, (view: SeasonView) => void] {
  const [view, setView] = useState<SeasonView>("current");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "current" || stored === "cumulative") {
      setView(stored);
    }
  }, []);

  function setAndPersist(v: SeasonView) {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  }

  return [view, setAndPersist];
}
```

**IMPORTANTE:** Usar `useEffect` para ler o localStorage evita hydration mismatch no SSR.

---

### Componente `<SeasonToggle>` — `src/components/ui/season-toggle.tsx`

```tsx
"use client";

import { useSeasonView } from "@/hooks/useSeasonView";
import type { Season } from "@/lib/schemas/seasons";

interface SeasonToggleProps {
  currentSeason: Season | null;
}

export function SeasonToggle({ currentSeason }: SeasonToggleProps) {
  const [view, setView] = useSeasonView();

  if (!currentSeason) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem época atual definida.{" "}
        <a href="/configuracoes/epocas" className="underline">
          Configurar
        </a>
      </p>
    );
  }

  return (
    <div className="flex gap-1 rounded-full border p-0.5 text-sm">
      <button
        className={`rounded-full px-3 py-1 transition-colors ${
          view === "current"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setView("current")}
      >
        {currentSeason.name}
      </button>
      <button
        className={`rounded-full px-3 py-1 transition-colors ${
          view === "cumulative"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setView("cumulative")}
      >
        Cumulativo
      </button>
    </div>
  );
}
```

---

### Componente `<SeasonForm>` — `src/app/configuracoes/epocas/season-form.tsx`

```tsx
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { createSeason, updateSeason } from "@/lib/actions/seasons";
import {
  SeasonCreateSchema,
  SeasonUpdateSchema,
  type SeasonCreate,
  type SeasonUpdate,
  type Season,
} from "@/lib/schemas/seasons";

interface SeasonFormProps {
  mode: "create";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SeasonEditFormProps {
  mode: "edit";
  season: Season;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Props = SeasonFormProps | SeasonEditFormProps;

export function SeasonForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = props.mode === "edit";
  const season = isEdit ? props.season : undefined;

  const form = useForm<SeasonCreate | SeasonUpdate>({
    resolver: zodResolver(isEdit ? SeasonUpdateSchema : SeasonCreateSchema),
    defaultValues: isEdit
      ? {
          id: season!.id,
          name: season!.name,
          startDate: season!.start_date,
          endDate: season!.end_date,
          setAsCurrent: season!.is_current,
        }
      : { name: "", startDate: "", endDate: "", setAsCurrent: false },
  });

  function onSubmit(data: SeasonCreate | SeasonUpdate) {
    startTransition(async () => {
      const result = isEdit
        ? await updateSeason(data as SeasonUpdate)
        : await createSeason(data as SeasonCreate);

      if (!result.ok) {
        form.setError("root", { message: result.error.message });
        return;
      }

      props.onOpenChange(false);
      const param = isEdit ? "actualizada=1" : "criada=1";
      router.push(`/configuracoes/epocas?${param}`);
      router.refresh();
    });
  }

  return (
    <DrillDownSheet open={props.open} onOpenChange={props.onOpenChange}>
      <h2 className="text-base font-semibold mb-4">
        {isEdit ? "Editar época" : "Nova época"}
      </h2>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nome</label>
          <input
            type="text"
            maxLength={50}
            placeholder="ex: 2026/27"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Data de início</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("startDate")}
          />
          {form.formState.errors.startDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.startDate.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Data de fim</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2 text-sm"
            {...form.register("endDate")}
          />
          {form.formState.errors.endDate && (
            <p className="text-xs text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="setAsCurrent"
            className="h-4 w-4"
            {...form.register("setAsCurrent")}
          />
          <label htmlFor="setAsCurrent" className="text-sm">
            Definir como época atual
          </label>
        </div>

        {form.formState.errors.root && (
          <p className="text-xs text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "A guardar…" : isEdit ? "Actualizar" : "Criar época"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => props.onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </DrillDownSheet>
  );
}
```

---

### Página `/configuracoes/epocas/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSeasonsForClub } from "@/lib/actions/seasons";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
// SeasonForm is "use client" — import handled via client component wrapper
import { SeasonsPageClient } from "./seasons-page-client";

export const metadata = { title: "Épocas" };

export default async function EpocasPage({
  searchParams,
}: {
  searchParams: Promise<{ criada?: string; actualizada?: string }>;
}) {
  // Auth check (outside (staff) route group — must verify manually)
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  const result = await getSeasonsForClub();
  const seasons = result.ok ? result.data : [];

  const { criada, actualizada } = await searchParams;

  return (
    <main id="main-content">
      <StickyHeader title="Épocas" backHref="/configuracoes" />
      <div className="px-4 py-6 sm:px-6">
        {criada === "1" && <CalmConfirmation message="Época criada" />}
        {actualizada === "1" && <CalmConfirmation message="Época actualizada" />}
        <SeasonsPageClient seasons={seasons} />
      </div>
    </main>
  );
}
```

**Nota:** Criar `seasons-page-client.tsx` como Client Component que encapsula o estado de abertura dos sheets e lista de épocas. Isso mantém a page.tsx como Server Component enquanto `<SeasonForm>` é Client Component.

---

### Padrão de Testes

```ts
// project-r/src/__tests__/lib/actions/seasons.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeasonCreateSchema, SeasonUpdateSchema } from "@/lib/schemas/seasons";

// Mock Supabase — mesmo padrão das stories anteriores
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({
        data: table === "profiles"
          ? { club_id: "club-a", role: "analyst" }
          : { id: "season-1", club_id: "club-a", name: "2026/27",
              start_date: "2026-08-01", end_date: "2027-06-30",
              is_current: false, created_at: "2026-05-18T00:00:00Z" },
        error: null,
      })),
    })),
    rpc: vi.fn(async () => ({ error: null })),
  })),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn(async () => ({ ok: true, data: undefined })),
}));

describe("SeasonCreateSchema", () => {
  it("aceita dados válidos", () => {
    const result = SeasonCreateSchema.safeParse({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
      setAsCurrent: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando end <= start", () => {
    const result = SeasonCreateSchema.safeParse({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2026-07-01",  // antes do start
      setAsCurrent: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("posterior");
  });

  it("rejeita nome vazio", () => {
    const result = SeasonCreateSchema.safeParse({
      name: "",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita nome com mais de 50 chars", () => {
    const result = SeasonCreateSchema.safeParse({
      name: "x".repeat(51),
      startDate: "2026-08-01",
      endDate: "2027-06-30",
    });
    expect(result.success).toBe(false);
  });
});
```

---

## Inventário de Ficheiros

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `project-r/supabase/migrations/000110_seasons.sql` | NEW | CREATE TABLE seasons + índices + RLS + RPC |
| `project-r/src/lib/supabase/database.types.ts` | UPDATE | Adicionar tipo `seasons` (Row, Insert, Update, Relationships) |
| `project-r/src/lib/schemas/seasons.ts` | NEW | SeasonCreateSchema, SeasonUpdateSchema, types |
| `project-r/src/lib/actions/seasons.ts` | NEW | getSeasonsForClub, getCurrentSeason, createSeason, updateSeason |
| `project-r/src/hooks/useSeasonView.ts` | NEW | useSeasonView hook (localStorage, SSR-safe) |
| `project-r/src/components/ui/season-toggle.tsx` | NEW | SeasonToggle client component |
| `project-r/src/app/configuracoes/epocas/page.tsx` | NEW | Server Component com auth check + lista épocas |
| `project-r/src/app/configuracoes/epocas/season-form.tsx` | NEW | Client Component: DrillDownSheet + form |
| `project-r/src/app/configuracoes/epocas/seasons-page-client.tsx` | NEW | Client Component wrapper para state de abertura |
| `project-r/src/app/configuracoes/page.tsx` | UPDATE | Adicionar link para /configuracoes/epocas |
| `project-r/src/__tests__/lib/schemas/seasons.test.ts` | NEW | Testes Zod |
| `project-r/src/__tests__/lib/actions/seasons.test.ts` | NEW | Testes server actions |
| `project-r/src/__tests__/hooks/useSeasonView.test.ts` | NEW | Testes hook localStorage |
| `project-r/src/__tests__/components/season-form.test.tsx` | NEW | Testes componente form |

---

## Previous Story Intelligence

**Story 2.4: Marcar Jogador como Inactivo** (done — 2026-05-18)

- `useTransition()` é obrigatório para Server Actions em Client Components (NÃO try/catch com redirect)
- Redirect dentro de Server Action lança um erro do Next.js — chamar **fora** de try/catch
- `profile.club_id` pode ser null → verificar antes de usar: `if (!profile?.club_id)`
- Verificar estado do registo antes de UPDATE (ex: player arquivado não pode ser inactivado)
- `SELECT ... .single()` após UPDATE para verificar que realmente ocorreu
- Zod v4: usar `.issues[0]?.message` (não `.errors`)
- `logAccess()` é fire-and-forget: envolver em `try { await logAccess(...) } catch { console.error }`
- `noUncheckedIndexedAccess`: `arr?.[0] ?? fallback`

**Story 2.3: Player Metrics Time Series** (done — 2026-05-18)

- `EmptyState` usa props `icon`, `title`, `description`, `cta` — **NÃO** `action`
- `datetime-local` necessita conversão para ISO; para datas simples (date), usar z.string().date()
- `updatePayload` tipado como `Record<string, unknown>` evita erro TS2345 do Supabase v2

**Story 2.2 + 2.1** (padrões estabelecidos):
- Server Action: verificar user → verificar profile.club_id → operar → logAccess
- `Result<T, E>`: `result.ok`, `result.data`, `result.error.message`
- `newId()` de `@/lib/uuid` para gerar UUIDs no cliente (se necessário)

**Padrões críticos:**
1. `"use server"` no topo de todos os server actions files
2. `React 19`: **não** importar `React` em `.tsx`
3. `noUncheckedIndexedAccess`: `arr?.[0] ?? fallback`
4. `Zod v4`: `.issues` (não `.errors`)
5. Testes correm de `project-r/` com `npm run test --run`
6. Imports com aliases `@/` (NUNCA caminhos relativos)
7. `date-fns` com `ptPT` locale para formatação de datas ao utilizador

---

## Git Intelligence Summary

```
85d6fda fix: remove authorization header verification from auth-hook
44f5fa0 fix: enhance logging in auth-hook for better error tracking
e1eb7ff docs: add authentication testing guide and login fix documentation
264a4b0 Refactor access control logic in proxy function
e0be053 Enhance login navigation error handling with additional logging
```

Os últimos commits são de fixes ao auth-hook — não directamente relevantes para esta story. Seguir os padrões estabelecidos nas Stories 2.1–2.4.

### Padrão de Commit Sugerido

```
feat(2-5): season management — migration 000110, seasons CRUD, set_current_season RPC, useSeasonView hook
```

---

## Latest Tech Information

### Supabase RPC com `.rpc()`

- Sintaxe: `supabase.rpc("function_name", { param1: value1, param2: value2 })`
- Retorna `{ data, error }` como qualquer query
- Verificar `error` antes de prosseguir
- `SECURITY DEFINER` na função contorna RLS — usar apenas para operações que requerem atomicidade entre múltiplos registos do mesmo clube

### `localStorage` com SSR (Next.js App Router)

- `localStorage` não existe no servidor → usar `useEffect` para leitura inicial
- Estado começa com o default ("current") e sincroniza no cliente via `useEffect`
- Evita hydration mismatch

### `z.string().date()` (Zod v4)

- Valida strings no formato `YYYY-MM-DD` (ISO date, sem hora)
- Retorna `string` (não `Date` object) — compatível com inputs `type="date"` e com Supabase `date` columns
- `.refine(end > start)` funciona correctamente porque strings ISO de data têm ordenação lexicográfica correcta

### Supabase `.maybeSingle()` vs `.single()`

- `.single()` — lança erro se 0 ou 2+ rows (use quando esperas exactamente 1)
- `.maybeSingle()` — retorna `null` se 0 rows, erro se 2+ rows (use para queries opcionais como `getCurrentSeason`)
- Para `getCurrentSeason()`: usar `.maybeSingle()` pois pode não existir época atual

---

## Project Context Reference

```
ProjectR/ (git root)
├── project-r/
│   ├── supabase/
│   │   └── migrations/
│   │       ├── 000095_players_inactive.sql   (Story 2.4)
│   │       ├── 000096_player_invite.sql      (Story 2.10)
│   │       ├── 000097_rls_policy_migration.sql
│   │       ├── 000100_telemetry_events.sql
│   │       └── 000110_seasons.sql            ← NEW (esta story)
│   └── src/
│       ├── hooks/
│       │   └── useSeasonView.ts              ← NEW
│       ├── lib/
│       │   ├── actions/
│       │   │   ├── audit.ts                  ← usar logAccess() (fire-and-forget)
│       │   │   └── seasons.ts                ← NEW
│       │   ├── schemas/
│       │   │   └── seasons.ts                ← NEW
│       │   ├── types.ts                      ← Result<T,E>, ok(), err()
│       │   └── supabase/database.types.ts    ← UPDATE (seasons table)
│       ├── components/ui/
│       │   ├── drill-down-sheet.tsx          ← usar (já existe)
│       │   ├── calm-confirmation.tsx         ← usar (já existe)
│       │   ├── empty-state.tsx               ← usar (props: icon, title, description, cta)
│       │   ├── button.tsx                    ← usar (já existe)
│       │   └── season-toggle.tsx             ← NEW
│       └── app/
│           ├── configuracoes/
│           │   ├── page.tsx                  ← UPDATE (link para /epocas)
│           │   └── epocas/
│           │       ├── page.tsx              ← NEW (Server Component)
│           │       ├── season-form.tsx       ← NEW (Client Component)
│           │       └── seasons-page-client.tsx ← NEW (Client Component wrapper)
│           └── (staff)/layout.tsx            ← NÃO modificar (configuracoes está fora)
```

**Referências normativas:**
- FR20: Treinador e Analista podem criar e gerir épocas e visualizar dados filtrados por época ou cumulativos
- NFR1: Índices em colunas de filtro frequente (`club_id`)
- AR8: RLS em todas as tabelas; isolamento por `club_id`
- NFR54: Cobertura de testes ≥80%

---

## Change Log

| Data | Alteração |
|------|-----------|
| 2026-05-18 | Implementação completa da Story 2.5: migração 000110_seasons, schemas Zod, server actions CRUD, hook useSeasonView, SeasonToggle, SeasonForm, página /configuracoes/epocas, link em /configuracoes, 27 testes novos (543 total). StickyHeader actualizado com backHref. |

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Migração `000110_seasons.sql` criada com tabela `seasons`, índice único parcial `idx_seasons_one_current` (garante 1 época atual por clube), índice de performance `idx_seasons_club`, RLS com 3 políticas (SELECT/INSERT/UPDATE) e função RPC `set_current_season` SECURITY DEFINER para troca atómica.
- `database.types.ts` actualizado com tipo `seasons` (Row, Insert, Update, Relationships) e função `set_current_season` na secção Functions.
- Schemas Zod `SeasonCreateSchema` e `SeasonUpdateSchema` com refine `endDate > startDate`. Usados `z.input<>` nos formulários para compatibilidade com zodResolver e `.default()`.
- Server Actions `getSeasonsForClub`, `getCurrentSeason`, `createSeason`, `updateSeason` com isolamento multi-tenant via `club_id`, RPC call para `set_current_season` e `logAccess` fire-and-forget.
- Hook `useSeasonView` com SSR-safe localStorage (useEffect para evitar hydration mismatch). Componente `<SeasonToggle>` com degradação graciosa quando `currentSeason === null`.
- `<SeasonForm>` refatorado em `SeasonCreateForm` + `SeasonEditForm` (sub-componentes internos) para evitar union type complexo com react-hook-form. `useTransition()` em vez de try/catch com redirect.
- Página `/configuracoes/epocas` como Server Component com auth check manual (fora do route group `(staff)`). Client wrapper `SeasonsPageClient` encapsula estado de abertura dos sheets.
- `StickyHeader` actualizado com prop opcional `backHref` (link de voltar).
- `/configuracoes/page.tsx` actualizado com link para `/configuracoes/epocas`.
- 27 novos testes escritos (schemas Zod, server actions, hook localStorage, componente form). 543 testes a passar (base: 442). 0 erros de lint. Typecheck ✅. Build ✅.

### File List

- `project-r/supabase/migrations/000110_seasons.sql` (NEW)
- `project-r/src/lib/supabase/database.types.ts` (UPDATE)
- `project-r/src/lib/schemas/seasons.ts` (NEW)
- `project-r/src/lib/actions/seasons.ts` (NEW)
- `project-r/src/hooks/useSeasonView.ts` (NEW)
- `project-r/src/components/ui/season-toggle.tsx` (NEW)
- `project-r/src/components/patterns/StickyHeader.tsx` (UPDATE — adicionado prop `backHref`)
- `project-r/src/app/configuracoes/epocas/page.tsx` (NEW)
- `project-r/src/app/configuracoes/epocas/season-form.tsx` (NEW)
- `project-r/src/app/configuracoes/epocas/seasons-page-client.tsx` (NEW)
- `project-r/src/app/configuracoes/page.tsx` (UPDATE)
- `project-r/src/__tests__/lib/schemas/seasons.test.ts` (NEW)
- `project-r/src/__tests__/lib/actions/seasons.test.ts` (NEW)
- `project-r/src/__tests__/hooks/useSeasonView.test.ts` (NEW)
- `project-r/src/__tests__/components/season-form.test.tsx` (NEW)
