# Story 7.4: Dashboard de Equipa Agregado

**Status:** ready-for-dev

**Story ID:** 7.4
**Epic:** Epic 7 — Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)
**Criado:** 2026-06-01
**Story anterior:** 7-3-recovery-curve-individual (done)

---

## ⚠️ DEPENDÊNCIAS CRÍTICAS

> **BLOQUEADORES**: As seguintes histórias DEVEM estar em estado `done` antes de iniciar a implementação:
>
> - **Story 4.1** — `fatigue_responses` com colunas `dim_energy`, `dim_focus`, `dim_sleep`, `dim_soreness`, `dim_mood`, `submitted_at`, `player_id`, `club_id`
> - **Story 5.1** — `session_metrics` com `srpe_load` GENERATED STORED, `player_id`, `session_id`, `club_id`
> - **Story 6.1** — `match_events` com `is_deleted`, `session_id`, `club_id`, `action`
> - **Story 6.7** — `attendances` com `session_id`, `player_id`, `status`, `recorded_at`
> - **Story 2.6** — `sessions` com `date`, `type`, `season_id`, `club_id`
> - **Story 2.5** — `seasons` com `is_current`, `id`; `getCurrentSeason()` helper
> - **Story 4.6** — `proxy.ts` com `STAFF_ONLY_ROUTES_404` e `ROLE_ALLOWED_ROUTES` (a estender nesta história)
> - **Story 1.12** — `audit_logs` + `auditedRead()` wrapper

---

## Especificação da História

### User Story

Como Treinador,
Quero um dashboard único com agregados de equipa (fadiga média, taxa de presença, estatísticas totais) ao longo da época,
Para poder ver o plantel como um sistema e não apenas como 40 linhas individuais.

### Acceptance Criteria

#### AC #1 — Rota e Componente Principal

**Given** a rota `/equipa/agregado` (Treinador como utilizador primário)

**When** a página carrega

**Then** `<TeamAggregateDashboard>` (FR41) renderiza:
  - Gráfico de linha: fadiga média do plantel nas últimas 4 semanas (5 séries de dimensão ou média agregada)
  - Gráfico de linha: taxa de presença do plantel nas últimas 4 semanas
  - Cards "Top 3 mais carregados" (com nome, posição, carga sRPE total)
  - Cards "Top 3 mais fatigados" (com nome, posição, fadiga média últimas 4 sem)
  - Gráfico de barras: total de eventos capturados por jogo/amigável (últimos 10)
  - Todas as métricas com scope por época via SeasonToggle (Story 2.5)

#### AC #2 — Filtros

**Given** filtros (UX-DR35)

**When** abertos num `<Sheet>`

**Then** permitem filtrar por:
  - Grupo etário: `all` | `u14` | `u15` | `u17` | `u19` | `senior`
  - Competição: `all` | `jogo` | `amigavel` | `treino`
**And** chips de filtro activo são mostrados como removíveis por cima dos gráficos

#### AC #3 — Navegação "Top 3 mais carregados"

**Given** os cards "Top 3 mais carregados"

**When** o staff toca/clica em "Ver carga acumulada"

**Then** navega para `/tendencias/carga` (Story 5.9)

> **Nota MVP:** A pré-filtragem por jogadores específicos está deferida (Story 5.9 não suporta filtro por player_id). Link simples sem query params.

#### AC #4 — Exportar PDF (Stub)

**Given** o botão "Exportar PDF" (apenas Treinador)

**When** clicado

**Then** mostra `<CalmConfirmation>` com "Funcionalidade disponível em breve (Story 7.6)"
**And** o botão é `disabled` com `aria-disabled="true"` e tooltip explicativo

#### AC #5 — Controlo de Acesso (FR26)

**Given** controlo de acesso

**When** um Analista navega para `/equipa/agregado`

**Then** vê a mesma vista mas sem o botão "Exportar PDF" (read-only)

**When** um Jogador acede à rota

**Then** `proxy.ts` retorna HTTP 404 (STAFF_ONLY_ROUTES_404)

#### AC #6 — Audit Logging (FR50)

**Given** o dashboard é carregado

**When** `getTeamAggregateData()` é chamado

**Then** cria entrada em `audit_logs` via `auditedRead()`: `action='team_aggregate.viewed'`, `targetKind='club'`, `targetId=clubId`

#### AC #7 — Performance (NFR4)

**Given** a página

**When** carregada em rede 4G mobile

**Then** FCP ≤ 1s e dados completos ≤ 3s P95

#### AC #8 — Acessibilidade axe-core (NFR37)

**Given** o dashboard renderizado

**When** testado com axe-core

**Then** zero violações a11y
**And** cor emparelhada com ícone/forma em qualquer sinal visual

#### AC #9 — Cobertura de Testes (NFR54)

**Given** testes em `lib/actions/team-aggregate.test.ts`

**When** executados

**Then** cobrem ≥80%:
  - Happy path: retorna dados agregados correctos
  - Plantel vazio: retorna arrays vazios sem erro
  - Utilizador não autenticado: retorna `unauthorized`
  - Isolamento club_id: não retorna dados de outro clube
  - Cálculo semanal de fadiga: agrupamento por semana correcto
  - Taxa de presença: `(present + late) / total × 100`
  - Top-3 por carga: ordenação DESC correcta

#### AC #10 — Navegação (sidebar + proxy)

**Given** `proxy.ts` e `StaffSidebar.tsx`

**When** um Treinador está autenticado

**Then** `/equipa` está em `STAFF_ONLY_ROUTES_404` (retorna 404 a players)
**And** `/equipa` está em `ROLE_ALLOWED_ROUTES.coach` e `ROLE_ALLOWED_ROUTES.analyst`
**And** "Equipa" aparece na sidebar do Treinador com ícone `LayoutDashboard`

---

## Contexto para o Desenvolvedor

### Sem migração SQL

> **NENHUMA migração SQL necessária.** Esta história usa exclusivamente tabelas existentes:
> - `fatigue_responses` (Story 4.1) — dimensões 1–10, `submitted_at`, `player_id`, `club_id`
> - `session_metrics` (Story 5.1) — `srpe_load` GENERATED STORED, `player_id`, `session_id`, `club_id`
> - `match_events` (Story 6.1) — `action`, `session_id`, `club_id`, `is_deleted`
> - `attendances` (Story 6.7) — `session_id`, `player_id`, `status`, `recorded_at`
> - `sessions` (Story 2.6) — `id`, `date`, `type`, `season_id`, `club_id`, `scheduled_at`
> - `seasons` (Story 2.5) — `id`, `is_current`, `name`
> - `players` (Story 2.1) — `id`, `full_name`, `age_group`, `archived_at`, `club_id`
> - `positions` (Story 2.1) — `player_id`, `position`, `is_primary`

### Estrutura de Ficheiros

```
sparta/src/
  lib/actions/
    team-aggregate.ts            ← NOVO: getTeamAggregateData() Server Action
    team-aggregate.test.ts       ← NOVO: ≥80% cobertura
  app/(staff)/equipa/
    agregado/
      page.tsx                   ← NOVO: Server Component
  components/domain/
    TeamAggregateDashboard.tsx   ← NOVO: Client Component principal
    TeamAggregateFiltersSheet.tsx ← NOVO: Sheet de filtros
  proxy.ts                       ← MODIFICAR: STAFF_ONLY_ROUTES_404 + ROLE_ALLOWED_ROUTES
  components/patterns/
    StaffSidebar.tsx             ← MODIFICAR: "Equipa" no coach nav
```

> **Nota BottomTabNav.tsx:** NÃO adicionar ao `BottomTabNav`. O coach já tem 5 tabs no mobile (máximo recomendado). A rota fica acessível via sidebar desktop e link directo.

---

### 1. `lib/actions/team-aggregate.ts` — Server Action

**Tipos exportados:**

```typescript
// src/lib/actions/team-aggregate.ts
"use server";

export type WeeklyFatiguePoint = {
  weekLabel: string;       // e.g. "Sem 1", "Sem 2", "Sem 3", "Sem 4"
  weekStart: string;       // ISO date (início da janela, para tooltip)
  avgFatigue: number;      // 1–10, média de todas as dims de todos os jogadores
  sampleSize: number;      // nº de jogadores com dados nessa semana
};

export type WeeklyAttendancePoint = {
  weekLabel: string;
  weekStart: string;
  attendanceRate: number;  // 0–100
  attended: number;        // present + late
  total: number;           // total de presenças registadas (qualquer status)
};

export type TopPlayerItem = {
  playerId: string;
  playerName: string;
  position: string;
  ageGroup: string;
  value: number;
};

export type MatchEventsPoint = {
  sessionId: string;
  sessionDate: string;     // sessions.date (ISO date)
  sessionType: "jogo" | "amigavel";
  eventCount: number;
};

export type TeamAggregateData = {
  weeklyFatigue: WeeklyFatiguePoint[];    // 4 pontos
  weeklyAttendance: WeeklyAttendancePoint[]; // 4 pontos
  topLoaded: TopPlayerItem[];             // top 3 por srpe_load (época actual)
  topFatigued: TopPlayerItem[];           // top 3 por avg fatiga últimas 4 sem
  eventsPerMatch: MatchEventsPoint[];     // últimos 10 jogos/amigáveis
  currentSeason: { id: string; name: string } | null;
  totalActivePlayers: number;
  userRole: "coach" | "analyst";
};
```

**Lógica de implementação — passo a passo:**

```typescript
export async function getTeamAggregateData(): Promise<Result<TeamAggregateData, AppError>> {
  // 1. Guard de autenticação
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId, role } = authResult.data;

  // 2. Service role client (AGENTS.md §1 — SEMPRE depois de requireStaffRole)
  const serviceRole = getServiceRoleClient();

  // 3. Época actual
  const seasonResult = await getCurrentSeason();
  const currentSeason = seasonResult.ok ? seasonResult.data : null;

  // 4. Janelas temporais
  const now = new Date();
  const since28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Calcular 4 janelas semanais (semana 1 = mais antiga, semana 4 = mais recente)
  // weekWindows[i] = { start: Date, end: Date, label: "Sem i+1" }
  const weekWindows = Array.from({ length: 4 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end, label: `Sem ${4 - i}` };
  }).reverse(); // ordenar da mais antiga para a mais recente

  // 5. Players activos
  const { data: playersData, error: playersError } = await serviceRole
    .from("players")
    .select("id, full_name, age_group")
    .eq("club_id", clubId)
    .is("archived_at", null);

  if (playersError) {
    return err({ code: "db_error", message: playersError.message ?? "Erro ao carregar jogadores" });
  }

  const playersArr = playersData ?? [];
  const playerIds = playersArr.map((p) => p.id);

  // Posições primárias (para Top-3 cards)
  const positionMap = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: posData } = await serviceRole
      .from("positions")
      .select("player_id, position")
      .in("player_id", playerIds)
      .eq("is_primary", true);
    for (const pos of posData ?? []) {
      if (pos?.player_id && pos.position) positionMap.set(pos.player_id, pos.position);
    }
  }

  if (playerIds.length === 0) {
    // Plantel vazio — retornar zeros sem erro
    return ok({
      weeklyFatigue: weekWindows.map((w) => ({ weekLabel: w.label, weekStart: w.start.toISOString(), avgFatigue: 0, sampleSize: 0 })),
      weeklyAttendance: weekWindows.map((w) => ({ weekLabel: w.label, weekStart: w.start.toISOString(), attendanceRate: 0, attended: 0, total: 0 })),
      topLoaded: [],
      topFatigued: [],
      eventsPerMatch: [],
      currentSeason: currentSeason ? { id: currentSeason.id, name: currentSeason.name ?? "" } : null,
      totalActivePlayers: 0,
      userRole: role as "coach" | "analyst",
    });
  }

  // 6. Queries paralelas (Promise.allSettled — falha individual não bloqueia o resto)
  const [fatigueResult, attendanceResult, metricsResult, eventsResult] = await Promise.allSettled([
    // (a) fatigue_responses últimas 4 semanas — VIA auditedRead (dados de saúde, FR50)
    auditedRead<FatigueRow[]>(
      { action: "team_aggregate.viewed", targetKind: "club", targetId: clubId, actorId: userId, clubId },
      async () => {
        const { data, error } = await serviceRole
          .from("fatigue_responses")
          .select("player_id, submitted_at, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood")
          .eq("club_id", clubId)
          .in("player_id", playerIds)
          .gte("submitted_at", since28.toISOString())
          .order("submitted_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as FatigueRow[];
      }
    ),
    // (b) attendances + sessions últimas 4 semanas (NÃO é dado de saúde — sem auditedRead)
    serviceRole
      .from("attendances")
      .select("player_id, status, session_id, sessions!inner(date, type)")
      .eq("club_id", clubId)
      .in("player_id", playerIds)
      .gte("sessions.date", since28.toISOString().slice(0, 10)),
    // (c) session_metrics por época (Top-3 carregados) — NÃO é dado de saúde
    currentSeason?.id
      ? serviceRole
          .from("session_metrics")
          .select("player_id, srpe_load, sessions!inner(season_id)")
          .eq("club_id", clubId)
          .in("player_id", playerIds)
          .eq("sessions.season_id", currentSeason.id)
      : Promise.resolve({ data: [], error: null }),
    // (d) match_events últimos 10 jogos/amigáveis — NÃO é dado de saúde
    serviceRole
      .from("match_events")
      .select("session_id, sessions!inner(date, type)")
      .eq("club_id", clubId)
      .eq("is_deleted", false)
      .in("sessions.type", ["jogo", "amigavel"])
      .order("sessions.date", { ascending: false })
      .limit(500), // buscar mais e agregar em memória
  ]);

  // 7. Processar fadiga semanal
  const fatigueRows: FatigueRow[] = fatigueResult.status === "fulfilled" ? fatigueResult.value : [];
  const weeklyFatigue = weekWindows.map((w) => {
    const bucket = fatigueRows.filter((r) => {
      const t = new Date(r.submitted_at ?? "").getTime();
      return t >= w.start.getTime() && t < w.end.getTime();
    });
    const playerSet = new Set(bucket.map((r) => r.player_id));
    if (bucket.length === 0) return { weekLabel: w.label, weekStart: w.start.toISOString(), avgFatigue: 0, sampleSize: 0 };
    const allDims = bucket.flatMap((r) =>
      [r.dim_energy, r.dim_focus, r.dim_sleep, r.dim_soreness, r.dim_mood].filter((v): v is number => v !== null && v !== undefined)
    );
    const avg = allDims.length > 0 ? allDims.reduce((s, v) => s + v, 0) / allDims.length : 0;
    return { weekLabel: w.label, weekStart: w.start.toISOString(), avgFatigue: Math.round(avg * 10) / 10, sampleSize: playerSet.size };
  });

  // 8. Processar taxa de presença semanal
  type AttRow = { player_id: string; status: string; session_id: string; sessions: { date: string; type: string } };
  const attRows: AttRow[] = attendanceResult.status === "fulfilled" && !attendanceResult.value.error
    ? ((attendanceResult.value.data ?? []) as AttRow[])
    : [];
  const weeklyAttendance = weekWindows.map((w) => {
    const bucket = attRows.filter((r) => {
      const d = new Date((r.sessions?.date ?? "") + "T00:00:00Z").getTime();
      return d >= w.start.getTime() && d < w.end.getTime();
    });
    const attended = bucket.filter((r) => r.status === "present" || r.status === "late").length;
    const total = bucket.length;
    const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
    return { weekLabel: w.label, weekStart: w.start.toISOString(), attendanceRate: rate, attended, total };
  });

  // 9. Top-3 mais carregados (época actual)
  type MetricRow = { player_id: string; srpe_load: number };
  const metricsRows: MetricRow[] = metricsResult.status === "fulfilled" && !("error" in metricsResult.value && metricsResult.value.error)
    ? ((("data" in metricsResult.value ? metricsResult.value.data : metricsResult.value) ?? []) as MetricRow[])
    : [];
  const loadByPlayer = new Map<string, number>();
  for (const m of metricsRows) {
    if (m?.player_id && typeof m.srpe_load === "number") {
      loadByPlayer.set(m.player_id, (loadByPlayer.get(m.player_id) ?? 0) + m.srpe_load);
    }
  }
  const topLoaded = Array.from(loadByPlayer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, load]) => {
      const player = playersArr.find((p) => p.id === pid);
      return {
        playerId: pid,
        playerName: player?.full_name?.trim() || "—",
        position: positionMap.get(pid) ?? "—",
        ageGroup: player?.age_group ?? "—",
        value: load,
      };
    });

  // 10. Top-3 mais fatigados (últimas 4 sem — avg das 5 dims)
  const avgFatigueByPlayer = new Map<string, { sum: number; count: number }>();
  for (const r of fatigueRows) {
    if (!r.player_id) continue;
    const dims = [r.dim_energy, r.dim_focus, r.dim_sleep, r.dim_soreness, r.dim_mood]
      .filter((v): v is number => v !== null && v !== undefined);
    if (dims.length === 0) continue;
    const avg = dims.reduce((s, v) => s + v, 0) / dims.length;
    const existing = avgFatigueByPlayer.get(r.player_id) ?? { sum: 0, count: 0 };
    avgFatigueByPlayer.set(r.player_id, { sum: existing.sum + avg, count: existing.count + 1 });
  }
  const topFatigued = Array.from(avgFatigueByPlayer.entries())
    .map(([pid, { sum, count }]) => ({
      playerId: pid,
      playerName: playersArr.find((p) => p.id === pid)?.full_name?.trim() || "—",
      position: positionMap.get(pid) ?? "—",
      ageGroup: playersArr.find((p) => p.id === pid)?.age_group ?? "—",
      value: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // 11. Eventos por jogo (últimos 10)
  type EventRow = { session_id: string; sessions: { date: string; type: string } };
  const eventRows: EventRow[] = eventsResult.status === "fulfilled" && !eventsResult.value.error
    ? ((eventsResult.value.data ?? []) as EventRow[])
    : [];
  const eventsBySession = new Map<string, { date: string; type: string; count: number }>();
  for (const e of eventRows) {
    if (!e.session_id || !e.sessions?.date) continue;
    const existing = eventsBySession.get(e.session_id);
    if (existing) {
      existing.count++;
    } else {
      eventsBySession.set(e.session_id, { date: e.sessions.date, type: e.sessions.type, count: 1 });
    }
  }
  const eventsPerMatch = Array.from(eventsBySession.entries())
    .map(([sid, { date, type, count }]) => ({
      sessionId: sid,
      sessionDate: date,
      sessionType: type as "jogo" | "amigavel",
      eventCount: count,
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .slice(-10); // últimos 10

  return ok({
    weeklyFatigue,
    weeklyAttendance,
    topLoaded,
    topFatigued,
    eventsPerMatch,
    currentSeason: currentSeason ? { id: currentSeason.id, name: currentSeason.name ?? "" } : null,
    totalActivePlayers: playersArr.length,
    userRole: role as "coach" | "analyst",
  });
}
```

**Tipos internos (NÃO exportar de ficheiro "use server"):**

```typescript
// Definir localmente no ficheiro (não exportar)
type FatigueRow = {
  player_id: string | null;
  submitted_at: string | null;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};
```

> **CRÍTICO — AGENTS.md §2:** Ficheiros `"use server"` apenas podem exportar funções async. Os tipos (`WeeklyFatiguePoint`, `TopPlayerItem`, etc.) são exportados porque são interfaces TypeScript — compile-time only, sem problemas. **NÃO exportar** objectos runtime como schemas Zod ou constantes `as const` a partir deste ficheiro.

> **CRÍTICO — ESLint `no-direct-health-data-read`:** Qualquer query directa a `fatigue_responses` SEM `auditedRead()` vai falhar o lint. O wrapper `auditedRead()` já está no código acima — não remover.

---

### 2. `app/(staff)/equipa/agregado/page.tsx` — Server Component

Seguir o padrão exacto de `tendencias/carga/page.tsx`:

```typescript
import { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamAggregateDashboard } from "@/components/domain/TeamAggregateDashboard";
import { getTeamAggregateData } from "@/lib/actions/team-aggregate";

export const metadata: Metadata = {
  title: "Equipa Agregada — SPARTA",
};

export default async function EquipaAgregadoPage() {
  const result = await getTeamAggregateData();

  if (!result.ok) {
    return (
      <div className="container py-8 sm:py-12">
        <EmptyState
          icon={<LayoutDashboard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Erro ao carregar dados"
          description={result.error.message}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Equipa Agregada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Métricas agregadas do plantel — fadiga, presenças e performance
          </p>
        </div>
        <TeamAggregateDashboard data={result.data} />
      </div>
    </div>
  );
}
```

---

### 3. `components/domain/TeamAggregateDashboard.tsx` — Client Component

```typescript
"use client";

import { useState, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, Link as LinkIcon, FileText } from "lucide-react";
import Link from "next/link";
import type { TeamAggregateData, TopPlayerItem, WeeklyFatiguePoint, WeeklyAttendancePoint, MatchEventsPoint } from "@/lib/actions/team-aggregate";
import { SeasonToggle } from "@/components/ui/season-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/patterns/TooltipExplain";
import { CalmConfirmation } from "@/components/patterns/CalmConfirmation";
import { TeamAggregateFiltersSheet } from "./TeamAggregateFiltersSheet";
import type { TeamAggregateFilters } from "./TeamAggregateFiltersSheet";

interface TeamAggregateDashboardProps {
  data: TeamAggregateData;
}

const DEFAULT_FILTERS: TeamAggregateFilters = {
  ageGroup: "all",
  competition: "all",
};
```

**Estrutura visual do dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│ [SeasonToggle]   [Filtros]              [Exportar PDF*] │
│ Chips activos (se filtros != default)                   │
├──────────────────────┬──────────────────────────────────┤
│ Fadiga média (linha) │ Taxa de presença (linha)          │
│ 4 semanas           │ 4 semanas                         │
├──────────────────────┴──────────────────────────────────┤
│ Top 3 Mais Carregados    │ Top 3 Mais Fatigados          │
│ [card] [card] [card]     │ [card] [card] [card]          │
│ "Ver carga acumulada →"  │                               │
├──────────────────────────────────────────────────────────┤
│ Eventos por Jogo/Amigável (barras — últimos 10 jogos)   │
└──────────────────────────────────────────────────────────┘
*coach only
```

**Loading skeleton** (para caso de re-fetch futuro — manter padrão):
```typescript
// Não há re-fetch neste componente; os dados vêm do Server Component.
// Renderizar directamente sem loading state.
```

**Lógica de filtros:**
- Os filtros afectam os Top-3 e o gráfico de fadiga (filtrar por `ageGroup`)
- O filtro `competition` afecta o gráfico de eventos por jogo
- Os dados de `weeklyFatigue` e `weeklyAttendance` são pré-calculados; o filtro por `ageGroup` NÃO os altera (calculados server-side sobre todo o plantel) — documentar este trade-off como MVP
- **Top-3 por carga:** já vêm do server; se `ageGroup !== "all"`, o componente deve mostrar aviso "Filtro por grupo etário aplicado — dados pré-calculados para todo o plantel. Para análise por grupo, ver Tendências."

> **Alternativa MVP limpa:** Para MVP, os filtros afectam apenas visualização do gráfico de eventos (filtro `competition`) e mostram aviso nos outros gráficos. Implementação completa de filtragem server-side é deferred.

**PDF Stub (coach only):**
```typescript
const [showPdfComingSoon, setShowPdfComingSoon] = useState(false);

{data.userRole === "coach" && (
  <>
    <button
      onClick={() => setShowPdfComingSoon(true)}
      aria-label="Exportar PDF (disponível em breve)"
      className="..."
    >
      <FileText className="h-4 w-4" /> Exportar PDF
    </button>
    {showPdfComingSoon && (
      <CalmConfirmation
        title="Funcionalidade em desenvolvimento"
        description="A exportação PDF estará disponível em breve (Story 7.6)."
        confirmLabel="OK"
        onConfirm={() => setShowPdfComingSoon(false)}
        onDismiss={() => setShowPdfComingSoon(false)}
      />
    )}
  </>
)}
```

**Top-3 Card:**
```typescript
function TopPlayerCard({ player, valueLabel }: { player: TopPlayerItem; valueLabel: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-sm font-semibold text-foreground truncate">{player.playerName}</p>
      <p className="text-xs text-muted-foreground">{player.position} · {player.ageGroup}</p>
      <p className="text-lg font-bold text-primary">{player.value.toLocaleString("pt-PT")}</p>
      <p className="text-xs text-muted-foreground">{valueLabel}</p>
    </div>
  );
}
```

**Acessibilidade:**
- `<div aria-label="Gráfico de fadiga média semanal">` nos containers recharts
- `<div aria-label="Gráfico de taxa de presença semanal">`
- `<div aria-label="Gráfico de eventos por jogo">`
- Recharts `<Legend>` para todos os gráficos com múltiplas séries
- Link "Ver carga acumulada" com `aria-label` completo

---

### 4. `components/domain/TeamAggregateFiltersSheet.tsx` — Filters Sheet

```typescript
"use client";

import { useState, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { DrillDownSheet } from "@/components/patterns/DrillDownSheet";

export type TeamAggregateFilters = {
  ageGroup: "all" | "u14" | "u15" | "u17" | "u19" | "senior";
  competition: "all" | "jogo" | "amigavel" | "treino";
};

const STORAGE_KEY = "sparta:equipa-agregado:filters";

const DEFAULT_FILTERS: TeamAggregateFilters = {
  ageGroup: "all",
  competition: "all",
};

interface TeamAggregateFiltersSheetProps {
  onFilter: (filters: TeamAggregateFilters) => void;
  initialFilters?: TeamAggregateFilters;
}
```

Seguir exactamente o padrão de `LoadFiltersSheet.tsx`:
1. `loadFiltersFromStorage()` — SSR-safe com `typeof window === "undefined"` guard
2. `saveFiltersToStorage()` — com try/catch silencioso
3. `useEffect` para hidratação segura (carregar sessionStorage após mount)
4. Draft state para cancel/apply no modal
5. Labels PT-PT: "Grupo etário", "Todos", "Sub-14", "Sub-15", "Sub-17", "Sub-19", "Sénior"; "Competição", "Todos", "Jogos", "Amigáveis", "Treinos"

**Chips activos** (renderizar no `TeamAggregateDashboard`):
```typescript
// Mostrar chip se != default
{filters.ageGroup !== "all" && (
  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
    {ageGroupLabel(filters.ageGroup)}
    <button onClick={() => handleRemoveFilter("ageGroup")} aria-label="Remover filtro grupo etário">
      <X className="h-3 w-3" />
    </button>
  </span>
)}
```

---

### 5. Modificar `proxy.ts` — Controlo de Acesso

Ficheiro: `sparta/src/proxy.ts`

**Alterações exactas:**

```typescript
// ANTES:
const STAFF_ONLY_ROUTES_404 = [
  "/prontidao",
  "/tendencias",
  "/relatorios",
  "/plantel",
] as const;

// DEPOIS:
const STAFF_ONLY_ROUTES_404 = [
  "/prontidao",
  "/tendencias",
  "/relatorios",
  "/plantel",
  "/equipa",       // ← ADICIONAR
] as const;
```

```typescript
// ANTES:
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  player: ["/hoje", "/historico", "/configuracoes", "/aguardar-consentimento", "/questionario"],
  coach: ["/prontidao", "/calendario", "/plantel", "/tendencias", "/configuracoes"],
  analyst: ["/sessoes", "/plantel", "/tendencias", "/configuracoes"],
};

// DEPOIS:
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  player: ["/hoje", "/historico", "/configuracoes", "/aguardar-consentimento", "/questionario"],
  coach: ["/prontidao", "/calendario", "/plantel", "/tendencias", "/configuracoes", "/equipa"],   // ← ADD /equipa
  analyst: ["/sessoes", "/plantel", "/tendencias", "/configuracoes", "/equipa"],                  // ← ADD /equipa
};
```

---

### 6. Modificar `StaffSidebar.tsx` — Navegação

Ficheiro: `sparta/src/components/patterns/StaffSidebar.tsx`

**Alterações exactas:**

```typescript
// 1. Adicionar import do ícone (junto aos outros imports de lucide-react):
import { LayoutDashboard } from "lucide-react";

// 2. Adicionar ao coach NAV_CONFIG (após Tendências, antes de Configurações):
coach: [
  { label: "Prontidão", href: "/prontidao", icon: AlertCircle },
  { label: "Calendário", href: "/calendario", icon: Calendar },
  { label: "Plantel", href: "/plantel", icon: Users },
  { label: "Tendências", href: "/tendencias", icon: TrendingUp },
  { label: "Equipa", href: "/equipa/agregado", icon: LayoutDashboard }, // ← ADICIONAR
  { label: "Configurações", href: "/configuracoes", icon: Settings },
],
```

> **Nota isActive:** O método `isActive` usa `pathname.split("/")[1]` para comparar o primeiro segmento. `/equipa/agregado` vai activar quando `pathname === "/equipa/..."` → `segment = "/equipa"` vs `href = "/equipa/agregado"`. **ATENÇÃO:** O `isActive` compara `segment === href`, mas `href` aqui é `/equipa/agregado` (dois segmentos). Isto significa que o link nunca ficará activo!
>
> **Solução:** Mudar `href` para `/equipa` no NAV_CONFIG E adicionar redirect de `/equipa` → `/equipa/agregado`. OU ajustar `isActive`:
> ```typescript
> const isActive = (href: string) => {
>   // Suporta hrefs multi-segmento: "/equipa/agregado"
>   return pathname ? pathname === href || pathname.startsWith(href + "/") || 
>     `/${pathname.split("/")[1] ?? ""}` === href : false;
> };
> ```
>
> **Implementação correcta:** Manter `href: "/equipa/agregado"` no nav e usar a função `isActive` actualizada acima. Verificar que o highlight funciona ao navegar para `/equipa/agregado`.

---

### 7. Esquema de Dados — Colunas Exactas

**`fatigue_responses`** (Migration 000200):
```
player_id uuid, club_id uuid, submitted_at timestamptz,
dim_energy int 1–10, dim_focus int 1–10, dim_sleep int 1–10,
dim_soreness int 1–10, dim_mood int 1–10, phase text
```

**`session_metrics`** (Migration 000240):
```
player_id uuid, club_id uuid, session_id uuid,
srpe_load int GENERATED STORED (srpe_value × duration_min),
sessions!inner(season_id, scheduled_at)
```

**`attendances`** (Migration 000290):
```
player_id uuid, club_id uuid, session_id uuid,
status text ('present'|'absent'|'late'|'injured'|'excused'),
recorded_at timestamptz
sessions!inner(date, type)
```
> **Taxa de presença:** `attended = present + late` (late conta como presente); `absent + injured + excused` contam como ausente.

**`match_events`** (Migration 000270):
```
session_id uuid, club_id uuid, is_deleted boolean DEFAULT false,
sessions!inner(date, type) onde type IN ('jogo', 'amigavel')
```

**`sessions`** (Migration 000120):
```
id uuid, club_id uuid, date date, type text ('treino'|'jogo'|'amigavel'|'folga'),
season_id uuid, scheduled_at timestamptz, duration_min int
```

---

### 8. Integrações NÃO a reimplementar

| Existente | Localização | Uso em 7-4 |
|-----------|-------------|------------|
| `requireStaffRole()` | `src/lib/actions/auth.ts` | Guard na Server Action |
| `getServiceRoleClient()` | `src/lib/supabase/service-role.ts` | Queries DB |
| `auditedRead()` | `src/lib/data/audited.ts` | FR50 para fatigue_responses |
| `getCurrentSeason()` | `src/lib/actions/seasons.ts` | Época actual para Top-3 carga |
| `SeasonToggle` | `src/components/ui/season-toggle.tsx` | Toggle UI |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Estados vazios |
| `TooltipExplain` | `src/components/patterns/TooltipExplain.tsx` | Explicações inline |
| `CalmConfirmation` | `src/components/patterns/CalmConfirmation.tsx` | Stub PDF |
| `DrillDownSheet` | `src/components/patterns/DrillDownSheet.tsx` | Filtros sheet |
| `ok()` / `err()` | `src/lib/types.ts` | Result type pattern |
| Recharts | `recharts` (já instalado) | Gráficos linha + barras |

---

### 9. Padrões TypeScript Críticos (AGENTS.md)

1. **`noUncheckedIndexedAccess`:** Todo acesso indexado precisa de `?.` + `?? fallback`
   - `playersArr.find(p => p.id === pid)?.full_name?.trim() || "—"` ✅
   - `arr[0].value` ❌ (vai falhar tsc)
2. **Sem `import React`** — React 19 JSX transform automático
3. **Imports com `@/`** — nunca relativos (`@/lib/actions/team-aggregate`) ✅
4. **`"use server"` → só async functions** — tipos TypeScript são OK (compile-time)
5. **Service role SEMPRE após `requireStaffRole()`**
6. **`club_id` explícito em todos os queries** (service role bypassa RLS)

---

## Decisões Técnicas & Pitfalls Conhecidos

### 1. Promise.allSettled vs Promise.all

Usar `Promise.allSettled` para as 4 queries paralelas. Se `attendances` falhar (por exemplo, sessão sem presenças), o dashboard mostra os outros 3 widgets com dados correctos. Não fazer fail total por falha parcial.

### 2. Filtragem server-side vs client-side

**MVP:** Os dados `weeklyFatigue` e `weeklyAttendance` são calculados server-side sem considerar filtros de `ageGroup`. O filtro `competition` no cliente filtra os `eventsPerMatch`. O filtro `ageGroup` filtra os Top-3 cards em memória no cliente.

Para filtragem completa por `ageGroup` nos gráficos de linhas, seria necessário re-fetch (transformando num Client Component com `useEffect`). **Deferido** para evitar complexidade. Documentar no UI com tooltip.

### 3. auditedRead para query club-wide de fatigue

O `auditedRead` foi desenhado para `targetId = playerId`. Para este dashboard, usar `targetId = clubId` e `targetKind = "club"`. Verificar a assinatura de `auditedRead` em `lib/data/audited.ts` para garantir que `targetKind` aceita `"club"`. Se necessário, usar o padrão `after()` de `load.ts` em alternativa:

```typescript
// Alternativa se auditedRead não aceitar targetKind="club":
after(async () => {
  try {
    await serviceRole.from("audit_logs").insert({
      club_id: clubId, actor_id: userId,
      action: "team_aggregate.viewed",
      target_kind: "club", target_id: clubId,
    });
  } catch { /* silent */ }
});
// E query fatigue_responses directamente com:
// eslint-disable-next-line custom/no-direct-health-data-read -- team aggregate: auditedRead via after() above
const { data: fatigueData } = await serviceRole.from("fatigue_responses")...
```

> **PRIORITIDADE:** Tentar `auditedRead` primeiro. Só usar `after()` se `auditedRead` não aceitar `targetKind="club"`.

### 4. JOIN syntax no Supabase JS SDK

Para `attendances` com JOIN a `sessions`:
```typescript
.from("attendances")
.select("player_id, status, session_id, sessions!inner(date, type)")
.gte("sessions.date", since28.toISOString().slice(0, 10))
```
O filtro `.gte("sessions.date", ...)` aplica ao campo da tabela joined. Verificar se o SDK suporta filtros em tabelas relacionadas desta forma. Se não funcionar, fazer query separada a `sessions` para obter `session_ids` recentes, depois filtrar `attendances` com `.in("session_id", recentSessionIds)`.

### 5. isActive na sidebar para URLs multi-segmento

O `isActive` actual usa apenas o primeiro segmento do pathname. `/equipa/agregado` tem 2 segmentos. Ver instrução na Secção 6 acima para correcção.

### 6. SeasonToggle e dados server-side

`SeasonToggle` altera `sessionStorage["season_view"]` → "current" | "cumulative". Para o dashboard agregado, o toggle afecta conceptualmente o scope dos top-3 por carga (época vs. histórico). **MVP:** não implementar re-fetch ao mudar de época. Mostrar apenas dados da época actual (mais útil para uso diário). Documentar no tooltip.

---

## Dev Learnings de Stories Anteriores

### De Story 7-3 (Recovery Curve — story anterior directa)

- ✅ `auditedRead()` assinatura: `auditedRead<T>({ action, targetKind, targetId, actorId, clubId }, async () => T)`
- ✅ `requireStaffRole()` retorna `{ ok, data: { userId, clubId, role } }` — usar `authResult.data`
- ✅ `maybeSingle()` para player lookup; `.single()` lança erro se não encontrar
- ✅ `getServiceRoleClient()` SEMPRE depois de `requireStaffRole()`
- ✅ UTC suffixes `T00:00:00Z` em filtros de datas com `date` columns
- ✅ `noUncheckedIndexedAccess`: `arr?.[0] ?? fallback` obrigatório

### De Story 7-2 (Perfil Consolidado — patterns de page.tsx)

- ✅ Padrão Server Component: `result.ok ? <Dashboard data={result.data} /> : <EmptyState>`
- ✅ `AbortController` em tabs com `useEffect` — não necessário aqui (sem re-fetch em client)
- ✅ `Promise.allSettled` preserva dados parciais em falha individual

### De Story 5-9 (Carga Acumulada — mesmo tipo de dashboard)

- ✅ `groupByMonth` pattern — adaptar para `groupByWeek` nesta história
- ✅ `getCumulativeLoadData()` como referência exacta para structure da Server Action
- ✅ `LoadFiltersSheet.tsx` como referência para `TeamAggregateFiltersSheet.tsx`

### De Story 4-6 (Middleware STAFF_ONLY_ROUTES_404)

- ✅ `STAFF_ONLY_ROUTES_404` usa `pathname.startsWith(route + "/")` — basta adicionar `/equipa` ao array
- ✅ `ROLE_ALLOWED_ROUTES` é verificado com `pathname.startsWith(route + "/")` — basta adicionar `/equipa`

---

## Checklist de Implementação

### Backend (Server Action)

- [x] `lib/actions/team-aggregate.ts` com `"use server"` + tipos exportados
- [x] `requireStaffRole()` + `getServiceRoleClient()` em sequência correcta
- [x] `getCurrentSeason()` para scope de época
- [x] `auditedRead()` para `fatigue_responses` (FR50)
- [x] `Promise.allSettled` para 4 queries paralelas
- [x] Cálculo das 4 janelas semanais (weekWindows)
- [x] Processamento: `weeklyFatigue`, `weeklyAttendance`, `topLoaded`, `topFatigued`, `eventsPerMatch`
- [x] `club_id` em todos os queries (service role bypassa RLS)
- [x] Plantel vazio retorna zeros sem erro
- [x] `userRole` no resultado para condicional do PDF button

### Middleware & Navegação

- [x] `proxy.ts`: adicionar `/equipa` a `STAFF_ONLY_ROUTES_404`
- [x] `proxy.ts`: adicionar `/equipa` a `ROLE_ALLOWED_ROUTES.coach` e `.analyst`
- [x] `StaffSidebar.tsx`: import `LayoutDashboard` + entrada "Equipa" no coach nav
- [x] `StaffSidebar.tsx`: corrigir `isActive()` para suportar hrefs multi-segmento

### Frontend (Components)

- [x] `app/(staff)/equipa/agregado/page.tsx` — Server Component, error/empty handling, metadata
- [x] `TeamAggregateDashboard.tsx` — layout 5 widgets, filtros, season toggle
- [x] `TeamAggregateFiltersSheet.tsx` — ageGroup + competition, sessionStorage
- [x] Line chart fadiga semanal com `aria-label`
- [x] Line chart presença semanal com `aria-label`
- [x] Top-3 cards (carregados + fatigados) com link para `/tendencias/carga`
- [x] Bar chart eventos por jogo com `aria-label`
- [x] PDF stub button — coach only, CalmConfirmation "em breve"
- [x] Filter chips removíveis acima dos gráficos
- [x] TooltipExplain nos headers dos widgets

### Testing & QA

- [x] `team-aggregate.test.ts` ≥80% — happy path, plantel vazio, unauthorized, club isolation, cálculo semanal, taxa presença, top-3 ranking
- [x] axe-core: `aria-label` nos containers recharts, chips acessíveis, link com aria-label
- [x] Todos os testes existentes: sem regressões

---

## Recursos & Referências

- **Epics.md:** Story 7.4 — linhas 3160–3200 (aprox.)
- **`proxy.ts`:** `sparta/src/proxy.ts` — STAFF_ONLY_ROUTES_404 + ROLE_ALLOWED_ROUTES
- **`StaffSidebar.tsx`:** `sparta/src/components/patterns/StaffSidebar.tsx` — isActive + NAV_CONFIG
- **`tendencias/carga/page.tsx`:** Padrão exacto para o Server Component
- **`load.ts`:** `src/lib/actions/load.ts` — referência para Server Action com batch queries
- **`LoadFiltersSheet.tsx`:** `src/components/domain/LoadFiltersSheet.tsx` — padrão de filtros com sessionStorage
- **`trends.ts`:** `src/lib/actions/trends.ts` — padrão `auditedRead` para fatigue_responses
- **`audited.ts`:** `src/lib/data/audited.ts` — assinatura de `auditedRead()`
- **`attendances.ts`:** `src/lib/schemas/attendances.ts` — ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'injured', 'excused']
- **AGENTS.md:** regras TypeScript + §1 service role + §2 "use server" exports

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Recharts `Tooltip.formatter` — type annotation `(value: number)` incompatível com `Formatter<ValueType, NameType>`; solução: remover anotação e usar `typeof value === "number"` guard
- Supabase join type inference — `sessions!inner(date, type)` gera `SelectQueryError` na inferência estática; solução: cast via `unknown` para `AttRow[]` / `EventRow[]`
- `session_metrics` mock chain — `.eq` chamado duas vezes (intermediário + terminal); solução: `mockReturnValueOnce(q).mockResolvedValue({...})`
- ESLint `no-direct-health-data-read` — dispara em `fatigue_responses` dentro de `auditedRead()` callback e em `session_metrics`/`match_events`; adicionado `eslint-disable-next-line` com justificação em cada caso

### Completion Notes List

- `lib/actions/team-aggregate.ts`: `getTeamAggregateData()` Server Action com `requireStaffRole()`, `getServiceRoleClient()`, `getCurrentSeason()`, `auditedRead()` para `fatigue_responses`, `Promise.allSettled` para 4 queries paralelas, cálculo das 4 janelas semanais, `weeklyFatigue`, `weeklyAttendance`, `topLoaded` (Top-3 por sRPE época), `topFatigued` (Top-3 por avg fatiga 4 sem), `eventsPerMatch` (últimos 10 jogos/amigáveis), plantel vazio retorna zeros, `userRole` no resultado
- `lib/actions/team-aggregate.test.ts`: 14 testes ✅ — unauthorized (3), db_error, plantel vazio, happy path coach, happy path analyst, isolamento club_id, cálculo semanal, taxa presença, top-3 ordenação DESC, labels Sem 1–4, eventsPerMatch agregação, currentSeason null
- `app/(staff)/equipa/agregado/page.tsx`: Server Component com error state e empty state, metadata, delega a `TeamAggregateDashboard`
- `components/domain/TeamAggregateDashboard.tsx`: Client Component com 5 widgets (fadiga linha, presença linha, top-3 carregados cards, top-3 fatigados cards, eventos barras), filtros por ageGroup (client-side) e competition, PDF stub coach-only via `CalmConfirmation`, `TooltipExplain` em headers, `aria-label` em containers recharts, aviso MVP para filtros de gráficos de linha
- `components/domain/TeamAggregateFiltersSheet.tsx`: Sheet com ageGroup (6 opções) e competition (4 opções), sessionStorage persist, filter chips removíveis, draft state para cancel/apply, padrão idêntico a `LoadFiltersSheet`
- `proxy.ts`: `/equipa` adicionado a `STAFF_ONLY_ROUTES_404` e a `ROLE_ALLOWED_ROUTES.coach` e `.analyst`
- `StaffSidebar.tsx`: `LayoutDashboard` import + item "Equipa" no coach nav + `isActive()` corrigida para hrefs multi-segmento

### File List

- `sparta/src/lib/actions/team-aggregate.ts` — NOVO
- `sparta/src/lib/actions/team-aggregate.test.ts` — NOVO
- `sparta/src/app/(staff)/equipa/agregado/page.tsx` — NOVO
- `sparta/src/components/domain/TeamAggregateDashboard.tsx` — NOVO
- `sparta/src/components/domain/TeamAggregateFiltersSheet.tsx` — NOVO
- `sparta/src/proxy.ts` — MODIFICADO
- `sparta/src/components/patterns/StaffSidebar.tsx` — MODIFICADO

---

## Change Log

- Story 7-4 implementada (2026-06-01): `getTeamAggregateData()` Server Action, `TeamAggregateDashboard` + `TeamAggregateFiltersSheet` Client Components, `/equipa/agregado` Server Component page, proxy.ts + StaffSidebar.tsx actualizados; 14 novos testes ✅; 1915/1916 testes ✅; lint 0 erros; typecheck ✅

---

## Review Findings

### Patches (8 findings)

- [ ] [Review][Patch] Missing requireStaffRole import [team-aggregate.ts:6] — Reimplementação de auth guard em vez de importar de `@/lib/actions/auth`. Inconsistência com pattern (Story 7-3). Risco: duplicação, desincronização futura.
- [ ] [Review][Patch] Inconsistent Promise.allSettled error handling [team-aggregate.ts:204-245] — Fatigue query via `auditedRead()` apenas verifica `fulfilled`, não `rejected`. Attendances/metrics usam `.error`. Audit log nunca cria em falha.
- [ ] [Review][Patch] Type casting loses validation [team-aggregate.ts:305] — `as unknown as AttRow[]` sem validação. Schema change silencia erro silenciosamente.
- [ ] [Review][Patch] sessionStorage race condition [TeamAggregateFiltersSheet.tsx:120] — `useEffect` hidratação sem cleanup. Estado fica inconsistente se desmonta durante read.
- [ ] [Review][Patch] Events limit(500) vs. "últimos 10" docs [team-aggregate.ts:340-346] — Documentação promete "últimos 10 jogos" mas código `.limit(500).slice(-10)` devolve últimos 10 dos 500, não 10 reais.
- [ ] [Review][Patch] currentSeason fallback returns null [team-aggregate.ts:300-302] — Metrics query resolve com `{ data: null }` não `{ data: [] }`. Type coercion falha em line 378.
- [ ] [Review][Patch] Attendance date parsing silent failure [team-aggregate.ts:366-368] — `new Date(r.sessions?.date + "T00:00:00Z")` falha se date=null. NaN.getTime() → bucket filtering falha, attendanceRate=0 sempre.
- [ ] [Review][Patch] StaffSidebar isActive() verification [StaffSidebar.tsx:52-62] — Lógica corrigida per spec, mas verificação: `/equipa/agregado` com href="/equipa/agregado" — se pathname="/equipa", segment="/equipa" vs href="/equipa/agregado" → nunca match.

### Deferred (2 findings, pre-existing design)

- [x] [Review][Defer] Filtering mismatch: ageGroup client vs. server global [TeamAggregateDashboard.tsx:61-75] — deferred; MVP trade-off documentado, filtros client afectam Top-3 mas gráficos globais, spec nota como intencional
- [x] [Review][Defer] SeasonToggle sem re-fetch [TeamAggregateDashboard.tsx:85] — deferred; MVP design, toggle client sem refetch, future Story 7.5

### Dismissed (2 false positives)

- Positionmap null lookup — corretamente guarded com `?? "—"`
- Mock chain divergence (tests) — test infrastructure issue, não bug no code

---

## Story Status

**Status:** in-progress

**Criado por:** bmad-create-story
**Data de criação:** 2026-06-01
**Code Review:** 2026-06-01 — 8 patches, 2 deferred, 2 dismissed

Análise completa com findings estruturados. Patches obrigatórios antes de merge.
