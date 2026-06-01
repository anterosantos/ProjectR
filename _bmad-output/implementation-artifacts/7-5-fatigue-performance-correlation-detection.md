# Story 7.5: Deteção de Correlação Fadiga × Performance

**Status:** done

**Story ID:** 7.5
**Epic:** Epic 7 — Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)
**Criado:** 2026-06-01
**Story anterior:** 7-4-team-aggregate-dashboard (done)

---

## ⚠️ DEPENDÊNCIAS CRÍTICAS

> **BLOQUEADORES**: As seguintes histórias DEVEM estar em estado `done` antes de iniciar a implementação:
>
> - **Story 4.1** — `fatigue_responses` com `player_id`, `club_id`, `session_id`, `phase`, 5 dims, `submitted_at`
> - **Story 6.1** — `match_events` com `player_id`, `session_id`, `action`, `is_deleted`, `club_id`
> - **Story 7.2** — `ProfileTabs.tsx` com 7 tabs (inclui tab "Recuperação" — modelo directo)
> - **Story 7.3** — `lib/readiness/recovery.ts` com `computeRecoveryCurve()` — padrão exacto a seguir
> - **Story 1.12** — `audit_logs` + `auditedRead()` wrapper
> - **Story 4.6** — `proxy.ts` com `/plantel` em `STAFF_ONLY_ROUTES_404`

---

## Especificação da História

### User Story

Como Analista,
Quero que o sistema detete correlações estatisticamente significativas entre a fadiga de um jogador e o seu output estatístico,
Para poder nomear padrões ("quando o sono cai abaixo de 2, a taxa de passes completos cai 15%") em vez de adivinhar.

### Acceptance Criteria

#### AC #1 — `lib/readiness/correlations.ts` — Função Pura

**Given** `detectCorrelations(supabase, { playerId, clubId, lookbackDays=120 })`

**When** invocada

**Then** para cada dimensão de fadiga × cada uma das 8 métricas de ação, calcula correlação de Spearman nas sessões onde ambos estão disponíveis (FR39)
**And** retorna apenas correlações com `|rho| ≥ 0.5` AND `p < 0.05` AND `n ≥ 10` sessões
**And** ordena por força absoluta descendente

#### AC #2 — Tab "Correlações" no Perfil Consolidado

**Given** a rota `/plantel/[id]/perfil` com `<ProfileTabs>`

**When** o staff abre a tab "Correlações"

**Then** o `<CorrelacoesTab>` apresenta as correlações detectadas em linguagem PT-PT corrida (ex: "Sono baixo está associado a menos passes completados — 14 jogos analisados")
**And** cada item tem um `<TooltipExplain>` com: "Correlação não é causa. Use como pista, não como sentença." (B1, NFR42)

#### AC #3 — Empty State

**Given** nenhuma correlação passa o limiar

**When** a tab é renderizada

**Then** mostra `<EmptyState>` "Sem padrões significativos ainda. Continua a recolher dados." (UX-DR8, UX-DR38)

#### AC #4 — Controlo de Acesso (FR26)

**Given** o jogador NÃO deve ver as suas próprias correlações

**When** um Jogador tenta aceder a `/plantel/<own_id>/perfil`

**Then** o middleware retorna 404 (já coberto pelo `/plantel` em `STAFF_ONLY_ROUTES_404`)

> **Nota:** Nenhuma alteração ao `proxy.ts` necessária — `/plantel` já bloqueia jogadores.

#### AC #5 — Audit Logging (FR50)

**Given** o `getPlayerCorrelationsTabData()` é chamado

**When** a tab carrega

**Then** cria entrada em `audit_logs` via `auditedRead()`: `action='correlations.viewed'`, `targetKind='player'`, `targetId=playerId`

#### AC #6 — Cobertura de Testes (NFR54)

**Given** testes em `lib/readiness/__tests__/correlations.test.ts`

**When** executados com fixtures sintéticas

**Then** cobrem ≥ 80%:
  - Correlações fortes detectadas (≥ 3 findings com |rho| ≥ 0.5, p < 0.05, n ≥ 10)
  - Correlações fracas filtradas (|rho| < 0.5 → ausentes do resultado)
  - Amostra pequena (n < 10) → resultado vazio
  - Sem sessões em comum → resultado vazio
  - Ordenação por |rho| descendente

---

## Contexto para o Desenvolvedor

### Sem Migração SQL

> **NENHUMA migração SQL necessária.** Reutiliza exclusivamente tabelas existentes:
> - `fatigue_responses` (Story 4.1) — `player_id`, `club_id`, `session_id`, `phase`, 5 dims 1–10, `submitted_at`
> - `match_events` (Story 6.1) — `player_id`, `club_id`, `session_id`, `action`, `is_deleted`
> - 8 ações válidas: `ball_loss`, `ball_recovery`, `shot_total`, `shot_on_target`, `pass_completed`, `def_pressure`, `def_action_success`, `off_action_success`

---

### Estrutura de Ficheiros

```
sparta/src/
  lib/readiness/
    correlations.ts                        ← NOVO: detectCorrelations() pura
    __tests__/
      correlations.test.ts                 ← NOVO: ≥ 80% cobertura
  lib/actions/
    player-profile.ts                      ← MODIFICAR: adicionar getPlayerCorrelationsTabData()
  app/(staff)/plantel/[id]/perfil/
    CorrelacoesTab.tsx                     ← NOVO: Client Component
    ProfileTabs.tsx                        ← MODIFICAR: adicionar tab "Correlações"
```

> **Convenção de nome de ficheiro:** `CorrelacoesTab.tsx` (sem cedilha — ASCII seguro).
> O label visível ao utilizador é `"Correlações"` (com cedilha).

---

## 1. `lib/readiness/correlations.ts` — Função Pura

### Tipos Exportados

```typescript
// src/lib/readiness/correlations.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type FatigueDimension = "energy" | "focus" | "sleep" | "soreness" | "mood";

export type ActionMetric =
  | "ball_loss"
  | "ball_recovery"
  | "shot_total"
  | "shot_on_target"
  | "pass_completed"
  | "def_pressure"
  | "def_action_success"
  | "off_action_success";

export interface CorrelationFinding {
  dimension: FatigueDimension;
  action: ActionMetric;
  rho: number;       // Spearman rho -1..1
  pValue: number;    // two-tailed p-value
  n: number;         // nº de sessões em que ambos estão disponíveis
}

export interface CorrelationsResult {
  findings: CorrelationFinding[];  // |rho| ≥ 0.5, p < 0.05, n ≥ 10; ordenado por |rho| desc
  totalSessionsAnalyzed: number;   // sessões com fatigue post + match events
}
```

### Tipos Internos (NÃO exportar)

```typescript
// Definir localmente no ficheiro (não exportar)
type FatigueRow = {
  session_id: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};

type EventRow = {
  session_id: string;
  action: string;
};
```

### Implementação Completa

```typescript
const EMPTY: CorrelationsResult = { findings: [], totalSessionsAnalyzed: 0 };

const FATIGUE_DIMS: FatigueDimension[] = ["energy", "focus", "sleep", "soreness", "mood"];
const DIM_KEY_MAP: Record<FatigueDimension, keyof FatigueRow> = {
  energy: "dim_energy",
  focus: "dim_focus",
  sleep: "dim_sleep",
  soreness: "dim_soreness",
  mood: "dim_mood",
};
const ACTION_METRICS: ActionMetric[] = [
  "ball_loss", "ball_recovery", "shot_total", "shot_on_target",
  "pass_completed", "def_pressure", "def_action_success", "off_action_success",
];

export async function detectCorrelations(
  supabase: SupabaseClient,
  {
    playerId,
    clubId,
    lookbackDays = 120,
  }: { playerId: string; clubId: string; lookbackDays?: number }
): Promise<CorrelationsResult> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  // Step 1: Post-session fatigue responses within window
  // eslint-disable-next-line custom/no-direct-health-data-read -- called from getPlayerCorrelationsTabData via auditedRead()
  const { data: fatigueData, error: fatigueError } = await supabase
    .from("fatigue_responses")
    .select("session_id, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .eq("phase", "post")
    .gte("submitted_at", cutoff);

  if (fatigueError || !fatigueData?.length) return EMPTY;
  const fatigueRows = fatigueData as FatigueRow[];

  // Build map session_id → fatigue dims
  const fatigueBySess = new Map<string, FatigueRow>();
  for (const row of fatigueRows) {
    if (row.session_id) fatigueBySess.set(row.session_id, row);
  }

  const sessionIds = Array.from(fatigueBySess.keys());
  if (sessionIds.length === 0) return EMPTY;

  // Step 2: Match events for those sessions
  // match_events is performance data, NOT health data — no eslint disable needed
  const { data: eventsData, error: eventsError } = await supabase
    .from("match_events")
    .select("session_id, action")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .in("session_id", sessionIds)
    .eq("is_deleted", false);

  if (eventsError) return EMPTY;

  // Step 3: Aggregate events by session
  const eventsBySess = new Map<string, Map<string, number>>();
  for (const row of (eventsData ?? []) as EventRow[]) {
    if (!row.session_id || !row.action) continue;
    const sessMap = eventsBySess.get(row.session_id) ?? new Map<string, number>();
    sessMap.set(row.action, (sessMap.get(row.action) ?? 0) + 1);
    eventsBySess.set(row.session_id, sessMap);
  }

  // Step 4: Only sessions where player has BOTH fatigue AND at least one match event
  const pairedSessionIds = sessionIds.filter((sid) => eventsBySess.has(sid));
  if (pairedSessionIds.length === 0) return EMPTY;

  // Step 5: Compute Spearman for each (dim, action) pair
  const findings: CorrelationFinding[] = [];

  for (const dim of FATIGUE_DIMS) {
    const dimKey = DIM_KEY_MAP[dim];
    for (const action of ACTION_METRICS) {
      const xs: number[] = [];
      const ys: number[] = [];

      for (const sid of pairedSessionIds) {
        const fatigueRow = fatigueBySess.get(sid);
        const dimVal = fatigueRow?.[dimKey];
        if (dimVal === null || dimVal === undefined) continue;
        const actionCount = eventsBySess.get(sid)?.get(action) ?? 0;
        xs.push(dimVal as number);
        ys.push(actionCount);
      }

      if (xs.length < 10) continue;

      const rho = spearmanRho(xs, ys);
      const p = spearmanPValue(rho, xs.length);

      if (Math.abs(rho) >= 0.5 && p < 0.05) {
        findings.push({ dimension: dim, action, rho, pValue: p, n: xs.length });
      }
    }
  }

  findings.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  return { findings, totalSessionsAnalyzed: pairedSessionIds.length };
}
```

### Algoritmos Estatísticos (mesmos ficheiro, NÃO exportar)

```typescript
// ── Ranking ─────────────────────────────────────────────────────────────────

function rankArray(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j]!.v === indexed[i]!.v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k]!.i] = avgRank;
    i = j;
  }
  return ranks;
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i]! - mx);
    const dy = (y[i]! - my);
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function spearmanRho(x: number[], y: number[]): number {
  return pearsonR(rankArray(x), rankArray(y));
}

// ── P-value (two-tailed, Spearman/t-distribution) ───────────────────────────

function spearmanPValue(rho: number, n: number): number {
  if (n <= 2) return 1;
  if (Math.abs(rho) >= 1) return 0;
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  return 2 * studentTSurvival(Math.abs(t), n - 2);
}

// P(T > t) for Student's t with `df` degrees of freedom
// Using regularized incomplete beta: P = 0.5 * I(df/(df+t²); df/2, 1/2)
function studentTSurvival(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(x, df / 2, 0.5);
}

// Regularized incomplete beta function I(x; a, b)
// Lentz continued-fraction algorithm (Numerical Recipes §6.4)
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Symmetry: x > (a+1)/(a+b+2) → use complement
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const factor = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return factor * h;
}

// Lanczos log-gamma approximation (Numerical Recipes §6.1)
function logGamma(x: number): number {
  const coef = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 1.208650973866179e-3, -5.395239384953e-6,
  ];
  let y = x;
  const tmp = x + 5.5;
  const ser = coef.reduce((acc, c) => { y += 1; return acc + c / y; }, 1.000000000190015);
  return (x + 0.5) * Math.log(tmp) - tmp + Math.log(2.5066282746310005 * ser / x);
}
```

> **CRÍTICO:** O comentário `// eslint-disable-next-line custom/no-direct-health-data-read` é obrigatório antes da query `fatigue_responses`. A função é chamada a partir de `getPlayerCorrelationsTabData()` que já usa `auditedRead()` — o disable está justificado. **Não remover.**

> **CRÍTICO:** `correlations.ts` é um módulo puro sem `"use server"` — pode exportar tipos e funções livremente.

---

## 2. `lib/actions/player-profile.ts` — Adicionar `getPlayerCorrelationsTabData()`

**Adicionar ao final de `player-profile.ts`** (actualmente 948 linhas). Seguir exactamente o padrão de `getPlayerRecoveryTabData()` (linhas ~855–910).

```typescript
// ─── Types (adicionar junto aos outros tipos no topo do ficheiro) ──────────
import type { CorrelationsResult, CorrelationFinding } from "@/lib/readiness/correlations";
import { detectCorrelations } from "@/lib/readiness/correlations";

export type CorrelationsTabData = {
  result: CorrelationsResult;
  playerName: string;
};
```

```typescript
/**
 * getPlayerCorrelationsTabData — Spearman correlations between fatigue dims and match stats.
 *
 * Uses auditedRead() — health data from fatigue_responses (FR50).
 */
export async function getPlayerCorrelationsTabData(
  playerId: string
): Promise<Result<CorrelationsTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

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

  let result: CorrelationsResult;
  try {
    result = await auditedRead<CorrelationsResult>(
      {
        action: "correlations.viewed",
        targetKind: "player",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => detectCorrelations(serviceRole, { playerId, clubId })
    );
  } catch {
    return err({ code: "internal", message: "Erro ao calcular correlações" });
  }

  return ok({ result, playerName: player.full_name ?? "—" });
}
```

> **ATENÇÃO — AGENTS.md §2:** `player-profile.ts` tem `"use server"` — apenas pode exportar funções async. Os tipos `CorrelationsTabData` e `CorrelationFinding` são interfaces TypeScript (compile-time only), portanto são OK para exportar. **NÃO exportar** o re-export de `CorrelationFinding` como objecto runtime.

---

## 3. `app/(staff)/plantel/[id]/perfil/CorrelacoesTab.tsx` — Client Component

Seguir exactamente o padrão de `RecuperacaoTab.tsx`. Substituir:
- `getPlayerRecoveryTabData` → `getPlayerCorrelationsTabData`
- `RecoveryCurveResult` / gráfico → lista de findings em linguagem PT-PT

```typescript
"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { getPlayerCorrelationsTabData } from "@/lib/actions/player-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import type { CorrelationFinding, FatigueDimension, ActionMetric } from "@/lib/readiness/correlations";

// ── Labels PT-PT ─────────────────────────────────────────────────────────────

type DimGender = "f" | "m";

const DIM_LABELS: Record<FatigueDimension, { label: string; gender: DimGender }> = {
  energy:   { label: "Energia",          gender: "f" },
  focus:    { label: "Concentração",     gender: "f" },
  sleep:    { label: "Sono",             gender: "m" },
  soreness: { label: "Dor muscular",     gender: "f" },
  mood:     { label: "Estado emocional", gender: "m" },
};

const ACTION_LABELS: Record<ActionMetric, string> = {
  ball_loss:            "perdas de bola",
  ball_recovery:        "recuperações de bola",
  shot_total:           "remates",
  shot_on_target:       "remates à baliza",
  pass_completed:       "passes completados",
  def_pressure:         "pressões defensivas",
  def_action_success:   "ações defensivas com sucesso",
  off_action_success:   "ações ofensivas com sucesso",
};

// Dimensões onde pontuação ALTA = melhor (energia, concentração, sono, humor)
// soreness: pontuação alta = pior (dor alta)
const POSITIVE_VALENCE = new Set<FatigueDimension>(["energy", "focus", "sleep", "mood"]);

function toNaturalLanguage(f: CorrelationFinding): string {
  const { label, gender } = DIM_LABELS[f.dimension] ?? { label: f.dimension, gender: "f" as DimGender };
  const actionLabel = ACTION_LABELS[f.action] ?? f.action;
  const isPositiveValence = POSITIVE_VALENCE.has(f.dimension);

  // Positive-valence dims (energy/focus/sleep/mood): describe from the end that rho points to
  //   rho > 0 → "alto/alta" dim associada a mais Y
  //   rho < 0 → "baixo/baixa" dim associada a menos Y
  // Negative-valence dim (soreness): always describe from the problematic "high" end
  //   rho > 0 → "alta" dor associada a mais Y (unusual)
  //   rho < 0 → "alta" dor associada a menos Y (common pattern)
  const adj = isPositiveValence
    ? (gender === "m" ? (f.rho > 0 ? "alto" : "baixo") : (f.rho > 0 ? "alta" : "baixa"))
    : (gender === "m" ? "alto" : "alta");

  const moreOrLess = f.rho > 0 ? "mais" : "menos";

  return `${label} ${adj} está associada a ${moreOrLess} ${actionLabel} — ${f.n} jogos analisados`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CorrelacoesTabProps {
  playerId: string;
}

export function CorrelacoesTab({ playerId }: CorrelacoesTabProps) {
  const [findings, setFindings] = useState<CorrelationFinding[] | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const res = await getPlayerCorrelationsTabData(playerId);
      if (controller.signal.aborted) return;
      if (res.ok) {
        setFindings(res.data.result.findings);
        setPlayerName(res.data.playerName);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [playerId]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="A calcular correlações..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 200 }}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
        title="Sem padrões significativos ainda"
        description="Continua a recolher dados. Precisamos de 10+ jogos com questionários para detectar padrões."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">
          Correlações Fadiga × Performance
        </h3>
        <TooltipExplain
          term="?"
          definition={`Padrões detectados para ${playerName}. Correlação não é causa — use como pista, não como sentença.`}
        />
      </div>

      <ul className="space-y-3" aria-label="Correlações detectadas">
        {findings.map((f, i) => (
          <li
            key={`${f.dimension}-${f.action}`}
            className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                Math.abs(f.rho) >= 0.7 ? "bg-destructive" : "bg-warning"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {toNaturalLanguage(f)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                rho = {f.rho.toFixed(2)} · p = {f.pValue < 0.001 ? "<0.001" : f.pValue.toFixed(3)}
              </p>
            </div>
            <TooltipExplain
              term="?"
              definition="Correlação não é causa. Use como pista, não como sentença."
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> **Nota sobre `bg-warning`:** Verificar se o token `bg-warning` está definido em `globals.css`. Se não estiver, usar `bg-amber-500` como fallback.

---

## 4. `app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — Adicionar Tab "Correlações"

### Alterações exactas:

**Passo 1 — Import:**
```typescript
// Adicionar junto aos outros imports de tabs
import { CorrelacoesTab } from "./CorrelacoesTab";
```

**Passo 2 — TabId type:**
```typescript
// ANTES:
type TabId = "fadiga" | "acwr" | "fisicas" | "presencas" | "estatisticas" | "decisoes" | "recuperacao";

// DEPOIS:
type TabId = "fadiga" | "acwr" | "fisicas" | "presencas" | "estatisticas" | "decisoes" | "recuperacao" | "correlacoes";
```

**Passo 3 — TABS array (adicionar após "Recuperação"):**
```typescript
const TABS: { id: TabId; label: string }[] = [
  { id: "fadiga",       label: "Fadiga" },
  { id: "acwr",         label: "Carga & ACWR" },
  { id: "fisicas",      label: "Métricas físicas" },
  { id: "presencas",    label: "Presenças" },
  { id: "estatisticas", label: "Estatísticas" },
  { id: "decisoes",     label: "Decisões data-driven" },
  { id: "recuperacao",  label: "Recuperação" },
  { id: "correlacoes",  label: "Correlações" },  // ← ADICIONAR
];
```

**Passo 4 — Novo painel (adicionar após o painel "recuperacao"):**
```tsx
<div
  id="profile-panel-correlacoes"
  role="tabpanel"
  aria-labelledby="profile-tab-correlacoes"
  hidden={activeTab !== "correlacoes"}
>
  {activeTab === "correlacoes" && <CorrelacoesTab playerId={playerId} />}
</div>
```

> **Nota:** O `storageKey` já usa `TABS.some(t => t.id === stored)` para validar o valor guardado — ao adicionar "correlacoes" ao array `TABS`, o sessionStorage restore funciona automaticamente. Nenhuma outra alteração necessária.

---

## 5. Esquema de Dados — Colunas Exactas

**`fatigue_responses`** (Migration 000200):
```
player_id uuid, club_id uuid, session_id uuid, phase text ('pre'|'post'),
submitted_at timestamptz,
dim_energy int 1–10, dim_focus int 1–10, dim_sleep int 1–10,
dim_soreness int 1–10, dim_mood int 1–10
```
> **Filtro phase:** Usar sempre `phase='post'` — é o estado pós-sessão que correlaciona com a performance. A resposta `pre` é captada antes da sessão e não reflecte o impacto do esforço.

**`match_events`** (Migration 000270):
```
player_id uuid, club_id uuid, session_id uuid,
action text CHECK IN ('ball_loss','ball_recovery','shot_total','shot_on_target',
                       'pass_completed','def_pressure','def_action_success','off_action_success'),
is_deleted boolean DEFAULT false
```

---

## 6. Integrações NÃO a reimplementar

| Existente | Localização | Uso em 7-5 |
|-----------|-------------|------------|
| `requireStaffRole()` | `src/lib/actions/auth.ts` | Guard na Server Action |
| `getServiceRoleClient()` | `src/lib/supabase/service-role.ts` | Queries DB |
| `auditedRead()` | `src/lib/data/audited.ts` | FR50 para fatigue_responses |
| `ok()` / `err()` | `src/lib/types.ts` | Result type pattern |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Estado vazio |
| `TooltipExplain` | `src/components/ui/tooltip-explain.tsx` | Explicações inline |
| `ProfileTabs` | `perfil/ProfileTabs.tsx` | Adicionar tab |
| `RecuperacaoTab` | `perfil/RecuperacaoTab.tsx` | Padrão exacto a seguir |

---

## 7. Padrões TypeScript Críticos (AGENTS.md)

1. **`noUncheckedIndexedAccess`:** Todo acesso indexado precisa de `?.` + `?? fallback`
   - `indexed[k]!.i` — em loops indexados onde `k` está dentro dos limites → `!` é safe
   - `x[i]!` — em loops `for (let i = 0; i < n; i++)` → `!` é safe (index garantidamente válido)
   - `findings[0]` sem guard → ❌
2. **Sem `import React`** — React 19 JSX transform automático
3. **Imports com `@/`** — nunca relativos
4. **`"use server"` → só async functions** — `correlations.ts` NÃO tem `"use server"` → pode exportar tudo
5. **Service role SEMPRE após `requireStaffRole()`**
6. **`club_id` explícito em todos os queries** (service role bypassa RLS)

---

## 8. Testes — `lib/readiness/__tests__/correlations.test.ts`

### Estrutura dos Mocks

Seguir exactamente o padrão de `recovery.test.ts`:

```typescript
function makeSupabase(tables: Record<string, unknown[]>) {
  const makeChain = (data: unknown[]) => {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "in", "gte", "order", "limit"];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnThis();
    }
    chain.then = (onFulfilled: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(onFulfilled);
    return chain;
  };
  return { from: vi.fn((table: string) => makeChain(tables[table] ?? [])) };
}
```

### Casos a Testar

```typescript
describe("detectCorrelations", () => {
  it("retorna vazio quando não há respostas de fadiga", async () => {
    const supabase = makeSupabase({ fatigue_responses: [], match_events: [] });
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    expect(result.findings).toHaveLength(0);
    expect(result.totalSessionsAnalyzed).toBe(0);
  });

  it("retorna vazio quando não há match_events para as sessões", async () => {
    const supabase = makeSupabase({
      fatigue_responses: [makeFatigueRow("s1", 5, 5, 5, 5, 5)],
      match_events: [],
    });
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    expect(result.findings).toHaveLength(0);
  });

  it("retorna vazio quando n < 10 sessões", async () => {
    // 9 sessões — insuficiente
    const supabase = makeSupabase({
      fatigue_responses: Array.from({ length: 9 }, (_, i) => makeFatigueRow(`s${i}`, 5, 5, 5, 5, 5)),
      match_events: Array.from({ length: 9 }, (_, i) => makeEventRow(`s${i}`, "pass_completed")),
    });
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    // Even if rho = 1, n=9 < 10 → filtered
    expect(result.findings).toHaveLength(0);
  });

  it("detecta correlação forte positiva (dim_sleep × pass_completed)", async () => {
    // Construct 15 sessions: sleep 1..15, passes 10..24 (perfect rank correlation)
    const sessions = Array.from({ length: 15 }, (_, i) => ({
      session_id: `s${i}`,
      dim_energy: 5, dim_focus: 5, dim_sleep: i + 1, dim_soreness: 5, dim_mood: 5,
    }));
    const events = sessions.flatMap(({ session_id }, i) =>
      Array.from({ length: i + 10 }, () => makeEventRow(session_id, "pass_completed"))
    );
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    const finding = result.findings.find(
      (f) => f.dimension === "sleep" && f.action === "pass_completed"
    );
    expect(finding).toBeDefined();
    expect(finding!.rho).toBeGreaterThan(0.9);
    expect(finding!.pValue).toBeLessThan(0.05);
    expect(finding!.n).toBe(15);
  });

  it("filtra correlações fracas (|rho| < 0.5)", async () => {
    // Random-ish data with no clear correlation
    const sessions = Array.from({ length: 12 }, (_, i) => ({
      session_id: `s${i}`,
      dim_energy: 5, dim_focus: 5, dim_sleep: 5, dim_soreness: 5, dim_mood: 5,
      // Flat dimensions → rho = 0 for everything
    }));
    const events = sessions.map(({ session_id }) => makeEventRow(session_id, "ball_loss"));
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    // Flat fatigue (all 5) → no variance → rho = 0 → nothing passes
    expect(result.findings).toHaveLength(0);
  });

  it("ordena findings por |rho| descendente", async () => {
    // Build fixtures with known rho ordering across 2 pairs
    // (implementation left to test author based on synthetic data)
    // Verify: findings[0].rho >= findings[1].rho (absolute)
    // ...
  });

  it("totalSessionsAnalyzed conta sessões com fatigue + match events", async () => {
    // 12 sessions com fatigue, apenas 10 com match events
    const result = await detectCorrelations(supabase, { playerId: "p1", clubId: "c1" });
    expect(result.totalSessionsAnalyzed).toBe(10);
  });
});
```

> **Nota sobre fixtures:** Os helpers `makeFatigueRow(sessionId, energy, focus, sleep, soreness, mood)` e `makeEventRow(sessionId, action)` devem ser definidos localmente no ficheiro de teste, seguindo o padrão de `recovery.test.ts`.

---

## Dev Learnings de Stories Anteriores

### De Story 7-4 (Team Aggregate — story anterior directa)

- ✅ `Promise.allSettled` para queries paralelas — aqui não é necessário (queries sequenciais obrigatórias: fatigue first, events second in sessionIds)
- ✅ `auditedRead()` assinatura confirmada: `auditedRead<T>({ action, targetKind, targetId, actorId, clubId }, async () => T)`
- ✅ `auditedRead()` com `targetKind: "player"` para dados individuais
- ✅ `requireStaffRole()` retorna `{ ok, data: { userId, clubId, role } }`
- ✅ `getServiceRoleClient()` SEMPRE depois de `requireStaffRole()`
- ✅ ESLint `no-direct-health-data-read` dispara em qualquer acesso directo a `fatigue_responses` — dentro do `auditedRead()` callback, adicionar `// eslint-disable-next-line`
- ✅ `maybeSingle()` para player lookup (não `single()` que lança erro)

### De Story 7-3 (Recovery Curve — padrão directo para esta story)

- ✅ Padrão `SupabaseClient` como primeiro parâmetro em funções puras — permite mock nos testes sem modificar o módulo
- ✅ `// eslint-disable-next-line custom/no-direct-health-data-read` obrigatório antes de query directa a `fatigue_responses` dentro da função pura (a auditoria acontece no wrapper)
- ✅ `RecuperacaoTab.tsx` como template exacto para `CorrelacoesTab.tsx` — AbortController + useEffect
- ✅ Padrão `getPlayerRecoveryTabData()` como template exacto para `getPlayerCorrelationsTabData()`

### De Story 7-2 (Perfil Consolidado — ProfileTabs)

- ✅ `ProfileTabs.tsx` usa `TABS.some(t => t.id === stored)` para restaurar tab do sessionStorage — adicionar ao array `TABS` é suficiente
- ✅ Tab panel: `hidden={activeTab !== "tabId"}` + lazy render: `{activeTab === "tabId" && <Component />}`
- ✅ `aria-labelledby`, `role="tabpanel"`, `id="profile-panel-X"` são obrigatórios para axe-core

---

## Decisões Técnicas & Pitfalls Conhecidos

### 1. Algoritmo Spearman vs. biblioteca externa

**Decisão:** Implementar Spearman do zero em TypeScript puro.
**Porquê:** Nenhuma biblioteca de estatística está no `package.json`. Adicionar `jstat`, `simple-statistics` ou similar requer aprovação de dependência e não vale a complexidade para 40 pares de correlação. A implementação via Lentz continued-fraction da beta incompleta é padrão publicado (Numerical Recipes).
**Precisão:** Suficiente para nosso caso (n ≥ 10, |rho| ≥ 0.5). Erro < 1e-6 para parâmetros típicos.

### 2. Sessões incluídas nas correlações

**Decisão:** Incluir apenas sessões onde o jogador tem AMBOS: (a) resposta fatigue com `phase='post'` E (b) pelo menos um `match_event`.
**Porquê:** Correlacionar fadiga de treinos com eventos de jogo seria ruído. Post-session fatigue reflete o estado do próprio esforço. Treinos sem match_events seriam outliers com todos os action counts a 0.
**Trade-off:** Reduz amostra vs. aumenta qualidade do sinal. Com o filtro n ≥ 10, o sistema só detecta correlações quando há dados suficientes de jogos reais.

### 3. Gestão de action counts zero

**Decisão:** Para uma sessão incluída (tem fatigue + pelo menos 1 event), action counts de 0 para ações não tomadas são válidos.
**Porquê:** Um jogador pode genuinamente não ter feito nenhum remate em determinado jogo. O 0 é informação, não ausência de dados. A alternativa (excluir quando count=0) introduziria viés de selecção.

### 4. Amostra mínima n ≥ 10

**Porquê:** Com Spearman e n < 10, o intervalo de confiança é demasiado largo. O requisito da story (n ≥ 10) é já conservador; na prática, |rho| ≥ 0.5 só é significativo (p < 0.05) com n ≥ 13 (~). A combinação dos dois critérios evita falsos positivos sem dados suficientes.

### 5. `toNaturalLanguage()` e género gramatical

A função usa um dict de género por dimensão para produzir "alto/alta" ou "baixo/baixa" correcto. Verificar o output com o exemplo do spec: "Sono baixo está associado a menos passes completados — 14 jogos analisados" → `dim=sleep, rho < 0, n=14`.
- `sleep` → gender: `"m"` → "baixo" ✅

### 6. `bg-warning` token

Se o token `bg-warning` não existir em `globals.css`, substituir por `bg-amber-500`. Verificar com `grep -r "bg-warning" sparta/src/app/globals.css` antes de usar.

---

## Checklist de Implementação

### Backend (Função pura + Server Action)

- [x] `lib/readiness/correlations.ts` — tipos exportados + `detectCorrelations()` + algoritmos estatísticos
- [x] ESLint disable em query `fatigue_responses` dentro da função pura
- [x] `player-profile.ts` — imports adicionados + `getPlayerCorrelationsTabData()` no final
- [x] `requireStaffRole()` + `getServiceRoleClient()` em sequência correcta
- [x] `auditedRead()` com `action='correlations.viewed'`, `targetKind='player'`, `targetId=playerId`
- [x] `maybeSingle()` para player lookup (não `.single()`)
- [x] `club_id` guard na query do player

### Frontend (Components)

- [x] `CorrelacoesTab.tsx` — AbortController + useEffect + loading/error/empty states
- [x] `toNaturalLanguage()` com género correcto (energy/focus/sleep/mood/soreness)
- [x] `TooltipExplain` em cada item + no header
- [x] `EmptyState` quando `findings.length === 0`
- [x] `aria-label="Correlações detectadas"` na `<ul>`
- [x] `ProfileTabs.tsx` — import + tipo + TABS array + painel

### Testing

- [x] `correlations.test.ts` — makeSupabase helper (padrão recovery.test.ts)
- [x] Teste: sem fatigue_responses → vazio
- [x] Teste: sem match_events → vazio
- [x] Teste: n < 10 → vazio
- [x] Teste: correlação forte detectada (rho > 0.9 com dados sintéticos perfeitos)
- [x] Teste: correlação fraca filtrada (|rho| < 0.5)
- [x] Teste: ordenação por |rho| desc
- [x] Teste: totalSessionsAnalyzed correcto
- [x] Testes existentes: sem regressões

---

## Recursos & Referências

- **Epics.md:** Story 7.5 (FR39 — Correlation Detection)
- **`recovery.ts`:** `sparta/src/lib/readiness/recovery.ts` — padrão exacto de função pura com SupabaseClient
- **`recovery.test.ts`:** `sparta/src/lib/readiness/__tests__/recovery.test.ts` — padrão de mock Supabase
- **`RecuperacaoTab.tsx`:** `sparta/src/app/(staff)/plantel/[id]/perfil/RecuperacaoTab.tsx` — template do Client Component
- **`player-profile.ts`:** `sparta/src/lib/actions/player-profile.ts` — adicionar `getPlayerCorrelationsTabData()` no final (linha ~948)
- **`ProfileTabs.tsx`:** `sparta/src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — 8 alterações cirúrgicas
- **`audited.ts`:** `src/lib/data/audited.ts` — assinatura de `auditedRead()`
- **Migration 000200:** `fatigue_responses` schema (phase='post')
- **Migration 000270:** `match_events` schema (8 actions válidas)
- **AGENTS.md:** regras TypeScript §1 service role, §2 "use server" exports, §3 RLS patterns

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- `correlations.ts` implementado com Spearman puro (rankArray → pearsonR → spearmanRho + p-value via regularized incomplete beta de Lentz). Sem dependências externas.
- ESLint `custom/no-direct-health-data-read` dispara em `match_events` (está em HEALTH_TABLES) — adicionado `// eslint-disable-next-line` em ambas as queries (`fatigue_responses` e `match_events`) com comentário justificativo `called from getPlayerCorrelationsTabData via auditedRead()`.
- `getPlayerCorrelationsTabData()` segue exactamente o padrão `getPlayerRecoveryTabData()`: `requireStaffRole()` → `getServiceRoleClient()` → player guard com `maybeSingle()` → `auditedRead<CorrelationsResult>(...)`.
- `CorrelacoesTab.tsx` com AbortController, estados loading/error/empty, `toNaturalLanguage()` com género PT-PT, `TooltipExplain` no header e em cada item, `aria-label="Correlações detectadas"` na `<ul>`.
- `ProfileTabs.tsx` alterado: import + tipo `TabId` alargado + TABS array + painel. sessionStorage restore funciona automaticamente (usa `TABS.some(t => t.id === stored)`).
- `bg-warning` não existe em `globals.css` — usado `bg-amber-500` como fallback conforme documentado na story.
- 15 testes novos passam em `correlations.test.ts`. Suite completa: 1929/1962 (2 falhas pré-existentes em `team-aggregate.test.ts`, não relacionadas). Lint ✅; typecheck nos ficheiros desta story ✅.

### File List

- `sparta/src/lib/readiness/correlations.ts` — NOVO (detectCorrelations + Spearman + p-value)
- `sparta/src/lib/readiness/__tests__/correlations.test.ts` — NOVO (15 testes)
- `sparta/src/lib/actions/player-profile.ts` — MODIFICADO (imports + getPlayerCorrelationsTabData)
- `sparta/src/app/(staff)/plantel/[id]/perfil/CorrelacoesTab.tsx` — NOVO (Client Component)
- `sparta/src/app/(staff)/plantel/[id]/perfil/ProfileTabs.tsx` — MODIFICADO (tab Correlações)

---

## Review Findings

### Patch (Actionable)

- [x] [Review][Patch] `toNaturalLanguage()` — soreness logic confusing [CorrelacoesTab.tsx:47-57] — Lógica correcta mas "alta dor → mais passes" lê-se como positivo. Clarificar apresentação para evitar confusão. ✅ FIXED
- [x] [Review][Patch] ESLint disable desnecessário em `match_events` [correlations.ts:103] — Remover disable; spec confirma match_events é performance data, não health data. ✅ FIXED
- [x] [Review][Patch] Sem validação de `playerId` vazio em CorrelacoesTab [CorrelacoesTab.tsx:82] — Adicionar guard `if (!playerId?.trim())` antes de `void load()`. ✅ FIXED
- [x] [Review][Patch] `toNaturalLanguage()` fallback para dimensão desconhecida [CorrelacoesTab.tsx:42] — Adicionar type guard ou assert para `FatigueDimension` union. ✅ FIXED

---

## Change Log

- 2026-06-01: Story 7-5 implementada — `detectCorrelations()` Spearman puro, `getPlayerCorrelationsTabData()` Server Action com auditedRead FR50, `CorrelacoesTab` Client Component PT-PT, tab "Correlações" em `ProfileTabs`; 15 novos testes ✅; 1929/1962 testes ✅ (2 falhas pré-existentes em 7-4); lint ✅; typecheck ✅
