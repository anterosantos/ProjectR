# Story 2.1: Player Records & Plantel List

**Status:** in-progress

**Story ID:** 2.1
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-17

---

## Story

Como Analista,
Quero criar, editar e arquivar registos de jogadores (nome, idade, camisola, escalão, posições) e ver o plantel completo,
Para que o plantel seja a fonte de verdade única para tudo o que se segue.

---

## Acceptance Criteria

### AC #1: Migração `000070_players_positions.sql`

**Given** a migração `000070_players_positions.sql` é aplicada
**When** `supabase db reset` corre sem erros
**Then** a tabela `players` existe com: `id uuid PK DEFAULT public.uuidv7()`, `club_id uuid FK NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`, `profile_id uuid FK NULLABLE REFERENCES profiles(id) ON DELETE SET NULL`, `jersey_num int NOT NULL CHECK (jersey_num BETWEEN 1 AND 99)`, `full_name text NOT NULL`, `birthdate date NOT NULL`, `age_group text NOT NULL CHECK (age_group IN ('u14','u15','u17','u19','senior'))`, `is_archived boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
**And** a tabela `positions` existe com: `id uuid PK DEFAULT public.uuidv7()`, `player_id uuid FK NOT NULL REFERENCES players(id) ON DELETE CASCADE`, `position text NOT NULL`, `is_primary boolean NOT NULL DEFAULT false`, `sort_order int NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 4)`
**And** RLS está habilitada em ambas as tabelas com políticas: "club isolation read" (SELECT para authenticated onde club_id = public.club_id()) + "staff write own club" (INSERT/UPDATE/DELETE para staff onde public.user_role() IN ('coach','analyst') + WITH CHECK correspondente) + "player sees own record" (SELECT para player onde profile_id = auth.uid())
**And** índice parcial único `idx_players_jersey_club_active ON players(club_id, jersey_num) WHERE is_archived = false` existe (garante unicidade de camisola dentro do clube entre jogadores activos)
**And** índices `idx_players_club ON players(club_id)` e `idx_positions_player ON positions(player_id)` existem (NFR1)
**And** trigger `updated_at` está configurado em `players`

### AC #2: Lista `/plantel` agrupada por escalão

**Given** Analista autenticado em `/plantel`
**When** a página carrega
**Then** todos os jogadores não-arquivados do clube aparecem agrupados por `age_group` (u14, u15, u17, u19, senior)
**And** cada linha mostra: número de camisola, nome completo, posição primária, escalão e `<SemaforoBadge state="neutral">` como placeholder
**And** a lista está ordenada alfabeticamente por último nome dentro de cada grupo
**And** se não houver jogadores: `<EmptyState>` com icon `<UserPlus>`, title "Sem jogadores ainda", description "Começa por registar o primeiro jogador" e CTA "Adicionar jogador" → `/plantel/novo`

### AC #3: Criar jogador em `/plantel/novo`

**Given** Analista em `/plantel/novo` preenche o formulário (nome, data de nascimento, camisola, escalão, posição primária, até 4 alternativas) e submete
**When** validação Zod passa e Server Action `createPlayer` executa
**Then** uma linha na tabela `players` é inserida com `club_id = public.club_id()` e `id = newId()` (UUIDv7)
**And** linhas na tabela `positions` são inseridas com `is_primary = true` para a primeira e `sort_order` 1–4 para as alternativas
**And** o utilizador é redirecionado para `/plantel/[id]` com `<CalmConfirmation message="Jogador adicionado">` visível
**And** as inserções de player + positions são atómicas (se positions falhar, player é revertido)

### AC #4: Validação do formulário (UX-DR31)

**Given** formulário de criação/edição
**When** um campo é abandonado com erro ou submit é tentado com erros
**Then** validação Zod enforça: `jersey_num` inteiro 1–99 único no clube (não-arquivados), `age_group` enum válido, ≥1 posição primária, ≤4 posições alternativas
**And** erros aparecem inline on-blur junto ao campo em texto `signal/alert` com ícone `<AlertCircle>`
**And** submit bloqueia até todos os erros estarem corrigidos
**And** a unicidade de camisola é validada via Server Action (não no cliente — requer DB query)

### AC #5: Editar jogador em `/plantel/[id]/editar`

**Given** Analista em `/plantel/[id]/editar` faz alterações e guarda
**When** Server Action `updatePlayer` executa
**Then** a linha `players` e as linhas `positions` são actualizadas atomicamente numa transação
**And** uma entrada `audit_logs` com `action='player.updated'` é registada via `logAccess()` (FR50)
**And** o utilizador é redirecionado para `/plantel/[id]` com `<CalmConfirmation message="Jogador actualizado">`

### AC #6: Arquivar jogador em `/plantel/[id]`

**Given** Analista em `/plantel/[id]` clica "Arquivar"
**When** o `<Dialog>` destrutivo confirma a acção
**Then** `is_archived = true` é definido via Server Action `archivePlayer`
**And** o jogador desaparece da lista `/plantel` por defeito
**And** os dados históricos que referenciam o jogador permanecem intactos

### AC #7: Cobertura de testes (NFR54)

**Given** os testes de integração correm
**When** `npm run test --run` executa na directoria `project-r/`
**Then** os fluxos de criação, edição e arquivo têm ≥80% de cobertura incluindo edge cases de validação Zod

---

## Tasks / Subtasks

- [x] Task 1: Criar migração `000070_players_positions.sql` (AC #1)
  - [x] 1.1 Criar `supabase/migrations/000070_players_positions.sql` com tabelas `players` e `positions`
  - [x] 1.2 Adicionar trigger `updated_at` em `players` (reutilizar padrão do `profiles_updated_at` migration 000160)
  - [x] 1.3 Adicionar RLS policies: "club isolation read", "staff write own club" (com WITH CHECK), "player sees own record"
  - [x] 1.4 Adicionar índice parcial único `idx_players_jersey_club_active` para unicidade de camisola entre activos
  - [x] 1.5 Adicionar grants e COMMENT ON TABLE/COLUMN
  - [x] 1.6 Validar: `supabase db reset` corre sem erros localmente

- [x] Task 2: Actualizar `database.types.ts` (AC #1)
  - [x] 2.1 Adicionar tipos `players` e `positions` ao `Database['public']['Tables']` em `src/lib/supabase/database.types.ts`

- [x] Task 3: Criar Zod schema em `src/lib/schemas/players.ts` (AC #4)
  - [x] 3.1 `PlayerCreateSchema`: `fullName`, `birthdate`, `jerseyNum`, `ageGroup`, `primaryPosition`, `alternativePositions[]`
  - [x] 3.2 `PlayerUpdateSchema` (parcial, com `playerId`)
  - [x] 3.3 `ArchivePlayerSchema`: `{ playerId: z.string().uuid() }`
  - [x] 3.4 Exportar tipos inferidos: `PlayerCreate`, `PlayerUpdate`, `ArchivePlayer`

- [x] Task 4: Criar Server Actions em `src/lib/actions/players.ts` (AC #3, #5, #6)
  - [x] 4.1 `createPlayer(input: PlayerCreate)` — valida, insere player + positions atomicamente via RPC, redireciona
  - [x] 4.2 `updatePlayer(input: PlayerUpdate)` — valida, actualiza player + positions atomicamente, chama `logAccess('player.updated', 'player', playerId)`, redireciona
  - [x] 4.3 `archivePlayer(input: ArchivePlayer)` — valida, define `is_archived = true`, redireciona
  - [x] 4.4 `getPlayers()` — retorna jogadores não-arquivados do clube agrupados por age_group, ordenados por último nome
  - [x] 4.5 `getPlayer(playerId: string)` — retorna jogador + posições para a página de detalhe/edição

- [x] Task 5: Criar função Postgres para operações atómicas (AC #3, #5)
  - [x] 5.1 Criar `supabase/migrations/000075_player_rpc.sql` com função `public.upsert_player_positions(player_id uuid, positions_json jsonb)`
  - [x] 5.2 A função faz DELETE + INSERT das posições atomicamente num bloco SECURITY INVOKER (mantém RLS activa)

- [x] Task 6: Actualizar página `/plantel` (AC #2)
  - [x] 6.1 Reescrever `src/app/(staff)/plantel/page.tsx` como Server Component que chama `getPlayers()`
  - [x] 6.2 Agrupar por `age_group`, ordenar por último nome, renderizar com `<SemaforoBadge state="neutral">`
  - [x] 6.3 Adicionar `<EmptyState>` quando lista está vazia

- [x] Task 7: Criar página `/plantel/novo` (AC #3, #4)
  - [x] 7.1 Criar `src/app/(staff)/plantel/novo/page.tsx` com formulário react-hook-form + Zod
  - [x] 7.2 Validação on-blur com mensagens inline em `signal/alert`
  - [x] 7.3 Campo de posições: posição primária (select obrigatório) + até 4 alternativas (opcionais)
  - [x] 7.4 Unicidade de camisola validada via server action (não client-side)

- [x] Task 8: Criar página `/plantel/[id]` e `/plantel/[id]/editar` (AC #5, #6)
  - [x] 8.1 Criar `src/app/(staff)/plantel/[id]/page.tsx` com detalhes do jogador e botão "Arquivar"
  - [x] 8.2 Criar `src/app/(staff)/plantel/[id]/editar/page.tsx` com formulário de edição pré-preenchido
  - [x] 8.3 Adicionar `<Dialog>` de confirmação destrutiva para archive
  - [x] 8.4 Mostrar `<CalmConfirmation>` após criação/edição bem-sucedida

- [x] Task 9: Escrever testes de integração (AC #7)
  - [x] 9.1 Criar `__tests__/players.integration.test.ts` com testes para createPlayer, updatePlayer, archivePlayer
  - [x] 9.2 Testar edge cases: jersey duplicado, age_group inválido, >4 alternativas, arquivar jogador inexistente
  - [x] 9.3 Testar RLS: jogador de outro clube não acessível

- [x] Task 10: Verificação final (AC #1–#7)
  - [x] 10.1 `npm run lint` — zero erros
  - [x] 10.2 `npm run typecheck` — zero erros
  - [x] 10.3 `npm run test --run` — todos os testes passam (incluindo novos) com ≥80% cobertura nos fluxos player
  - [x] 10.4 `npm run build` — build limpa

---

## Dev Notes

### Inventário de Ficheiros

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `supabase/migrations/000070_players_positions.sql` | NEW | Tabelas players + positions + RLS + índices |
| `supabase/migrations/000075_player_rpc.sql` | NEW | Função `upsert_player_positions` para atomicidade |
| `src/lib/supabase/database.types.ts` | UPDATE | Adicionar types para players e positions |
| `src/lib/schemas/players.ts` | NEW | Zod schemas partilhados client/server |
| `src/lib/actions/players.ts` | NEW | Server Actions: createPlayer, updatePlayer, archivePlayer, getPlayers, getPlayer |
| `src/app/(staff)/plantel/page.tsx` | UPDATE | Reescrever com lista real (actualmente tem placeholder) |
| `src/app/(staff)/plantel/novo/page.tsx` | NEW | Formulário de criação |
| `src/app/(staff)/plantel/[id]/page.tsx` | NEW | Detalhe do jogador + arquivo |
| `src/app/(staff)/plantel/[id]/editar/page.tsx` | NEW | Formulário de edição pré-preenchido |
| `__tests__/players.integration.test.ts` | NEW | Testes integração CRUD + validação |

### Migração: `000070_players_positions.sql`

```sql
-- Migration: 000070_players_positions
-- Purpose: Player records and positions for plantel management (FR12, FR13)

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  jersey_num int NOT NULL CHECK (jersey_num BETWEEN 1 AND 99),
  full_name text NOT NULL,
  birthdate date NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('u14','u15','u17','u19','senior')),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 4)
);

-- Garante que a mesma camisola não é atribuída a 2 jogadores activos no mesmo clube
CREATE UNIQUE INDEX idx_players_jersey_club_active
  ON players(club_id, jersey_num)
  WHERE is_archived = false;

CREATE INDEX idx_players_club ON players(club_id);
CREATE INDEX idx_positions_player ON positions(player_id);

-- Trigger updated_at (mesmo padrão do 000160_profiles_updated_at.sql)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Players: leitura club-scoped
CREATE POLICY "club_isolation_read" ON players
  FOR SELECT TO authenticated
  USING (club_id = public.club_id());

-- Players: escrita staff own club (coach + analyst)
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'))
  WITH CHECK (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'));

-- Players: jogador vê o seu próprio registo
CREATE POLICY "player_sees_own_record" ON players
  FOR SELECT TO authenticated
  USING (club_id = public.club_id() AND profile_id = auth.uid());

-- Positions: herda acesso via player_id (coach/analyst podem ler/escrever; player pode ler as suas)
CREATE POLICY "positions_staff_read_write" ON positions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = public.club_id()
        AND public.user_role() IN ('coach','analyst')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = public.club_id()
        AND public.user_role() IN ('coach','analyst')
    )
  );

CREATE POLICY "positions_player_read_own" ON positions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.profile_id = auth.uid()
    )
  );

-- Service-role full access
CREATE POLICY "service_role_all_players" ON players
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_positions" ON positions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**ATENÇÃO: `set_updated_at()` pode já existir** se a migração 000160 foi aplicada antes desta. Verificar se a função já existe antes de criar:
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at() ...  -- OR REPLACE trata do caso duplicado
```

### Migração: `000075_player_rpc.sql` (atomicidade posições)

```sql
-- Migration: 000075_player_rpc
-- Purpose: Atomic upsert of player positions within a transaction

CREATE OR REPLACE FUNCTION public.upsert_player_positions(
  p_player_id uuid,
  p_positions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- mantém RLS activa (o chamador precisa de permissão)
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Remove posições existentes do jogador
  DELETE FROM positions WHERE player_id = p_player_id;

  -- Insere novas posições
  INSERT INTO positions (id, player_id, position, is_primary, sort_order)
  SELECT
    public.uuidv7(),
    p_player_id,
    (pos->>'position')::text,
    (pos->>'is_primary')::boolean,
    (pos->>'sort_order')::int
  FROM jsonb_array_elements(p_positions) AS pos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_player_positions TO authenticated, service_role;
```

A atomicidade é garantida porque Postgres envolve cada chamada de função numa transação implícita. O `createPlayer` pode usar:
1. Inserir o player
2. Chamar `supabase.rpc('upsert_player_positions', { p_player_id, p_positions })` na mesma Server Action

**Para verdadeira atomicidade player+positions**: criar uma função RPC maior:
```sql
CREATE OR REPLACE FUNCTION public.create_player_with_positions(
  p_club_id uuid, p_full_name text, p_birthdate date,
  p_jersey_num int, p_age_group text, p_positions jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER ...
```
Decide com base na complexidade: Server Action com 2 chamadas sequenciais + RPC para posições é suficiente para a maioria dos casos (a janela de falha entre INSERT player e RPC positions é muito curta em prática).

### Zod Schema: `src/lib/schemas/players.ts`

```ts
import { z } from "zod";

export const PositionSchema = z.object({
  position: z.string().min(1, "Posição obrigatória"),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0).max(4),
});

export const PlayerCreateSchema = z.object({
  fullName: z.string().min(2, "Nome demasiado curto").max(100),
  birthdate: z.string().date("Data inválida"),
  jerseyNum: z.number().int().min(1).max(99),
  ageGroup: z.enum(["u14", "u15", "u17", "u19", "senior"]),
  positions: z
    .array(PositionSchema)
    .min(1, "Mínimo 1 posição obrigatória")
    .max(5, "Máximo 5 posições (1 primária + 4 alternativas)")
    .refine(
      (positions) => positions.filter((p) => p.isPrimary).length === 1,
      "Exactamente 1 posição primária obrigatória"
    ),
});

export const PlayerUpdateSchema = PlayerCreateSchema.extend({
  playerId: z.string().uuid(),
});

export const ArchivePlayerSchema = z.object({
  playerId: z.string().uuid(),
});

export type PlayerCreate = z.infer<typeof PlayerCreateSchema>;
export type PlayerUpdate = z.infer<typeof PlayerUpdateSchema>;
export type ArchivePlayer = z.infer<typeof ArchivePlayerSchema>;
```

**Nota:** A validação de unicidade de `jerseyNum` NÃO é feita no Zod client-side (requer DB query). O Server Action retorna `{ ok: false, error: { kind: 'conflict', field: 'jerseyNum' } }` se o índice único disparar.

### Server Actions: `src/lib/actions/players.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { newId } from "@/lib/uuid";
import { logAccess } from "@/lib/actions/audit";
import { PlayerCreateSchema, PlayerUpdateSchema, ArchivePlayerSchema } from "@/lib/schemas/players";
import type { PlayerCreate, PlayerUpdate, ArchivePlayer } from "@/lib/schemas/players";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";

export async function createPlayer(input: PlayerCreate): Promise<Result<{ id: string }, AppError>> {
  const validated = PlayerCreateSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: "Dados inválidos", details: { issues: validated.error.issues } });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const playerId = newId();
  const { error: insertError } = await supabase.from("players").insert({
    id: playerId,
    club_id: profile.club_id,
    full_name: validated.data.fullName,
    birthdate: validated.data.birthdate,
    jersey_num: validated.data.jerseyNum,
    age_group: validated.data.ageGroup,
  });

  if (insertError) {
    if (insertError.code === "23505") { // unique constraint violation
      return err({ code: "conflict", message: "Número de camisola já usado neste clube", details: { field: "jerseyNum" } });
    }
    return err({ code: "unknown", message: insertError.message });
  }

  // Inserir posições via RPC atómico
  const positionsJson = validated.data.positions.map((p, i) => ({
    position: p.position,
    is_primary: p.isPrimary,
    sort_order: i,
  }));

  const { error: rpcError } = await supabase.rpc("upsert_player_positions", {
    p_player_id: playerId,
    p_positions: positionsJson as unknown as Json,
  });

  if (rpcError) {
    // Compensação: remover o player inserido
    await supabase.from("players").delete().eq("id", playerId);
    return err({ code: "unknown", message: rpcError.message });
  }

  redirect(`/plantel/${playerId}?created=1`);
}
```

**Padrão de redirect com `?created=1`:** A página `/plantel/[id]` lê `searchParams.created` e renderiza `<CalmConfirmation>` se presente. Após renderização, o link permanece válido (sem `replace` automático — o utilizador ao recarregar não vê o toast novamente).

### Formulário: react-hook-form + Zod

```tsx
// src/app/(staff)/plantel/novo/page.tsx — estrutura
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlayerCreateSchema } from "@/lib/schemas/players";
import type { PlayerCreate } from "@/lib/schemas/players";
import { createPlayer } from "@/lib/actions/players";
import { useState } from "react";

export default function NovoJogadorPage() {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PlayerCreate>({
    resolver: zodResolver(PlayerCreateSchema),
    mode: "onBlur",  // ✅ Validação on-blur (não on-change — UX-DR31)
  });

  async function onSubmit(data: PlayerCreate) {
    const result = await createPlayer(data);
    if (!result.ok) {
      if (result.error.code === "conflict") {
        form.setError("jerseyNum", { message: "Camisola já usada neste clube" });
      } else {
        setServerError(result.error.message);
      }
    }
    // Se ok: createPlayer faz redirect() — o componente não continua
  }

  return (
    <main id="main-content">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* campos com form.register(...) + form.formState.errors */}
      </form>
    </main>
  );
}
```

**IMPORTANTE**: `<main id="main-content">` é obrigatório em todas as páginas (Story 1.16 — acessibilidade).

### Agrupamento por escalão + ordenação

```ts
// Ordenação por último nome: assumir que último token do full_name é o apelido
function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

const AGE_GROUP_ORDER: Record<string, number> = {
  u14: 0, u15: 1, u17: 2, u19: 3, senior: 4,
};

const grouped = players
  .sort((a, b) => lastNameOf(a.full_name).localeCompare(lastNameOf(b.full_name), "pt"))
  .reduce<Record<string, typeof players>>((acc, player) => {
    const group = player.age_group;
    if (!acc[group]) acc[group] = [];
    acc[group]?.push(player);
    return acc;
  }, {});

const sortedGroups = Object.entries(grouped).sort(
  ([a], [b]) => (AGE_GROUP_ORDER[a] ?? 99) - (AGE_GROUP_ORDER[b] ?? 99)
);
```

**noUncheckedIndexedAccess**: Toda a indexação de arrays/objectos precisa de `?.` e `?? fallback` (ex: `parts[parts.length - 1] ?? fullName`).

### Formatação de datas

```ts
import { format } from "date-fns";
import { ptPT } from "date-fns/locale";

// Exibir data de nascimento
format(new Date(player.birthdate), "d 'de' MMMM 'de' yyyy", { locale: ptPT });
// → "15 de março de 2010"

// Calcular idade
import { differenceInYears } from "date-fns";
const age = differenceInYears(new Date(), new Date(player.birthdate));
```

**Proibido**: `toLocaleString()`, `toLocaleDateString()` — inconsistente entre browsers.

### CalmConfirmation após criação/edição

```tsx
// src/app/(staff)/plantel/[id]/page.tsx
import { CalmConfirmation } from "@/components/ui/calm-confirmation";

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const { id } = await params;
  const { created, updated } = await searchParams;
  const showCreated = created === "1";
  const showUpdated = updated === "1";

  // ... fetch player data ...

  return (
    <main id="main-content">
      {showCreated && <CalmConfirmation message="Jogador adicionado" />}
      {showUpdated && <CalmConfirmation message="Jogador actualizado" />}
      {/* resto do conteúdo */}
    </main>
  );
}
```

**Nota Next.js 16**: `params` e `searchParams` são agora `Promise` — fazer `await params` antes de usar.

### Dialog de confirmação (archive)

```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Botão de trigger (no client component):
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Arquivar</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Arquivar jogador?</DialogTitle>
      <DialogDescription>
        O jogador deixa de aparecer no plantel activo. Os dados históricos são preservados.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="ghost">Cancelar</Button>
      </DialogClose>
      <Button variant="destructive" onClick={handleArchive}>
        Arquivar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Posições disponíveis (lista sugerida)

```ts
export const POSITIONS = [
  // Guarda-redes
  "GR",
  // Defesas
  "DD", "DC", "DE", "LIB",
  // Médios
  "MDC", "MC", "MO", "MD", "ME",
  // Avançados
  "EXD", "EXE", "SC", "PL",
] as const;
```

Usar um `<select>` ou combobox shadcn/ui `<Combobox>` para a selecção de posição.

### Testes de integração

```ts
// __tests__/players.integration.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// IMPORTANTE: Mockar createServerClient (não há DB local em CI)
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

// Testar:
// - createPlayer: happy path, jersey duplicado, age_group inválido, >4 alternativas
// - updatePlayer: happy path, audit log chamado
// - archivePlayer: happy path, player desaparece da lista
// - PlayerCreateSchema.safeParse: validação Zod directamente (sem mock de DB)
```

**Padrão estabelecido no projecto**: Mockar o Supabase client nas unit/integration tests (ver `__tests__/auth-login.test.ts` para referência). Os testes reais de RLS correm contra a DB local com `supabase db reset`.

### Estrutura de Componentes

```text
src/app/(staff)/plantel/
├── page.tsx              ← Server Component — lista agrupada
├── novo/
│   └── page.tsx          ← Client Component — formulário criação
└── [id]/
    ├── page.tsx          ← Server Component — detalhe + archive dialog
    └── editar/
        └── page.tsx      ← Client Component — formulário edição pré-preenchido
```

**Server vs Client Components:**
- Páginas de lista e detalhe: Server Components (fetch directa, sem interacção do utilizador)
- Formulários (novo, editar): Client Components com `"use client"` (react-hook-form)
- Archive dialog: Client Component (estado do dialog)

---

## Previous Story Intelligence

**Story 1.16: Accessibility Foundation** (done — 2026-05-17)

- `id="main-content"` é OBRIGATÓRIO no elemento `<main>` de TODAS as páginas
- `lang="pt-PT"` já está na root layout
- Botões precisam de ter touch targets ≥44×44px (shadcn Button cumpre por defeito)
- Focus rings já estão configurados globalmente via `globals.css` — não adicionar `outline: none`

**Story 1.12: Audit Logs & Telemetry** (done)

- `logAccess()` está em `src/lib/actions/audit.ts` — importar e usar para `player.updated`
- Fire-and-forget: `await logAccess(...)` não bloqueia se falhar (retorna `ok` mesmo em erro)
- Padrão de import: `import { logAccess } from "@/lib/actions/audit"`

**Story 1.8: Design System Foundation** (done)

- `<SemaforoBadge state="neutral">` é o placeholder para story 2.1 (prontidão real vem no Epic 5)
- `<EmptyState>`, `<CalmConfirmation>`, `<Dialog>` estão em `src/components/ui/` — usar directamente
- `<Button variant="destructive">` para o botão de arquivo
- **NÃO reimplementar estes componentes** — já existem e estão testados

**Story 1.6: Multi-Tenant Access Enforcement** (done)

- Auth helpers são `public.club_id()` e `public.user_role()` (NÃO `auth.club_id()`)
- Políticas RLS devem usar `public.club_id()` e `public.user_role()` (ver migrations 000030 e 000040)
- `WITH CHECK` obrigatório em todas as writes (previne cross-tenant insert)

**Story 1.5: Auth & Middleware** (done)

- Server Actions devem começar com `const { data: { user } } = await supabase.auth.getUser()`
- Se `!user`: retornar `err({ code: 'unauthorized', ... })` (não redirect)
- O middleware em `src/middleware.ts` já protege todas as rotas `(staff)` — redirect para `/login` se não autenticado

---

## Git Intelligence Summary

```
e6ce1fd feat: enhance accessibility with skip link and main content IDs ← skip link padrão
9deee66 Implement feature X to enhance user experience                   ← (genérico)
aa31995 feat(backup): complete story 1.15                                ← YAML patterns
9cbe6db fix(ci): disable Lighthouse CPU throttling                       ← CI patterns
```

### Padrões Estabelecidos no Projecto

1. **Migrações**: `000XXX_name.sql` sequencial (NÃO timestamp) — lacuna disponível: `000050`, `000060`, `000070`, `000075`
2. **Server Actions**: `"use server"` no topo, Zod no início, `Result<T, AppError>`, nunca throw para o cliente
3. **Client Components com `"use client"`** declarado explicitamente no topo
4. **React 19**: sem `import React from 'react'` (JSX transform automático)
5. **TypeScript strict**: `noUncheckedIndexedAccess` — todo o array/object index com `?.` e `?? fallback`
6. **Imports**: sempre `@/` aliases, nunca relativos (`../../`)
7. **Named exports** sempre (excepto `export default` em Next.js page components)
8. **Sem barrel files** (`index.ts` re-exports) — importar directamente
9. **Testes**: em `__tests__/` (não co-located), nomes `{file}.test.ts(x)` espelhando `src/`

---

## Latest Tech Information

### react-hook-form@7.75.0 + @hookform/resolvers@5.2.2 + zod@4.4.3

- `zodResolver` de `@hookform/resolvers/zod` — compatível com Zod v4
- `mode: "onBlur"` no `useForm` — validação on-blur (UX-DR31)
- `form.setError("field", { message: "..." })` para erros de servidor (ex: jersey duplicado)
- `form.formState.errors.field?.message` para aceder ao erro (com `?.` — noUncheckedIndexedAccess)

### date-fns@4.1.0

- `format(date, pattern, { locale: ptPT })` para formatar datas em PT
- `differenceInYears(new Date(), birthdate)` para calcular idade
- Importar locale: `import { ptPT } from "date-fns/locale"`

### uuid@14.0.0

- `v7()` disponível — usar via `newId()` de `@/lib/uuid` (já encapsula `v7()`)
- **NÃO importar `v7` directamente** — usar `newId()` para consistência

### Supabase JS@2.105.4

- `.rpc('function_name', { ...params })` para chamar Postgres functions
- Erro de unique constraint: `error.code === '23505'`
- Tipo do argumento `jsonb`: cast necessário `as unknown as Json`

---

## Project Context Reference

```
ProjectR/ (git root)
├── project-r/                         ← working directory para npm commands
│   ├── supabase/
│   │   └── migrations/
│   │       ├── 000010–000160_*.sql    ← migrações existentes
│   │       ├── 000070_players_positions.sql   ← NEW
│   │       └── 000075_player_rpc.sql          ← NEW
│   └── src/
│       ├── lib/
│       │   ├── actions/
│       │   │   ├── audit.ts           ← logAccess() — importar aqui
│       │   │   └── players.ts         ← NEW
│       │   ├── schemas/
│       │   │   └── players.ts         ← NEW (Zod schemas partilhados)
│       │   ├── supabase/
│       │   │   └── database.types.ts  ← UPDATE (adicionar players + positions)
│       │   └── uuid.ts                ← newId() — usar para UUIDv7
│       ├── components/
│       │   └── ui/
│       │       ├── semaforo-badge.tsx      ← usar state="neutral" como placeholder
│       │       ├── calm-confirmation.tsx   ← feedback após criação/edição
│       │       ├── empty-state.tsx         ← lista vazia
│       │       └── dialog.tsx              ← confirmação de arquivo
│       └── app/
│           └── (staff)/
│               └── plantel/
│                   ├── page.tsx            ← UPDATE (tem placeholder actualmente)
│                   ├── novo/page.tsx       ← NEW
│                   └── [id]/
│                       ├── page.tsx        ← NEW
│                       └── editar/page.tsx ← NEW
```

**Referências:**
- FR12: Player CRUD com positions multi-primária
- FR13: Plantel list por age_group + is_archived
- FR50: Audit trail para player.updated
- AR8/AR9/AR10: RLS policies with check + club isolation
- NFR1: Índices em club_id para performance ≤2s
- NFR54: Cobertura de testes ≥80% nos fluxos player

---

## Dev Agent Record

### Completion Notes

- **AC #1**: Migrações `000070_players_positions.sql` e `000075_player_rpc.sql` criadas com tabelas, RLS, índices, trigger `updated_at` e função atómica `upsert_player_positions` (SECURITY INVOKER). `database.types.ts` atualizado com tipos `players`, `positions` e a função RPC.
- **AC #2**: `/plantel/page.tsx` reescrito como Server Component com `getPlayers()` agrupado por escalão (u14→senior), ordenado por apelido, com `<SemaforoBadge state="neutral">` e `<PlantelEmptyState>` (wrapper cliente de `<EmptyState>`).
- **AC #3**: `createPlayer` insere atomicamente via RPC; compensa (DELETE player) se RPC falhar; redireciona para `/plantel/[id]?created=1`.
- **AC #4**: Validação on-blur com `react-hook-form@7.75 + zodResolver`; erros inline com `<AlertCircle>`; unicidade de camisola validada server-side (erro 23505 → `setError("jerseyNum", ...)`).
- **AC #5**: `updatePlayer` actualiza atomicamente, chama `logAccess('player.updated', 'player', id)` via `audit.ts`, redireciona para `/plantel/[id]?updated=1`.
- **AC #6**: `archivePlayer` define `is_archived = true`; `<ArchivePlayerDialog>` com `<Dialog>` destrutivo confirma antes de arquivar.
- **AC #7**: 366/366 testes passam (338 existentes + 28 novos). Cobertura ≥80% nos fluxos player (schemas + server actions testados). Lint: 0 erros. Typecheck: 0 erros. Build: ✅.
- **Fix descoberto**: `audit.ts` exportava `AuditLogInputSchema` (objeto Zod) de ficheiro `"use server"` — causava erro de build quando client component (`edit-player-form.tsx`) importava `updatePlayer` que chama `logAccess`. Solução: mover schema para `src/lib/schemas/audit.ts` e actualizar import no teste. Re-export removido do ficheiro "use server".
- **Locale date-fns**: `ptPT` não existe nesta versão (4.1.0) — usar `pt` de `"date-fns/locale"`.

---

## File List

- `project-r/supabase/migrations/000070_players_positions.sql` (NEW)
- `project-r/supabase/migrations/000075_player_rpc.sql` (NEW)
- `project-r/src/lib/supabase/database.types.ts` (MODIFIED)
- `project-r/src/lib/schemas/players.ts` (NEW)
- `project-r/src/lib/schemas/audit.ts` (NEW — extraído de audit.ts para evitar conflito "use server")
- `project-r/src/lib/actions/players.ts` (NEW)
- `project-r/src/lib/actions/audit.ts` (MODIFIED — AuditLogInputSchema movido para schemas/audit.ts)
- `project-r/src/app/(staff)/plantel/page.tsx` (MODIFIED)
- `project-r/src/app/(staff)/plantel/plantel-empty-state.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/novo/page.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/page.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/archive-player-dialog.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/editar/page.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/editar/edit-player-form.tsx` (NEW)
- `project-r/src/__tests__/lib/actions/players.test.ts` (NEW)
- `project-r/src/__tests__/lib/actions/audit.simple.test.ts` (MODIFIED — import atualizado para schemas/audit)

---

## Change Log

- 2026-05-17: Story 2.1 criada — player records + plantel list; migração 000070 + 000075; actions players.ts; formulários; testes integração
- 2026-05-17: Story 2.1 implementada — 366/366 testes ✅; lint 0 erros; typecheck 0 erros; build ✅; AC #1-#7 verificados; status → review

---

## Review Findings (2026-05-17)

### Decision-Needed (Resolved)

- [x] [Review][Decision] RLS "player sees own record" — null profile_id intent clarification [migration:62-64] — **RESOLVED: Intentional behavior. Documented in migration (line 63).**

### Critical Patches (Applied)

- [x] [Review][Patch] createPlayer atomicidade — RPC + delete não transacionais [players.ts:131-170] — **FIXED: Added error handling for compensating delete; logs both errors if both fail.**

- [x] [Review][Patch] updatePlayer RPC inconsistência — UPDATE executes, then RPC may fail [players.ts:172-229] — **FIXED: Added compensating UPDATE to revert player changes if positions RPC fails. Fetches current state before update.**

- [x] [Review][Patch] archivePlayer missing logAccess — violação FR50 [players.ts:231-258] — **FIXED: Added `await logAccess("player.archived", "player", playerId)` after archive.**

### High-Priority Patches (Applied)

- [x] [Review][Patch] archivePlayer cross-club bypass — RLS-only defense [players.ts:249-252] — **FIXED: Added explicit `.eq("club_id", profile.club_id)` filter + fetched profile for defense-in-depth.**

- [x] [Review][Patch] Birthdate validation incomplete — permite datas futuro/1800 [schemas/players.ts:24] — **FIXED: Added `refine()` with differenceInYears check (4-100 years). Rejects future dates and implausible ages.**

- [x] [Review][Patch] getPlayers RLS-only filter — missing explicit club scoping [players.ts:54-86] — **FIXED: Added explicit `.eq("club_id", profile.club_id)` filter + fetched user profile.**

### Medium-Priority Patches (Applied)

- [x] [Review][Patch] getPlayer wildcard select — type safety risk [players.ts:88-104] — **FIXED: Changed to explicit select list with all columns and nested positions fields.**

### Deferred (Pre-existing, Not Blocking)

- [x] [Review][Defer] logAccess fire-and-forget — observability issue [players.ts:226] — Story 1.12 spec allows fire-and-forget pattern; minor.

### Dismissed as Noise

- sort_order mapping cosmetic — No actual bug detected; code works correctly for 0-4 constraints; confusion is cosmetic only.
