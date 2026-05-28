# Story 5.10: Data-Driven Decision Input + Audit (FR52)

**Status:** ready-for-dev

**Story ID:** 5.10
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-27
**Story anterior:** 5-9-analista-dashboard-cumulative-load-per-player-per-season

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Requer Stories **5.1–5.5** done (especialmente 5.5 — `PlayerDrillDownSheet` já tem um botão ghost `aria-disabled="true"` com label "Disponível em breve" que esta story SUBSTITUI com a implementação real). Requer Story **1.12** (audit_logs + telemetry_events). A route `/configuracoes/kpis-validacao` é acessível apenas a staff.
>
> ⚠️ **NÃO RE-CRIAR A INFRA de Stories 5.1–5.5:** A tabela `readiness_snapshots`, `session_metrics`, e os Server Actions existentes em `readiness.ts` já existem. Esta story apenas adiciona a tabela `data_decisions` e os Server Actions em `decisions.ts`.

---

## Story

As a Treinador or Analista,
I want a discrete UI to mark and write a free-text note when data informed a roster or management decision,
so that the "wow moment" KPI is auditable and we can validate the product's impact monthly.

---

## Acceptance Criteria

### AC #1 — Migração `000260_data_decisions.sql`

**Given** a migração `000260_data_decisions.sql`

**When** aplicada

**Then** tabela `data_decisions` existe com colunas:
- `id uuid PRIMARY KEY DEFAULT uuid_generate_v7()`
- `club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE`
- `player_id uuid REFERENCES players(id) ON DELETE CASCADE` (cascade garante eliminação GDPR automática)
- `session_id uuid REFERENCES sessions(id) ON DELETE SET NULL` (nullable — decisão pode não ter sessão associada)
- `actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL`
- `decision_kind text NOT NULL CHECK (decision_kind IN ('roster','management','load_adjustment','rest','other'))`
- `note text`
- `was_data_driven boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`

**And** RLS habilitado: `club_id = auth.club_id()` em SELECT, INSERT, UPDATE — staff-only via `auth.role() IN ('coach','analyst')`

**And** índices:
- `idx_data_decisions_club_created ON (club_id, created_at DESC)` — KPI query mensal
- `idx_data_decisions_player_created ON (player_id, created_at DESC)` — drill-down query

---

### AC #2 — Server Actions em `decisions.ts`

**Given** um staff autenticado chama `saveDataDrivenDecision(input)`

**When** o formulário é submetido

**Then** um row é inserido em `data_decisions` com `actor_id = auth.uid()` e `club_id` do staff

**And** fire-and-forget via `after()`:
1. Insert em `audit_logs` com `action='decision.marked'`, `target_kind='data_decisions'`, `target_id=player_id`
2. `logTelemetry('decision_marked', { playerId, decisionKind })` (Story 1.12)

**Given** um staff chama `getDataDrivenDecisions(playerId)`

**When** executado

**Then** retorna as últimas 3 decisões para esse jogador do clube, ordenadas por `created_at DESC`

**And** cada decisão inclui: id, decision_kind, note, was_data_driven, created_at, actor_id

**Given** um staff chama `updateDataDrivenDecision(id, { note })`

**When** `created_at + INTERVAL '24 hours' > NOW()` AND `actor_id = auth.uid()`

**Then** atualiza `note` no row existente

**When** janela de 24h expirou OU `actor_id != auth.uid()`

**Then** retorna `err({ code: 'forbidden', message: 'Edição não permitida' })`

---

### AC #3 — Componente `<DataDrivenDecisionInput>` integrado no DrillDownSheet

**Given** a `<PlayerDrillDownSheet>` (Story 5.5) renderiza

**When** a zona de nota de decisão é exibida

**Then** a zona mostra o botão ghost "Marcar decisão data-driven" (substituindo o `aria-disabled="true"` da Story 5.5)

**And** ao clicar o botão, expande inline (sem modal) para mostrar:
- `<Textarea>` com placeholder "Que decisão tomaste com base nestes dados? (opcional)" e `maxLength={500}`
- `<RadioGroup>` para `decision_kind`:
  - `roster` → "Convocatória"
  - `management` → "Gestão do jogador"
  - `load_adjustment` → "Ajuste de carga"
  - `rest` → "Descanso"
  - `other` → "Outra"
- `<Checkbox>` "Foi mesmo data-driven?" (default `checked=true`)
- Botão "Guardar" (primary) + botão "Cancelar" (ghost)

**And** após guardar com sucesso: o formulário colapsa e mostra "Decisão registada ✓" por 2s, depois renderiza o histórico atualizado

---

### AC #4 — Histórico das últimas 3 decisões no DrillDownSheet

**Given** existem decisões guardadas para o jogador

**When** a `<PlayerDrillDownSheet>` abre

**Then** as últimas 3 decisões são visíveis ACIMA do botão/formulário de nova decisão

**And** cada decisão mostra: label do `decision_kind` (em PT-PT), nota (se existir), data formatada `"d MMM"` com `date-fns` locale `pt`, e se `was_data_driven=false` uma badge "Não data-driven" em texto muted

**And** se `created_at + 24h > now()` E `actor_id === auth.uid()`: botão "Editar" inline (pequeno, ghost)

**And** após 24h ou outro actor: read-only sem botão de edição

---

### AC #5 — Rota `/configuracoes/kpis-validacao` com contagens mensais

**Given** o staff navega para `/configuracoes/kpis-validacao`

**When** a página carrega

**Then** mostra uma tabela/lista com contagens de decisões por mês e por `decision_kind`

**And** inclui o total por mês e uma linha de referência "Meta: ≥1 decisão data-driven por mês"

**And** se o total do mês atual ≥ 1: indicador verde "Meta atingida"; caso contrário: indicador âmbar "Meta não atingida"

**And** acesso apenas staff (coach/analyst) — mesma proteção do middleware existente

---

### AC #6 — RLS e isolamento multi-tenant

**Given** um utilizador de outro clube tenta aceder a `data_decisions` via Supabase

**When** a query é executada

**Then** zero rows são retornados (FR3)

**And** INSERT com `club_id` errado é bloqueado por RLS

---

### AC #7 — Cobertura de testes ≥ 80% (NFR54)

**Given** os testes correm

**When** executados

**Then** create flow, edit window, telemetry logging, audit log emission, KPI count query, e componente `<DataDrivenDecisionInput>` são cobertos ≥ 80%

---

## Tasks / Subtasks

- [ ] **Task 1: Migração `000260_data_decisions.sql`** (AC: #1, #6)
  - [ ] Criar `supabase/migrations/000260_data_decisions.sql`
  - [ ] Criar tabela `data_decisions` com todos os campos, FKs e CHECKs (ver AC #1)
  - [ ] `player_id` FK: `ON DELETE CASCADE` (garante GDPR erasure automático com Migration 000185)
  - [ ] `session_id` FK: `ON DELETE SET NULL` (nullable — sessão pode ser cancelada sem perder decisão)
  - [ ] `actor_id` FK: `ON DELETE SET NULL` (utilizador pode ser eliminado sem perder historial)
  - [ ] Habilitar RLS: `ALTER TABLE data_decisions ENABLE ROW LEVEL SECURITY`
  - [ ] Políticas RLS:
    ```sql
    CREATE POLICY "staff read own club" ON data_decisions
      FOR SELECT USING (club_id = auth.club_id()
        AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"'));
    CREATE POLICY "staff insert own club" ON data_decisions
      FOR INSERT WITH CHECK (club_id = auth.club_id()
        AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"'));
    CREATE POLICY "actor update within 24h" ON data_decisions
      FOR UPDATE USING (
        club_id = auth.club_id()
        AND actor_id = auth.uid()
        AND created_at + INTERVAL '24 hours' > NOW()
      );
    ```
  - [ ] Criar índices `idx_data_decisions_club_created` e `idx_data_decisions_player_created`
  - [ ] GRANT SELECT, INSERT, UPDATE ON data_decisions TO authenticated
  - [ ] Actualizar `sparta/src/lib/supabase/database.types.ts`: adicionar tipo `data_decisions` (Row, Insert, Update)

- [ ] **Task 2: Server Actions em `sparta/src/lib/actions/decisions.ts`** (AC: #2, #4, #6)
  - [ ] Criar `sparta/src/lib/actions/decisions.ts` com `"use server"` no topo
  - [ ] Definir tipos exportados:
    ```typescript
    export type DecisionKind = 'roster' | 'management' | 'load_adjustment' | 'rest' | 'other';

    export const DECISION_KIND_LABELS: Record<DecisionKind, string> = {
      roster: 'Convocatória',
      management: 'Gestão do jogador',
      load_adjustment: 'Ajuste de carga',
      rest: 'Descanso',
      other: 'Outra',
    };

    export type DataDecision = {
      id: string;
      decisionKind: DecisionKind;
      note: string | null;
      wasDataDriven: boolean;
      createdAt: string;
      actorId: string;
    };

    export type SaveDecisionInput = {
      playerId: string;
      sessionId?: string | null;
      decisionKind: DecisionKind;
      note?: string | null;
      wasDataDriven?: boolean;
    };
    ```
  - [ ] Implementar `requireStaffRole()` local (copiar pattern de `readiness.ts` — não está exportada)
  - [ ] Implementar `saveDataDrivenDecision(input: SaveDecisionInput): Promise<Result<{ id: string }, AppError>>`
    - `requireStaffRole()` guard
    - Validar `note` ≤ 500 chars, `decisionKind` no CHECK list
    - INSERT em `data_decisions`
    - Fire-and-forget via `after()`: audit_logs + `logTelemetry('decision_marked', { playerId, decisionKind })`
  - [ ] Implementar `getDataDrivenDecisions(playerId: string): Promise<Result<DataDecision[], AppError>>`
    - `requireStaffRole()` guard
    - SELECT TOP 3 por `created_at DESC` WHERE `player_id = playerId`
    - NÃO usar `auditedRead()` para este read (decisões não são dados de saúde — não obrigam audit por FR50; apenas marcações de staff)
  - [ ] Implementar `updateDataDrivenDecision(id: string, note: string): Promise<Result<void, AppError>>`
    - `requireStaffRole()` guard
    - Verificar `actor_id = auth.uid()` e janela 24h (tanto na query como resposta)
    - UPDATE: usar `.eq('id', id).eq('actor_id', userId).gte('created_at', windowStart)`
    - Retornar `err('forbidden')` se UPDATE afectou 0 rows

- [ ] **Task 3: Componente `<DataDrivenDecisionInput>` em `sparta/src/components/domain/DataDrivenDecisionInput.tsx`** (AC: #3, #4)
  - [ ] Client Component com props:
    ```typescript
    interface DataDrivenDecisionInputProps {
      playerId: string;
      sessionId?: string | null;
      initialDecisions?: DataDecision[];
      currentUserId: string;
    }
    ```
  - [ ] State interno: `expanded: boolean`, `note: string`, `decisionKind: DecisionKind | null`, `wasDataDriven: boolean`, `status: 'idle' | 'saving' | 'success' | 'error'`
  - [ ] Estado colapsado: botão ghost "Marcar decisão data-driven" com ícone `<BookmarkPlus>` lucide
  - [ ] Estado expandido: `<Textarea>`, `<RadioGroup>` com 5 opções, `<Checkbox>`, botões Guardar/Cancelar
  - [ ] Ao submeter: chamar `saveDataDrivenDecision()`, mostrar spinner, após sucesso mostrar "Decisão registada ✓" e colapsar com `setTimeout(2000)`
  - [ ] Histórico: renderizar `decisions.slice(0, 3)` acima do botão/formulário
    - Cada item: label do kind + nota truncada a 100 chars + data `format(parseISO(d.createdAt), 'd MMM', { locale: pt })`
    - Botão "Editar" se `isPastEditable(d)`:
      ```typescript
      function isPastEditable(d: DataDecision, currentUserId: string): boolean {
        return d.actorId === currentUserId &&
          new Date(d.createdAt).getTime() + 24 * 3600 * 1000 > Date.now();
      }
      ```
  - [ ] Acessibilidade: `aria-expanded` no botão toggle, `role="group"` no formulário com `aria-label`
  - [ ] ZERO estado persistido em sessionStorage — cada abertura da sheet busca dados frescos

- [ ] **Task 4: Actualizar `PlayerDrillDownSheet` para usar o componente real** (AC: #3)
  - [ ] Localizar o botão `aria-disabled="true"` com label "Disponível em breve" em `sparta/src/components/domain/readiness/` (provavelmente em `player-drill-down-sheet.tsx` criado pela Story 5.5 — verificar filename exacto)
  - [ ] Substituir o botão desabilitado por `<DataDrivenDecisionInput playerId={player.playerId} sessionId={sessionId} initialDecisions={decisions} currentUserId={currentUserId} />`
  - [ ] Adicionar `decisions` ao `getPlayerDrillDownData()` result (ou criar query separada no componente via `useEffect` — ver nota abaixo)
  - [ ] Passar `currentUserId` (do `requireStaffRole()` result, exposto via prop ou contexto)

  > **NOTA ARQUITECTURAL:** `getPlayerDrillDownData()` em `readiness.ts` (Story 5.5) já existe e retorna `{ fatigueResponses, sessions, attendanceNumerator, attendanceDenominator }`. Existem 2 opções para carregar `decisions`:
  > - **Opção A (recomendada):** `<DataDrivenDecisionInput>` carrega as suas próprias decisões com `useEffect` ao montar → não modifica `getPlayerDrillDownData()`
  > - **Opção B:** Adicionar `decisions` ao return de `getPlayerDrillDownData()` → mais acoplamento
  >
  > Usar **Opção A** para manter `readiness.ts` focado em dados de prontidão.

- [ ] **Task 5: Rota `/configuracoes/kpis-validacao/page.tsx`** (AC: #5)
  - [ ] Criar Server Action `getDecisionKpiData()` em `decisions.ts`:
    ```typescript
    export type MonthlyKpiRow = {
      month: string;          // "YYYY-MM"
      total: number;
      byKind: Partial<Record<DecisionKind, number>>;
    };
    ```
    - Query: `SELECT date_trunc('month', created_at) AS month, decision_kind, COUNT(*) FROM data_decisions WHERE club_id = $clubId GROUP BY 1, 2 ORDER BY 1 DESC`
    - Retornar os últimos 12 meses
  - [ ] Criar `sparta/src/app/(staff)/configuracoes/kpis-validacao/page.tsx` como Server Component
  - [ ] Chamar `getDecisionKpiData()` e renderizar tabela com:
    - Coluna mês | Total | Convocatória | Gestão | Ajuste Carga | Descanso | Outra | Meta
    - Indicador Meta: `total >= 1` → badge verde "Meta atingida" (com ícone `<CheckCircle>`), senão badge âmbar "Meta não atingida" (com ícone `<AlertCircle>`) — redundância cor + ícone (UX-DR1)
  - [ ] Metadata: `title: "KPIs de Validação — SPARTA"`
  - [ ] `<EmptyState>` se sem dados ("Nenhuma decisão registada ainda.")

- [ ] **Task 6: Testes** (AC: #7)
  - [ ] `sparta/src/components/domain/DataDrivenDecisionInput.test.tsx`
  - [ ] `sparta/src/__tests__/app/(staff)/configuracoes-kpis.test.tsx`
  - [ ] Ver secção Testes abaixo para casos obrigatórios

---

## Architecture / Technical Requirements

### Tipos e Enums

```typescript
// sparta/src/lib/actions/decisions.ts

export type DecisionKind = 'roster' | 'management' | 'load_adjustment' | 'rest' | 'other';

export const DECISION_KIND_LABELS: Record<DecisionKind, string> = {
  roster: 'Convocatória',
  management: 'Gestão do jogador',
  load_adjustment: 'Ajuste de carga',
  rest: 'Descanso',
  other: 'Outra',
};

export const DECISION_KINDS = Object.keys(DECISION_KIND_LABELS) as DecisionKind[];

export type DataDecision = {
  id: string;
  decisionKind: DecisionKind;
  note: string | null;
  wasDataDriven: boolean;
  createdAt: string;   // ISO string
  actorId: string;
};
```

### Migração SQL (000260)

```sql
-- supabase/migrations/000260_data_decisions.sql

CREATE TABLE IF NOT EXISTS data_decisions (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  club_id      uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id    uuid        REFERENCES players(id) ON DELETE CASCADE,
  session_id   uuid        REFERENCES sessions(id) ON DELETE SET NULL,
  actor_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  decision_kind text       NOT NULL
    CHECK (decision_kind IN ('roster','management','load_adjustment','rest','other')),
  note         text,
  was_data_driven boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read own club" ON data_decisions
  FOR SELECT TO authenticated
  USING (club_id = auth.club_id()
    AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"'));

CREATE POLICY "staff insert own club" ON data_decisions
  FOR INSERT TO authenticated
  WITH CHECK (club_id = auth.club_id()
    AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"'));

CREATE POLICY "actor update within 24h" ON data_decisions
  FOR UPDATE TO authenticated
  USING (
    club_id = auth.club_id()
    AND actor_id = auth.uid()
    AND created_at + INTERVAL '24 hours' > NOW()
  )
  WITH CHECK (club_id = auth.club_id());

GRANT SELECT, INSERT, UPDATE ON data_decisions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_data_decisions_club_created
  ON data_decisions (club_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_decisions_player_created
  ON data_decisions (player_id, created_at DESC);
```

### CRÍTICO: Reutilizar, Não Reinventar

| O quê | Localização | Como usar |
|-------|-------------|-----------|
| `requireStaffRole()` | `sparta/src/lib/actions/readiness.ts` | Copiar padrão localmente em `decisions.ts` (não está exportada) |
| `Result<T, E>`, `ok()`, `err()` | `@/lib/types` | Return type de todos os Server Actions |
| `createServerClient()` | `@/lib/supabase/server` | Client Supabase para Server Actions |
| `logTelemetry()` | `@/lib/actions/telemetry` | `void logTelemetry('decision_marked', payload)` — fire-and-forget |
| `after()` | `next/server` | Fire-and-forget para audit_logs |
| `getServiceRoleClient()` | `@/lib/supabase/service-role` | Para INSERT em audit_logs dentro de `after()` |
| `<DrillDownSheet>` | `@/components/ui/drill-down-sheet` | NÃO re-criar — PlayerDrillDownSheet já usa |
| `<EmptyState>` | `@/components/ui/empty-state` | Estados vazios (Story 1.8) |
| `format`, `parseISO` | `date-fns` (já instalado) | Formatação de datas |
| `pt` locale | `date-fns/locale/pt` | Formato PT-PT para datas |
| `BookmarkPlus`, `CheckCircle`, `AlertCircle` | `lucide-react` (já instalado) | Ícones |

### Auditoria — Padrão `after()` para fire-and-forget

```typescript
// Em decisions.ts — saveDataDrivenDecision()
import { after } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logTelemetry } from "@/lib/actions/telemetry";

// Depois de INSERT bem-sucedido:
after(async () => {
  try {
    const serviceRole = getServiceRoleClient();
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "decision.marked",
      target_kind: "data_decisions",
      target_id: input.playerId,
    });
  } catch { /* silent */ }
});

// Telemetria separada (logTelemetry já é fire-and-forget internamente)
void logTelemetry('decision_marked', {
  playerId: input.playerId,
  decisionKind: input.decisionKind,
});
```

### Verificação da Janela 24h no Server Action

```typescript
// updateDataDrivenDecision — verificar via UPDATE count
const windowStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const { data, error } = await supabase
  .from("data_decisions")
  .update({ note })
  .eq("id", id)
  .eq("actor_id", userId)
  .gte("created_at", windowStart)  // apenas dentro da janela
  .select("id");

if (error) return err({ code: "db_error", message: error.message });
if (!data || data.length === 0) {
  return err({ code: "forbidden", message: "Edição não permitida. Janela de 24h expirada ou decisão de outro utilizador." });
}
return ok(undefined);
```

### Estrutura de Ficheiros

```
sparta/src/
├── app/(staff)/
│   └── configuracoes/
│       └── kpis-validacao/
│           └── page.tsx                      CRIAR: Server Component KPI dashboard
├── components/domain/
│   ├── DataDrivenDecisionInput.tsx           CRIAR: componente de input expandível
│   └── DataDrivenDecisionInput.test.tsx      CRIAR
└── lib/
    └── actions/
        └── decisions.ts                      CRIAR: saveDataDrivenDecision, getDataDrivenDecisions, updateDataDrivenDecision, getDecisionKpiData

supabase/migrations/
└── 000260_data_decisions.sql                 CRIAR

sparta/src/components/domain/readiness/
└── player-drill-down-sheet.tsx               MODIFICAR: substituir botão disabled por <DataDrivenDecisionInput>

sparta/src/lib/supabase/
└── database.types.ts                         MODIFICAR: adicionar tipo data_decisions
```

---

## Dev Notes

### CRÍTICO: PlayerDrillDownSheet — Botão Disabled da Story 5.5

A Story 5.5 criou `<PlayerDrillDownSheet>` com este placeholder no rodapé:
```tsx
{/* AC #6 — placeholder: disponível na Story 5.10 */}
<button
  className="..."
  aria-disabled="true"
  disabled
>
  Disponível em breve
</button>
```

Esta story **substitui** este elemento por `<DataDrivenDecisionInput>`. Verificar o ficheiro exacto com:
```
sparta/src/components/domain/readiness/player-drill-down-sheet.tsx
```
ou o equivalente criado pela Story 5.5. Procurar por "Disponível em breve" ou `aria-disabled`.

### GDPR Erasure — ON DELETE CASCADE já trata de tudo

A migração 000185 (`_erase_cascade_audit_safety.sql`) criou uma função de erasure que elimina dados de um jogador. Com `player_id FK ON DELETE CASCADE` em `data_decisions`, quando um jogador é eliminado, as suas decisões são automaticamente eliminadas em cascata — **sem necessidade de modificar a função de erasure existente**. Verificar que a migração usa `ON DELETE CASCADE` e não `ON DELETE RESTRICT`.

### `requireStaffRole()` — Pattern a Copiar

```typescript
// decisions.ts — copiar este padrão (não está exportado de readiness.ts)
async function requireStaffRole(): Promise<
  Result<{ userId: string; clubId: string; role: string }, AppError>
> {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return err({ code: "unauthorized", message: "Autenticação necessária." });
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    return err({ code: "unauthorized", message: "Perfil não encontrado." });
  }
  if (profile.role !== "coach" && profile.role !== "analyst") {
    return err({ code: "forbidden", message: "Acesso restrito a staff." });
  }
  if (!profile.club_id) {
    return err({ code: "forbidden", message: "Clube não atribuído." });
  }
  return ok({ userId: user.id, clubId: profile.club_id, role: profile.role });
}
```

### `DataDrivenDecisionInput` — Carregar Decisões (Opção A — Recomendada)

O componente carrega as suas próprias decisões ao montar, sem modificar `getPlayerDrillDownData()`:

```typescript
// DataDrivenDecisionInput.tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { getDataDrivenDecisions, saveDataDrivenDecision, type DataDecision } from "@/lib/actions/decisions";

export function DataDrivenDecisionInput({ playerId, sessionId, currentUserId }: Props) {
  const [decisions, setDecisions] = useState<DataDecision[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getDataDrivenDecisions(playerId);
      if (result.ok) setDecisions(result.data);
    });
  }, [playerId]);

  // ... restante implementação
}
```

### `noUncheckedIndexedAccess` — Guards Obrigatórios

```typescript
// ✅ Correcto
const first = decisions[0] ?? null;
const label = DECISION_KIND_LABELS[kind] ?? kind;

// ❌ ERRO — sem guard
const first = decisions[0]; // pode ser undefined
```

### Formato de Datas com date-fns PT

```typescript
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

// "27 mai" → formato para histórico de decisões
const dateLabel = format(parseISO(decision.createdAt), "d MMM", { locale: pt });
```

### Middleware — Sem Alterações Necessárias

O middleware existente em `sparta/src/middleware.ts` já protege todas as rotas `(staff)/configuracoes/` para players. A nova rota `/configuracoes/kpis-validacao` é coberta automaticamente.

### Commits Relevantes

- `d5e1f25 5.3 5.4 5.5 - done` — readiness_snapshots, painel lista, drill-down sheet criados
- `eb1c6a6 Fix` — patches da Story 5.4/5.5

---

## Testes — Padrão e Fixtures

### `DataDrivenDecisionInput.test.tsx` — Casos Obrigatórios

```typescript
vi.mock("@/lib/actions/decisions", () => ({
  getDataDrivenDecisions: vi.fn(),
  saveDataDrivenDecision: vi.fn(),
  updateDataDrivenDecision: vi.fn(),
}));

describe("DataDrivenDecisionInput", () => {
  it("renderiza botão ghost colapsado por defeito", () => { ... });
  it("expande ao clicar botão", () => { ... });
  it("mostra Textarea + RadioGroup + Checkbox quando expandido", () => { ... });
  it("chama saveDataDrivenDecision ao submeter formulário", async () => { ... });
  it("mostra 'Decisão registada ✓' após save bem-sucedido", async () => { ... });
  it("colapsa após 2s do sucesso", async () => { ... }); // jest.useFakeTimers
  it("mostra últimas 3 decisões acima do formulário", () => { ... });
  it("botão 'Editar' visível para decisão dentro de 24h do actor correcto", () => { ... });
  it("sem botão 'Editar' para decisão de outro actor", () => { ... });
  it("sem botão 'Editar' após 24h expirar", () => { ... });
  it("zero violações axe", async () => { ... }); // vitest-axe
});
```

### `configuracoes-kpis.test.tsx` — Casos Obrigatórios

```typescript
vi.mock("@/lib/actions/decisions", () => ({
  getDecisionKpiData: vi.fn(),
}));

describe("KPIs de Validação", () => {
  it("renderiza tabela com meses e contagens", async () => { ... });
  it("badge verde 'Meta atingida' quando total >= 1", async () => { ... });
  it("badge âmbar 'Meta não atingida' quando total === 0", async () => { ... });
  it("EmptyState quando sem dados", async () => { ... });
});
```

### Fixture de DataDecision

```typescript
function makeDecision(overrides: Partial<DataDecision> = {}): DataDecision {
  return {
    id: "decision-uuid-1",
    decisionKind: "roster",
    note: "Deixei o João fora por ACWR elevado.",
    wasDataDriven: true,
    createdAt: new Date(Date.now() - 1000).toISOString(), // 1s atrás (dentro da janela)
    actorId: "user-uuid-coach",
    ...overrides,
  };
}

// Decisão expirada (fora da janela de edição)
const expiredDecision = makeDecision({
  createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
});
```

### Alvo de Cobertura

≥ 80% em todos os ficheiros novos (NFR54).

---

## Referências

- [Epics.md — Story 5.10](../../_bmad-output/planning-artifacts/epics.md#story-510-data-driven-decision-input--audit-fr52) — ACs completos + FR52
- [Story 5.5](./5-5-painel-drill-down-sheet-with-4-week-series-banda-acwr-presences-nota-livre.md) — PlayerDrillDownSheet com botão `aria-disabled` a substituir (AC #6)
- [readiness.ts](../sparta/src/lib/actions/readiness.ts) — `requireStaffRole()` pattern
- [telemetry.ts](../sparta/src/lib/actions/telemetry.ts) — `logTelemetry(kind, payload)`
- [audited.ts](../sparta/src/lib/data/audited.ts) — `auditedRead()` assinatura
- [database.types.ts](../sparta/src/lib/supabase/database.types.ts) — tipos de BD (adicionar `data_decisions`)
- [AGENTS.md](../sparta/AGENTS.md) — convenções TypeScript, `noUncheckedIndexedAccess`, aliases @/*

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

### Notas Chave para o Developer

1. **Substituir o botão disabled da Story 5.5** — Não criar um botão novo. Localizar `"Disponível em breve"` em `player-drill-down-sheet.tsx` e substituir pelo `<DataDrivenDecisionInput>`.
2. **Decisões carregadas no próprio componente** — `<DataDrivenDecisionInput>` chama `getDataDrivenDecisions()` via `useEffect` ao montar. NÃO modificar `getPlayerDrillDownData()` em `readiness.ts`.
3. **`player_id FK ON DELETE CASCADE`** — CRÍTICO para GDPR. A função de erasure (migration 000185) elimina o player → `data_decisions` são eliminadas em cascata automaticamente. Sem este CASCADE, o erasure falha.
4. **`session_id FK ON DELETE SET NULL`** — Nullable. Cancelar uma sessão não elimina as decisões marcadas com base nela.
5. **Janela de 24h — verificar via UPDATE count** — Usar `.gte('created_at', windowStart)` na query UPDATE e verificar `data.length === 0` para detectar janela expirada ou actor errado.
6. **KPI route** — Rota simples sem filtros avançados. A query GROUP BY no Supabase pode usar `.rpc('get_decision_kpis')` ou query raw via `.from('data_decisions').select(...)` com agregação no TypeScript — preferir agregação TypeScript para simplicidade (dados são pequenos, <500 rows/ano).
7. **Telemetria separada do audit_log** — `logTelemetry()` é um Server Action independente (não usa `after()`). `audit_logs` usa `after()` com service role client. Ambos são fire-and-forget.
8. **`noUncheckedIndexedAccess`** — Todos os acessos a arrays e records precisam de guards: `decisions[0] ?? null`, `DECISION_KIND_LABELS[kind] ?? kind`.
9. **`date-fns/locale/pt`** — Usar para formatar datas no histórico de decisões (mesmo padrão de `FatigueChart.tsx`).
10. **Sem sessionStorage** — O componente carrega decisões frescas a cada abertura da sheet. Não persistir estado de formulário em storage.

### File List

**Ficheiros a Criar:**
- `supabase/migrations/000260_data_decisions.sql`
- `sparta/src/lib/actions/decisions.ts`
- `sparta/src/components/domain/DataDrivenDecisionInput.tsx`
- `sparta/src/components/domain/DataDrivenDecisionInput.test.tsx`
- `sparta/src/app/(staff)/configuracoes/kpis-validacao/page.tsx`
- `sparta/src/__tests__/app/(staff)/configuracoes-kpis.test.tsx`

**Ficheiros a Modificar:**
- `sparta/src/components/domain/readiness/player-drill-down-sheet.tsx` — substituir botão `aria-disabled` por `<DataDrivenDecisionInput>`
- `sparta/src/lib/supabase/database.types.ts` — adicionar tipo `data_decisions`

---

## Change Log

### 2026-05-27 (Story Created)
- ✅ Story 5.10 analisada: FR52, UX-DR25, AR22, AR31 mapeados
- ✅ Migração 000260_data_decisions.sql especificada com todas as FKs e políticas RLS
- ✅ ON DELETE CASCADE em player_id identificado como CRÍTICO para GDPR erasure (migration 000185)
- ✅ ON DELETE SET NULL em session_id (nullable — preservar decisão se sessão cancelada)
- ✅ Pattern requireStaffRole() documentado (copiar de readiness.ts — não exportada)
- ✅ Opção A (componente carrega próprias decisões via useEffect) seleccionada vs modificar readiness.ts
- ✅ Janela 24h: verificação via UPDATE count (gte created_at + windowStart)
- ✅ Botão disabled da Story 5.5 identificado como alvo de substituição
- ✅ KPI route /configuracoes/kpis-validacao: agregação TypeScript (dados pequenos)
- ✅ Telemetria via logTelemetry() + audit via after() documentados
- ✅ noUncheckedIndexedAccess guards e date-fns PT documentados
- ✅ Fixtures de testes e casos obrigatórios definidos
