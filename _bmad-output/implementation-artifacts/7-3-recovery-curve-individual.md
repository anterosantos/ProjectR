# Story 7.3: Curva de Recuperação Individual

**Status:** ready-for-dev

**Story ID:** 7.3
**Epic:** Epic 7 — Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)
**Criado:** 2026-06-01
**Story anterior:** 7-2-unified-player-profile-perfil-consolidado (done)

---

## ⚠️ DEPENDÊNCIAS CRÍTICAS

> **BLOQUEADORES**: As seguintes histórias DEVEM estar em estado `done` antes de iniciar a implementação:
>
> - **Story 4.1** — `fatigue_responses` schema com colunas `dim_energy`, `dim_focus`, `dim_sleep`, `dim_soreness`, `dim_mood`, `phase`, `submitted_at`, `session_id`
> - **Story 5.1** — `session_metrics` table com `srpe_load` GENERATED STORED (`srpe_value × duration_min`), `player_id`, `session_id`
> - **Story 7.2** — `ProfileTabs.tsx` + perfil consolidado (estrutura de tabs a estender)
> - **Story 4.6** — middleware `STAFF_ONLY_ROUTES_404` já bloqueia `/plantel/*` para players (FR26 já coberto)
> - **Story 1.12** — `auditedRead()` wrapper + `audit_logs` table

---

## Especificação da História

### User Story

Como Treinador ou Analista,
Quero um gráfico que mostre a trajectória típica de fadiga de cada jogador nos dias seguintes a uma sessão de alta intensidade,
Para poder calibrar ciclos de descanso por atleta em vez de aplicar uma regra única a todo o plantel.

### Acceptance Criteria

#### AC #1 — Função de cálculo `computeRecoveryCurve()`

**Given** `lib/readiness/recovery.ts` com `computeRecoveryCurve({ supabase, playerId, clubId, lookbackSessions = 10 })`

**When** invocada

**Then** identifica as últimas N sessões de alta intensidade do jogador: `srpe_load > player_avg_srpe_load × 1.2`
**And** para cada sessão de alta intensidade, recolhe respostas de fadiga:
  - Day 0: `phase = 'post'` com `session_id = high_intensity_session_id`
  - Day 1: `submitted_at` entre `session.date + 1 dia 00:00Z` e `session.date + 1 dia 23:59Z`
  - Day 2: `submitted_at` entre `session.date + 2 dias 00:00Z` e `session.date + 2 dias 23:59Z`
  - Day 3: `submitted_at` entre `session.date + 3 dias 00:00Z` e `session.date + 3 dias 23:59Z`
**And** faz a média de cada dimensão por dia através das N sessões
**And** retorna `RecoveryCurveResult`:
```typescript
interface RecoveryCurvePoint {
  day: 0 | 1 | 2 | 3;
  avgFatigue: number; // média ponderada das 5 dimensões, escala 1–10
  sampleSize: number; // quantas sessões têm dados para este dia
  dimensions: {
    energy: number | null;
    focus: number | null;
    sleep: number | null;
    soreness: number | null;
    mood: number | null;
  };
}

interface RecoveryCurveResult {
  points: RecoveryCurvePoint[];
  totalHighIntensitySessions: number; // total de sessões identificadas como alta intensidade
  sampleSize: number; // mínimo de sampleSize entre todos os pontos (para threshold check)
}
```

#### AC #2 — Tab "Recuperação" no Perfil Consolidado

**Given** `/plantel/[id]/perfil` aberto com tab "Recuperação" (7º tab)

**When** o staff activa o tab

**Then** `<RecuperacaoTab>` renderiza um recharts `<LineChart>` com:
  - Eixo X: dias 0, 1, 2, 3 (labels PT-PT: "Dia 0 (pós-sessão)", "Dia 1", "Dia 2", "Dia 3")
  - Eixo Y: fadiga média (escala 1–10, invertida: 1 no topo = "Fresco", 10 na base = "Exausto") OU normal
  - 5 linhas coloridas: Energia, Concentração, Sono, Dor muscular, Estado emocional
  - Legend com cores distintas para cada dimensão

#### AC #3 — Amostra insuficiente

**Given** `sampleSize < 5`

**When** o tab renderiza

**Then** mostra `<EmptyState>` com:
  - Título: "Sem amostra suficiente"
  - Descrição: "Precisamos de 5+ sessões intensas com questionário pós-sessão para traçar a curva."
  (UX-DR8)

#### AC #4 — Sample size visível

**Given** `sampleSize >= 5`

**When** o gráfico é renderizado

**Then** mostra `n=X sessões` abaixo do título (exemplo: "n=7 sessões intensas analisadas")

#### AC #5 — `<TooltipExplain>`

**Given** o `<TooltipExplain>` junto ao título do gráfico

**When** o staff passa o rato ou toca

**Then** exibe: "Esta curva mostra como [nome do jogador] recupera nos dias após um treino intenso. Use para calibrar a próxima sessão." (B1, NFR42)

#### AC #6 — Bloqueio ao jogador (FR26)

**Given** um jogador a tentar aceder `/plantel/<own_id>/perfil`

**When** middleware STAFF_ONLY_ROUTES_404 faz o check (Story 4.6)

**Then** retorna HTTP 404 — **sem código adicional necessário**, middleware já cobre toda a rota `/plantel/*`

#### AC #7 — Audit logging (FR50)

**Given** o tab "Recuperação" é carregado

**When** `getPlayerRecoveryTabData()` é chamado

**Then** cria entrada em `audit_logs` via `auditedRead()`: `action='recovery_curve.viewed'`, `targetKind='player'`, `targetId=playerId`

#### AC #8 — Cobertura de testes (NFR54)

**Given** testes em `lib/readiness/__tests__/recovery.test.ts`

**When** executados com fixture data

**Then** cobrem ≥80%:
  - Identificação correcta de sessões de alta intensidade (`srpe_load > avg × 1.2`)
  - Agrupamento de respostas por dia (0, 1, 2, 3)
  - Média por dimensão
  - Threshold de amostra insuficiente (`sampleSize < 5`)
  - Player sem sessões de alta intensidade → `sampleSize = 0`
  - Sessão sem respostas day 1/2/3 → `sampleSize` por ponto reflecte disponibilidade real

---

## Contexto para o Desenvolvedor

### Sem migração SQL

> **NENHUMA migração SQL necessária.** Esta história usa exclusivamente tabelas existentes:
> - `fatigue_responses` (Story 4.1) — dimensões 1–10, `phase`, `submitted_at`, `session_id`, `player_id`, `club_id`
> - `session_metrics` (Story 5.1) — `srpe_load` GENERATED STORED, `player_id`, `session_id`, `club_id`
> - `sessions` (Story 2.6) — `id`, `date`, `club_id`, `type`, `duration_min`

### Estrutura de Ficheiros

```
sparta/src/
  lib/
    readiness/
      recovery.ts                    ← NOVO: computeRecoveryCurve()
      __tests__/
        recovery.test.ts             ← NOVO: ≥80% cobertura
  lib/actions/
    player-profile.ts                ← MODIFICAR: adicionar getPlayerRecoveryTabData()
    player-profile.test.ts           ← MODIFICAR: testes para nova Server Action
  app/(staff)/plantel/[id]/perfil/
    ProfileTabs.tsx                  ← MODIFICAR: adicionar tab "recuperacao"
    RecuperacaoTab.tsx               ← NOVO: client component recharts
```

### 1. `lib/readiness/recovery.ts` — Lógica Pura

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface RecoveryCurvePoint {
  day: 0 | 1 | 2 | 3;
  avgFatigue: number;
  sampleSize: number;
  dimensions: {
    energy: number | null;
    focus: number | null;
    sleep: number | null;
    soreness: number | null;
    mood: number | null;
  };
}

export interface RecoveryCurveResult {
  points: RecoveryCurvePoint[];
  totalHighIntensitySessions: number;
  sampleSize: number; // = mínimo de sampleSize dos pontos existentes
}

export async function computeRecoveryCurve(
  supabase: SupabaseClient<Database>,
  {
    playerId,
    clubId,
    lookbackSessions = 10,
  }: { playerId: string; clubId: string; lookbackSessions?: number }
): Promise<RecoveryCurveResult>
```

**Algoritmo passo a passo:**

1. **Calcular média de `srpe_load` do jogador:**
   ```sql
   SELECT AVG(srpe_load) FROM session_metrics
   WHERE player_id = ? AND club_id = ?
   ```

2. **Identificar sessões de alta intensidade** (últimas `lookbackSessions`):
   ```sql
   SELECT sm.session_id, sm.srpe_load, s.date
   FROM session_metrics sm
   JOIN sessions s ON sm.session_id = s.id
   WHERE sm.player_id = ? AND sm.club_id = ?
     AND sm.srpe_load > avg_srpe_load * 1.2
   ORDER BY s.date DESC
   LIMIT lookbackSessions
   ```

3. **Para cada sessão de alta intensidade**, recolher fatigue_responses por dia:
   - **Day 0:** `phase = 'post'` AND `session_id = session.id`
   - **Day 1–3:** `submitted_at` entre `session.date + N days T00:00:00Z` e `session.date + N days T23:59:59Z` (qualquer fase)

4. **Agrupar por dia** e calcular médias das dimensões

5. **`sampleSize` por ponto** = nº de sessões que têm resposta nesse dia (pode variar: day 0 tem mais que day 3)

6. **`sampleSize` global** = `Math.min(...points.map(p => p.sampleSize))` OU `totalHighIntensitySessions` se nenhum ponto tem dados

> **CRÍTICO — `noUncheckedIndexedAccess`:** Todo o acesso a arrays e objectos deve usar `?.` + `?? fallback`. Ver `AGENTS.md` para regras de TypeScript strict.

### 2. `lib/actions/player-profile.ts` — Nova Server Action

Seguir o padrão exacto das outras funções do ficheiro (e.g., `getPlayerFatigueTabData`):

```typescript
export type RecoveryTabData = {
  result: RecoveryCurveResult;
  playerName: string;
};

export async function getPlayerRecoveryTabData(
  playerId: string
): Promise<Result<RecoveryTabData, AppError>> {
  // 1. Validar input
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // 2. requireStaffRole() → userId, clubId
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  // 3. Validar que player pertence ao clube
  const serviceRole = getServiceRoleClient();
  const { data: player } = await serviceRole
    .from("players")
    .select("id, full_name, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // 4. auditedRead() para FR50
  let result: RecoveryCurveResult;
  try {
    result = await auditedRead<RecoveryCurveResult>(
      {
        action: "recovery_curve.viewed",
        targetKind: "player",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        return computeRecoveryCurve(serviceRole, { playerId, clubId });
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao calcular curva de recuperação" });
  }

  return ok({ result, playerName: player.full_name ?? "—" });
}
```

> **ATENÇÃO:** `getServiceRoleClient()` é chamado DEPOIS de `requireStaffRole()`. Nunca antes. Ver `AGENTS.md` §1.

### 3. `RecuperacaoTab.tsx` — Client Component

Seguir o padrão de `FadigaTab.tsx` ou `CargaAcwrTab.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getPlayerRecoveryTabData } from "@/lib/actions/player-profile";
import { EmptyState } from "@/components/patterns/EmptyState";
import { TooltipExplain } from "@/components/patterns/TooltipExplain";
import { Activity } from "lucide-react";

const DIMENSION_COLORS = {
  energy: "#3b82f6",    // azul
  focus: "#8b5cf6",     // roxo
  sleep: "#06b6d4",     // cyan
  soreness: "#f97316",  // laranja
  mood: "#22c55e",      // verde
};

const DIMENSION_LABELS: Record<string, string> = {
  energy: "Energia",
  focus: "Concentração",
  sleep: "Sono",
  soreness: "Dor muscular",
  mood: "Estado emocional",
};

const DAY_LABELS: Record<number, string> = {
  0: "Dia 0\n(pós-sessão)",
  1: "Dia 1",
  2: "Dia 2",
  3: "Dia 3",
};
```

**Pattern de loading/error/empty:**
- Loading: `<div role="status" aria-label="A carregar..." className="animate-pulse rounded-lg bg-muted" style={{ height: 260 }} />`
- Error: `<p className="text-sm text-destructive" role="alert">{error}</p>`
- Empty (sampleSize < 5): `<EmptyState icon={...} title="Sem amostra suficiente" description="Precisamos de 5+ sessões intensas com questionário pós-sessão para traçar a curva." />`

**AbortController:** usar em `useEffect` para evitar race conditions (ver padrão de CargaAcwrTab.tsx):
```typescript
useEffect(() => {
  const controller = new AbortController();
  async function load() { ... }
  void load();
  return () => controller.abort();
}, [playerId]);
```

**Dados para recharts:** transformar `RecoveryCurveResult.points` num array flat:
```typescript
const chartData = result.points.map((p) => ({
  day: DAY_LABELS[p.day] ?? `Dia ${p.day}`,
  energy: p.dimensions.energy,
  focus: p.dimensions.focus,
  sleep: p.dimensions.sleep,
  soreness: p.dimensions.soreness,
  mood: p.dimensions.mood,
}));
```

**Acessibilidade:**
- `<div aria-label="Gráfico de curva de recuperação de [playerName]">` no container recharts
- `<TooltipExplain>` junto ao título

### 4. Modificar `ProfileTabs.tsx`

**Alterações mínimas e precisas:**

```typescript
// 1. Adicionar ao tipo TabId:
type TabId = "fadiga" | "acwr" | "fisicas" | "presencas" | "estatisticas" | "decisoes" | "recuperacao";

// 2. Adicionar ao array TABS (no final):
{ id: "recuperacao", label: "Recuperação" },

// 3. Adicionar import:
import { RecuperacaoTab } from "./RecuperacaoTab";

// 4. Adicionar panel (após o panel de "decisoes"):
<div
  id="profile-panel-recuperacao"
  role="tabpanel"
  aria-labelledby="profile-tab-recuperacao"
  hidden={activeTab !== "recuperacao"}
>
  {activeTab === "recuperacao" && <RecuperacaoTab playerId={playerId} />}
</div>
```

> **NOTA:** `RecuperacaoTab` não recebe `isCumulative` — a curva de recuperação não tem toggle de época (usa sempre todas as sessões disponíveis para ter amostra máxima).

### 5. Esquema de Dados — Colunas Exactas

**`fatigue_responses`** (Migration 000200):
```
id, club_id, player_id, session_id, phase (text: 'pre'|'post'),
dim_energy (int 1–10), dim_focus (int 1–10), dim_sleep (int 1–10),
dim_soreness (int 1–10), dim_mood (int 1–10),
srpe_value (int|null), submitted_at (timestamptz), submitted_via (text)
```

**`session_metrics`** (Migration 000240):
```
id, club_id, session_id, player_id,
srpe_value (int 1–10), duration_min (int),
srpe_load (int GENERATED ALWAYS AS (srpe_value * duration_min) STORED),
computed_at (timestamptz)
```

**`sessions`** (Migration 000120):
```
id, club_id, date (date), type ('treino'|'jogo'|'amigavel'|'folga'),
duration_min (int|null), ...
```

### 6. Integrações NÃO a reimplementar

| Existente | Localização | Uso em 7-3 |
|-----------|-------------|------------|
| `requireStaffRole()` | `src/lib/actions/auth.ts` | Guard em Server Action |
| `getServiceRoleClient()` | `src/lib/supabase/service-role.ts` | Queries DB |
| `auditedRead()` | `src/lib/data/audited.ts` | FR50 audit logging |
| `EmptyState` | `src/components/patterns/EmptyState.tsx` | AC #3 |
| `TooltipExplain` | `src/components/patterns/TooltipExplain.tsx` | AC #5 |
| `ProfileTabs.tsx` | `src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` | Estender com tab 7 |
| Recharts | `recharts` (já instalado) | Gráfico linear |
| `ok()` / `err()` | `src/lib/result.ts` | Result type pattern |

### 7. Padrões TypeScript Críticos (AGENTS.md)

1. **`noUncheckedIndexedAccess`:** `arr?.[0] ?? fallback` — obrigatório em todo acesso indexado
2. **Sem `import React`** — React 19 JSX transform automático
3. **Imports com `@/`** — nunca imports relativos (e.g., `@/lib/readiness/recovery`)
4. **`"use server"` → só async functions** — schema/tipos para `src/lib/schemas/` ou `src/lib/types/`
5. **Service role SEMPRE após `requireStaffRole()`**

---

## Decisões Técnicas & Pitfalls Conhecidos

### 1. **Day sampling — fuso horário**

As sessões têm `sessions.date` (tipo `date`, sem hora). Para `days 1-3`, usar UTC com sufixo:
```typescript
const dayStart = `${sessionDate}T00:00:00Z`; // ERRADO se date é local
// ✅ Correcto: calcular data relativa
const baseDate = new Date(`${sessionDate}T00:00:00Z`);
const dayNStart = new Date(baseDate.getTime() + dayN * 24 * 60 * 60 * 1000);
const dayNEnd   = new Date(baseDate.getTime() + (dayN + 1) * 24 * 60 * 60 * 1000 - 1);
// Usar .toISOString() para queries
```
Ver Story 7-2 patch P12 (UTC suffixes em `player_metrics`).

### 2. **avgFatigue — escala de dimensões**

As dimensões são `dim_*` com escala 1–10 (não 1–5 como era em versões anteriores). A epics.md diz "avgFatigue: 1..5" mas as colunas reais são 1–10. **Usar escala real 1–10 no gráfico** e documentar no AC.

### 3. **sampleSize por ponto vs global**

`sampleSize` num ponto é quantas sessões têm resposta nesse dia específico. Day 3 normalmente tem menos respostas do que Day 0. O threshold `< 5` deve usar o **mínimo global** (pior caso) para não enganar.

Alternativa: usar `totalHighIntensitySessions` para o threshold (mais conservador). Escolher `totalHighIntensitySessions` para consistência com AC #3 — se há menos de 5 sessões de alta intensidade, não há curva.

### 4. **Recharts e SSR**

Recharts não é SSR-compatible. `RecuperacaoTab.tsx` é `"use client"` — sem SSR issues. **Não usar `dynamic()` com recharts aqui** — o componente já é client-only.

### 5. **Promise.allSettled para queries paralelas**

Na Server Action, as queries para `session_metrics` (média) e `sessions` podem ser paralelas. Usar `Promise.all` quando ambas são independentes.

---

## Dev Learnings de Stories Anteriores

### De Story 7-2 (Perfil Consolidado — story anterior directa)

- ✅ `STORAGE_KEY` por jogador: `sparta-profile-tab-${playerId}` — `ProfileTabs.tsx` já persiste tab activa em `sessionStorage`. O novo tab "recuperacao" é automaticamente suportado pela validação existente `TABS.some(t => t.id === stored)`.
- ✅ `AbortController` em todos os tabs para evitar race conditions em `useEffect`
- ✅ `Promise.allSettled` preserva dados parciais em falha individual
- ✅ UTC suffixes `T00:00:00Z` em filtros de datas (patch P12)
- ✅ `requireStaffRole()` retorna `{ ok, data: { userId, clubId, role } }` — usar `authResult.data`
- ✅ `auditedRead()` assinatura: `auditedRead<T>({ action, targetKind, targetId, actorId, clubId }, async () => T)`
- ✅ `maybeSingle()` para player lookup (não `.single()` que lança erro se não encontrar)
- ✅ `getServiceRoleClient()` SEMPRE depois de `requireStaffRole()`

### De Story 5-4 (Painel de Prontidão — recharts patterns)

- ✅ `aria-label` em containers recharts — obrigatório para axe-core
- ✅ Recharts `<ResponsiveContainer width="100%" height={260}>` — usar height fixo em mobile

### De Story 4-5 (Tendências de fadiga — mesmas colunas dim_*)

- ✅ Colunas são `dim_energy`, `dim_focus`, `dim_sleep`, `dim_soreness`, `dim_mood` (com prefixo `dim_`)
- ✅ Escala 1–10 (não 1–5)

---

## Checklist de Implementação

### Backend (lib)

- [x] `lib/readiness/recovery.ts` — `computeRecoveryCurve()` com tipos `RecoveryCurvePoint` + `RecoveryCurveResult`
- [x] Algoritmo: média global `srpe_load` → sessões alta intensidade → day sampling → médias por dimensão
- [x] Tratar edge cases: sem sessões, sem respostas por dia, `srpe_load` nulo/zero
- [x] `lib/readiness/__tests__/recovery.test.ts` — ≥80% cobertura com fixtures sintéticas

### Backend (Server Actions)

- [x] `getPlayerRecoveryTabData(playerId)` em `player-profile.ts`
- [x] `requireStaffRole()` + `getServiceRoleClient()` + `maybeSingle()` + `auditedRead()`
- [x] Club_id isolation em todos os queries
- [x] Testes em `player-profile.test.ts` — pelo menos: success, player not found, not staff

### Frontend (Components)

- [x] `RecuperacaoTab.tsx` — "use client", `useState/useEffect`, `AbortController`
- [x] Loading skeleton `animate-pulse h-[260px]`
- [x] Error state `role="alert"`
- [x] EmptyState se `sampleSize < 5`
- [x] Recharts `LineChart` com 5 linhas coloridas + `ResponsiveContainer`
- [x] Sample size `n=X sessões intensas analisadas`
- [x] `<TooltipExplain>` junto ao título
- [x] `aria-label` no container recharts

### ProfileTabs.tsx

- [x] `TabId` union type + `TABS` array + `import RecuperacaoTab`
- [x] Panel div com `id`, `role="tabpanel"`, `aria-labelledby`, `hidden`
- [x] Lazy-load: `{activeTab === "recuperacao" && <RecuperacaoTab .../>}`
- [x] `sessionStorage` compatibilidade automática (validação existente já suporta)

### Testing & QA

- [x] `recovery.test.ts` ≥80% — 13 testes: identificação de alta intensidade, day sampling, threshold, edge cases
- [x] `player-profile.test.ts` — 5 novos testes para `getPlayerRecoveryTabData`
- [x] axe-core: `role=tabpanel` já no ProfileTabs, `aria-label` no chart container, `TooltipExplain` accessível
- [x] Todos os testes existentes: `1902/1902 ✅` sem regressões

---

## Recursos & Referências

- **Epics.md:** Story 7.3 — linhas 3110–3141
- **`ProfileTabs.tsx`:** `sparta/src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — adicionar tab 7
- **`FadigaTab.tsx`:** padrão de client component com auditedRead + recharts
- **`CargaAcwrTab.tsx`:** padrão dual-axis, AbortController, SeasonToggle (não necessário aqui)
- **`player-profile.ts`:** Server Actions existentes — seguir padrão `getPlayerFatigueTabData`
- **`acwr.ts`:** `lib/readiness/acwr.ts` — exemplo de função de cálculo readiness com Supabase client
- **`srpe.ts`:** `lib/readiness/srpe.ts` — exemplo de cálculo puro (sem Supabase)
- **`audited.ts`:** `lib/data/audited.ts` — assinatura de `auditedRead()`
- **AGENTS.md:** regras TypeScript (`noUncheckedIndexedAccess`, path aliases, React 19)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `computeRecoveryCurve()` implementado com 3 queries ao DB (session_metrics → sessions → fatigue_responses), agrupamento in-memory por dia e média de 5 dimensões através das N sessões de alta intensidade.
- `sampleSize` global = `totalHighIntensitySessions` (pitfall #3 — threshold conservador: < 5 sessões HI → EmptyState).
- ESLint warning pré-existente corrigido: removido `eslint-disable` desnecessário em `getPlayerPhysicalMetricsTabData` (player_metrics não é flagado pela regra custom/no-direct-health-data-read).
- 18 novos testes: 13 em `recovery.test.ts` + 5 em `player-profile.test.ts`. Total: 1902/1902 ✅; lint ✅.

### File List

- `sparta/src/lib/readiness/recovery.ts` — NOVO
- `sparta/src/lib/readiness/__tests__/recovery.test.ts` — NOVO
- `sparta/src/app/(staff)/plantel/[id]/perfil/RecuperacaoTab.tsx` — NOVO
- `sparta/src/lib/actions/player-profile.ts` — MODIFICADO (import + RecoveryTabData + getPlayerRecoveryTabData + lint fix)
- `sparta/src/lib/actions/player-profile.test.ts` — MODIFICADO (import mock + 5 novos testes)
- `sparta/src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — MODIFICADO (TabId + TABS + import + panel)

---

## Change Log

- 2026-06-01: Implementação completa — computeRecoveryCurve(), getPlayerRecoveryTabData(), RecuperacaoTab, ProfileTabs +tab Recuperação; 18 novos testes ✅; 1902/1902 testes ✅; lint ✅

---

## Review Findings

- [x] [Review][Patch] AC #8 — Add test comment explaining sampleSize threshold logic [recovery.test.ts:238-250] ✅ applied
- [x] [Review][Patch] Verify component import paths (@/components/ui/empty-state exists) [RecuperacaoTab.tsx:16-17] ✅ verified OK
- [x] [Review][Patch] Add explicit error handling for Supabase query failures [recovery.ts:63,84,99] ✅ applied


---

## Story Status

**Status:** done

**Criado por:** bmad-create-story
**Data de criação:** 2026-06-01

Análise completa do contexto — história consolidada para implementação sem erros de conceito ou integração.

---

**Code Review Status:** 3 patch findings, 2 dismissed as spec-compliant
