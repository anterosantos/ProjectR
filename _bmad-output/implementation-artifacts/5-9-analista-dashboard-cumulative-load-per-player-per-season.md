# Story 5.9: Analista Dashboard — Carga Acumulada por Jogador por Época

**Status:** ready-for-dev

**Story ID:** 5.9
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-27
**Story anterior:** 5-8-analista-dashboard-individual-4-week-fatigue-trends-multi-player-overview

> ⚠️ **DEPENDÊNCIA:** Requer `session_metrics` (Story 5.1), `sessions` (Story 2.6), e `seasons` (Story 2.5). A tabela `session_metrics` não tem `season_id` — é necessário JOIN com `sessions` para filtrar por época. Pode ser desenvolvida em paralelo com 5.5–5.8.

> ⚠️ **COORDENAÇÃO COM STORY 5.8:** A Story 5.8 adicionou `/tendencias/fadiga/page.tsx` e modificou `/tendencias/page.tsx` (redirect para `/tendencias/fadiga`). Esta story cria `/tendencias/carga/page.tsx` e **adiciona um layout com tabs** (`/tendencias/layout.tsx`) para navegar entre Fadiga e Carga. Se a Story 5.8 já tiver sido implementada, verificar se o `redirect` em `/tendencias/page.tsx` ainda é necessário ou se o layout de tabs o substitui.

---

## Story

As an Analista,
I want a dashboard showing each player's cumulative sRPE load for the current season with a monthly breakdown,
so that I can spot under-trained or over-trained athletes at a glance and at depth.

---

## Acceptance Criteria

### AC #1 — Rota `/tendencias/carga` lista todos os jogadores activos com carga acumulada

**Given** o analista navega para `/tendencias/carga`

**When** a página carrega

**Then** a época atual é detectada (`is_current=true` na tabela `seasons`)

**And** todos os jogadores activos do clube são listados em linhas (`archived_at IS NULL`)

**And** cada linha mostra: nome, posição, escalão, carga total sRPE (soma epoch), gráfico de barras por mês (recharts), e contagem de sessões (FR38)

**And** a ordem default é por carga total sRPE descendente

---

### AC #2 — Season toggle: "Época Atual" vs "Cumulativo todas as épocas"

**Given** o analista interage com o toggle de época (componente `<SeasonToggle>`)

**When** muda para "Cumulativo"

**Then** os dados reflectem TODAS as sessões de TODAS as épocas (não filtrados por `season_id`)

**And** quando volta para a época atual, apenas sessões da época `is_current=true` são contabilizadas

**And** o estado do toggle persiste em sessionStorage via `useSeasonView()` hook

---

### AC #3 — Filtros por posição e ordenação

**Given** o analista abre o filtro `<Sheet>`

**When** interage com os filtros

**Then** pode filtrar por posição (`GR | DEF | MED | AVA | Todas`)

**And** pode ordenar por: carga total sRPE descendente (default), contagem de sessões descendente, ou nome alfabético

**And** filtros activos aparecem como chips removíveis acima da lista (UX-DR35)

---

### AC #4 — Badges de threshold: "Carga baixa" / "Carga alta"

**Given** jogadores com carga muito diferente da média

**When** a linha renderiza

**Then** se `total_load < season_avg × 0.5` → badge `signal/info` "Carga baixa" com ícone redundante

**And** se `total_load > season_avg × 1.5` → badge `signal/caution` "Carga alta" com ícone redundante

**And** `season_avg` = soma de `srpe_load` de todos os jogadores activos ÷ número de jogadores activos (com pelo menos 1 sessão)

---

### AC #5 — `auditedRead()` ao carregar a página

**Given** o analista abre `/tendencias/carga`

**When** a Server Action `getCumulativeLoadData()` é invocada

**Then** é criada uma entrada em `audit_logs` com `action='load.viewed'`, `target_kind='session_metrics'`, `actor_id=auth.uid()` (FR50)

**And** o registo é fire-and-forget (não bloqueia o carregamento da página)

---

### AC #6 — Exportar CSV do dataset visível

**Given** o analista tapa "Exportar CSV"

**When** o download é iniciado

**Then** o dataset actualmente visível (após filtros activos) é descarregado como ficheiro CSV

**And** o CSV inclui: nome, posição, escalão, carga_total, sessoes_count, e colunas mensais (e.g., "2024-09", "2024-10", …)

**And** esta funcionalidade é implementada client-side (Blob + URL.createObjectURL) — sem dependência da Edge Function de Story 3.6

---

### AC #7 — Estado vazio: sem época atual / sem dados de carga

**Given** o clube não tem uma época `is_current=true`

**When** a página carrega

**Then** é exibido `<EmptyState>` com mensagem "Sem época atual configurada. Configura em /configuracoes/epocas."

**Given** o clube tem época atual mas nenhum jogador tem sessões com sRPE

**When** a página carrega

**Then** é exibido `<EmptyState>` com mensagem "Sem dados de carga para esta época."

---

### AC #8 — Performance: dados completos ≤ 3s P95

**Given** o analista abre a página em 4G mobile

**When** a página carrega

**Then** os dados completos estão disponíveis em ≤ 3s P95 (NFR4)

**And** a query é batch (não N+1 por jogador)

---

### AC #9 — Cobertura de testes ≥ 80% (NFR54)

**Given** os testes correm

**When** executados

**Then** season filter logic, monthly breakdown grouping, threshold badge logic, e CSV export são cobertos ≥ 80%

---

## Tasks / Subtasks

- [ ] **Task 1: Server Action `getCumulativeLoadData()` em `src/lib/actions/load.ts`** (AC: #1, #5, #7, #8)
  - [ ] Criar `sparta/src/lib/actions/load.ts` com `"use server"` no topo
  - [ ] Definir tipos `PlayerLoadData`, `MonthlyLoad`, `LoadFilters` (ver secção Architecture)
  - [ ] Implementar `requireStaffRole()` guard (copiar de `readiness.ts` — importar de `@/lib/actions/readiness` se exportada, senão duplicar o pattern)
  - [ ] Buscar época atual: chamar `getCurrentSeason()` de `@/lib/actions/seasons`
  - [ ] Query batch 1 — jogadores activos:
    ```sql
    SELECT id, full_name, position, age_group
    FROM players
    WHERE club_id = auth.club_id() AND archived_at IS NULL
    ORDER BY full_name ASC
    ```
  - [ ] Query batch 2 — session_metrics com JOIN sessions (para obter season_id e scheduled_at):
    ```typescript
    supabase
      .from("session_metrics")
      .select("player_id, srpe_load, sessions!inner(season_id, scheduled_at)")
      .eq("club_id", clubId)
    ```
    CRÍTICO: `session_metrics` não tem `season_id` — é obrigatório o JOIN via `sessions`.
  - [ ] Agrupar métricas por `player_id` em TypeScript (Map para O(1) lookup)
  - [ ] Calcular `total_load` e `monthly_breakdown` por jogador (ver lógica em Architecture)
  - [ ] Calcular `season_avg` para os badges de threshold
  - [ ] Chamar `auditedRead()` com `action='load.viewed'`, `target_kind='session_metrics'`, `target_id=clubId` (fire-and-forget)
  - [ ] Retornar `Result<{ players: PlayerLoadData[]; currentSeason: Season | null }, AppError>`

- [ ] **Task 2: Componente `<MonthlyLoadBar>` em `src/components/domain/MonthlyLoadBar.tsx`** (AC: #1)
  - [ ] Criar como Client Component
  - [ ] Props: `data: MonthlyLoad[]` (array de `{ month: string; load: number }`)
  - [ ] Usar `<BarChart>` do recharts: sem eixo X visível, eixo Y opcional, sem tooltip complexo, `isAnimationActive={false}`
  - [ ] `role="img"` + `aria-label="Carga mensal: {meses_resumo}"` no wrapper div
  - [ ] Estado vazio: se `data.length === 0`, renderizar `<span aria-hidden="true">—</span>`
  - [ ] Cor das barras: `#3B82F6` (azul — consistente com a cor de energia de fadiga)
  - [ ] Mock de recharts para testes: `vi.mock("recharts", ...)` (copiar de `FatigueChart.test.tsx`)

- [ ] **Task 3: Componente `<PlayerLoadRow>` em `src/components/domain/PlayerLoadRow.tsx`** (AC: #1, #4)
  - [ ] Props: `player: PlayerLoadData`, `seasonAvg: number`
  - [ ] Layout: `nome | posição | escalão | carga_total | [bar chart] | sessões | [badge?]`
  - [ ] Badge threshold:
    - `total_load < seasonAvg × 0.5` → badge com classe `bg-blue-100 text-blue-700` + ícone `<TrendingDown>` + "Carga baixa"
    - `total_load > seasonAvg × 1.5` → badge com classe `bg-amber-100 text-amber-700` + ícone `<TrendingUp>` + "Carga alta"
    - Sempre cor + ícone redundante (UX-DR1)
  - [ ] Se `total_load === 0`: mostrar "0" e não mostrar badge de "Carga baixa" (jogador sem dados ≠ jogador treinado)
  - [ ] Responsivo: em mobile (<640px) ocultar escalão e posição; em desktop mostrar tudo

- [ ] **Task 4: Componente `<LoadFiltersSheet>` em `src/components/domain/LoadFiltersSheet.tsx`** (AC: #3)
  - [ ] Client Component com props: `onFilter: (f: LoadFilters) => void`, `initialFilters: LoadFilters`
  - [ ] Trigger: botão `<SlidersHorizontal>` lucide + "Filtros" abrindo `<DrillDownSheet side="bottom">`
  - [ ] Filtros:
    - RadioGroup posição: `Todas · GR · DEF · MED · AVA`
    - RadioGroup ordenação: `Carga ↓ (default) · Sessões ↓ · Nome A→Z`
  - [ ] Chips removíveis acima da lista (UX-DR35)
  - [ ] Persistência: `sessionStorage` com chave `sparta:load:filters`
  - [ ] Padrão identico ao `FatigueFilters.tsx`: `loadFiltersFromStorage()`, `saveFiltersToStorage()`, `useEffect` no mount

- [ ] **Task 5: Componente `<LoadDashboard>` (Client Component wrapper) em `src/components/domain/LoadDashboard.tsx`** (AC: #1, #2, #3, #6)
  - [ ] Props: `players: PlayerLoadData[]`, `currentSeason: Season | null`
  - [ ] State: `filters: LoadFilters`, `seasonView: SeasonView` (de `useSeasonView()`)
  - [ ] Lógica de filtro client-side: aplicar `position`, `sortBy` ao array filtrado
  - [ ] Lógica de toggle de época:
    - `seasonView === 'current'`: usar `player.currentSeasonLoad` e `player.currentSeasonMonthly`
    - `seasonView === 'cumulative'`: usar `player.totalLoad` e `player.allTimeMonthly`
  - [ ] Calcular `seasonAvg` com base nos dados activos da view actual (recalcular ao mudar toggle)
  - [ ] Renderizar `<SeasonToggle currentSeason={currentSeason} />` no header
  - [ ] Renderizar `<LoadFiltersSheet onFilter={setFilters} />` + chips
  - [ ] Renderizar lista de `<PlayerLoadRow>` para cada jogador filtrado
  - [ ] Botão "Exportar CSV" que invoca `exportLoadCsv(filteredPlayers, seasonView)`
  - [ ] `<EmptyState>` quando lista filtrada está vazia

- [ ] **Task 6: Função `exportLoadCsv()` em `src/lib/utils/export.ts`** (AC: #6)
  - [ ] Função pura (não é Server Action): `exportLoadCsv(players: PlayerLoadData[], view: SeasonView): void`
  - [ ] Gerar headers CSV: `Nome,Posição,Escalão,Carga Total,Sessões,{meses...}`
  - [ ] Meses em formato `AAAA-MM` (derivados das chaves de `monthly_breakdown`)
  - [ ] Criar `Blob` e usar `URL.createObjectURL` + click sintético para download
  - [ ] Nome do ficheiro: `sparta-carga-{YYYY-MM-DD}.csv`
  - [ ] Escapar campos com vírgulas/aspas (formula injection prevention: prefixar com `'` se começa com `=`, `+`, `-`, `@`)

- [ ] **Task 7: Página `/tendencias/carga/page.tsx`** (AC: #1, #5, #7)
  - [ ] Criar `sparta/src/app/(staff)/tendencias/carga/page.tsx` como Server Component
  - [ ] Chamar `getCumulativeLoadData()` (sem filtros — filtros aplicados no cliente)
  - [ ] Se `result.ok === false`: renderizar `<EmptyState>` com mensagem de erro
  - [ ] Se sem época atual: renderizar `<EmptyState>` com link para `/configuracoes/epocas`
  - [ ] Renderizar `<LoadDashboard players={players} currentSeason={currentSeason} />`
  - [ ] Metadata: `title: "Carga Acumulada — SPARTA"`

- [ ] **Task 8: Layout `/tendencias/layout.tsx` com tabs Fadiga / Carga** (AC: #1)
  - [ ] Criar `sparta/src/app/(staff)/tendencias/layout.tsx`
  - [ ] Tabs com `<Link href="/tendencias/fadiga">` e `<Link href="/tendencias/carga">`
  - [ ] Usar `usePathname()` (hook de `next/navigation`) para marcar tab activo com `aria-current="page"`
  - [ ] ATENÇÃO: `layout.tsx` é um Server Component mas `usePathname()` é client-only → criar um sub-componente Client Component `<TendenciasTabNav>` para a navegação
  - [ ] Se Story 5.8 já tiver modificado `/tendencias/page.tsx` para fazer `redirect('/tendencias/fadiga')`, manter esse redirect (o layout renderiza-se mas o redirect da `page.tsx` acontece primeiro)

- [ ] **Task 9: Testes** (AC: #1–#9)
  - [ ] `sparta/src/components/domain/MonthlyLoadBar.test.tsx`
  - [ ] `sparta/src/components/domain/PlayerLoadRow.test.tsx`
  - [ ] `sparta/src/components/domain/LoadFiltersSheet.test.tsx`
  - [ ] `sparta/src/__tests__/app/(staff)/tendencias-carga.test.tsx`
  - [ ] Ver secção Testes abaixo para fixtures e casos obrigatórios

---

## Architecture / Technical Requirements

### Tipos de Dados

```typescript
// sparta/src/lib/actions/load.ts

export type MonthlyLoad = {
  month: string;   // "YYYY-MM" (e.g., "2024-09")
  load: number;    // soma de srpe_load nesse mês
};

export type PlayerLoadData = {
  playerId: string;
  playerName: string;
  position: string;        // "GR" | "DEF" | "MED" | "AVA"
  ageGroup: string;        // "u14" | "u15" | "u17" | "u19" | "senior"
  // Dados filtrados pela época atual
  currentSeasonLoad: number;        // soma de srpe_load na época atual
  currentSeasonSessions: number;    // count de sessões na época atual
  currentSeasonMonthly: MonthlyLoad[];
  // Dados acumulados de todas as épocas
  totalLoad: number;
  totalSessions: number;
  allTimeMonthly: MonthlyLoad[];
};

export type LoadFilters = {
  position: 'all' | 'GR' | 'DEF' | 'MED' | 'AVA';
  sortBy: 'load' | 'sessions' | 'alphabetic';
};
```

### CRÍTICO: Query com JOIN sessions→season_id

A tabela `session_metrics` **não tem `season_id`**. O JOIN é obrigatório:

```typescript
const { data: metrics, error: metricsError } = await supabase
  .from("session_metrics")
  .select("player_id, srpe_load, sessions!inner(season_id, scheduled_at)")
  .eq("club_id", clubId);
```

O resultado tem shape:
```typescript
type MetricRow = {
  player_id: string;
  srpe_load: number;
  sessions: { season_id: string; scheduled_at: string };
};
```

NOTA: `sessions!inner` usa INNER JOIN — exclui automaticamente session_metrics sem sessão correspondente. Se não existirem registos, `metrics` é array vazio (não null).

### Lógica de Agrupamento e Cálculo

```typescript
// Calcular dados por jogador após query batch
const metricsByPlayer = new Map<string, MetricRow[]>();
for (const m of metrics ?? []) {
  const arr = metricsByPlayer.get(m.player_id) ?? [];
  arr.push(m);
  metricsByPlayer.set(m.player_id, arr);
}

const players: PlayerLoadData[] = playersData.map((p) => {
  const allMetrics = metricsByPlayer.get(p.id) ?? [];
  
  // Separar métricas por época atual vs todas
  const currentMetrics = currentSeason
    ? allMetrics.filter((m) => m.sessions.season_id === currentSeason.id)
    : [];

  // Função auxiliar de agrupamento mensal
  function groupByMonth(rows: typeof allMetrics): MonthlyLoad[] {
    const monthMap = new Map<string, number>();
    for (const row of rows) {
      const month = row.sessions.scheduled_at.slice(0, 7); // "YYYY-MM"
      monthMap.set(month, (monthMap.get(month) ?? 0) + row.srpe_load);
    }
    return Array.from(monthMap.entries())
      .map(([month, load]) => ({ month, load }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  return {
    playerId: p.id,
    playerName: p.full_name ?? "—",
    position: p.position ?? "—",
    ageGroup: p.age_group ?? "—",
    currentSeasonLoad: currentMetrics.reduce((s, m) => s + m.srpe_load, 0),
    currentSeasonSessions: new Set(currentMetrics.map((m) => m.sessions.scheduled_at.slice(0, 10))).size,
    currentSeasonMonthly: groupByMonth(currentMetrics),
    totalLoad: allMetrics.reduce((s, m) => s + m.srpe_load, 0),
    totalSessions: new Set(allMetrics.map((m) => m.sessions.scheduled_at.slice(0, 10))).size,
    allTimeMonthly: groupByMonth(allMetrics),
  };
});
```

### Cálculo de `season_avg` para badges

```typescript
// No LoadDashboard (client-side, recalculado ao mudar seasonView)
const activePlayers = filteredPlayers.filter(
  (p) => (seasonView === 'current' ? p.currentSeasonLoad : p.totalLoad) > 0
);
const seasonAvg =
  activePlayers.length > 0
    ? activePlayers.reduce(
        (s, p) => s + (seasonView === 'current' ? p.currentSeasonLoad : p.totalLoad),
        0
      ) / activePlayers.length
    : 0;
```

### CRÍTICO: Reutilizar, Não Reinventar

| O quê | Localização | Como usar |
|-------|-------------|-----------|
| `requireStaffRole()` | `sparta/src/lib/actions/readiness.ts` linha ~37 | Copiar o padrão (não está exportada — duplicar localmente em `load.ts`) |
| `getCurrentSeason()` | `@/lib/actions/seasons` | Importar directamente |
| `auditedRead()` | `@/lib/data/audited` | Fire-and-forget — `void auditedRead(...)` NÃO `await` |
| `Result<T, E>`, `ok()`, `err()` | `@/lib/types` | Tipo de retorno + helpers |
| `createServerClient()` | `@/lib/supabase/server` | Client para Server Actions (com `await`) |
| `<DrillDownSheet>` | `@/components/ui/drill-down-sheet` | Para o filter sheet (padrão FatigueFilters.tsx) |
| `<EmptyState>` | `@/components/ui/empty-state` | Estados vazios (Story 1.8) |
| `<SeasonToggle>` | `@/components/ui/season-toggle` | Toggle época (Story 2.5) — aceita `currentSeason: Season \| null` |
| `useSeasonView()` | `@/hooks/useSeasonView` | Hook para o estado "current"/"cumulative" |
| `recharts` | pacote já instalado | `BarChart`, `Bar`, `ResponsiveContainer` |
| `SlidersHorizontal`, `TrendingUp`, `TrendingDown` | `lucide-react` | Ícones (já instalado) |

### auditedRead — Assinatura Correta

```typescript
// CORRECTO: auditedRead recebe options object + async fn
// Ver audited.ts para interface AuditedReadOptions

void auditedRead(
  {
    action: "load.viewed",
    targetKind: "session_metrics",
    targetId: clubId,
    actorId: userId,
    clubId,
  },
  async () => ({ data: null, error: null }) // dummy fn para fire-and-forget puro
);
```

NOTA: `auditedRead` recebe um callback `fn` que executa o read e registra o audit. Para fire-and-forget puro (sem necessidade do resultado da auditoria), passar uma fn trivial. ALTERNATIVA: usar `after(doInsert)` directamente como `scheduleAudit` faz internamente — mas é mais simples usar `auditedRead` com fn trivial.

**MELHOR PRÁTICA para fire-and-forget sem read:**
```typescript
// Ao invés de usar auditedRead para só fazer audit log, usar after() do next/server
import { after } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

after(async () => {
  try {
    const serviceRole = getServiceRoleClient();
    await serviceRole.from("audit_logs").insert({
      club_id: clubId,
      actor_id: userId,
      action: "load.viewed",
      target_kind: "session_metrics",
      target_id: clubId,
    });
  } catch { /* silent */ }
});
```

### CSV Export — Prevenção de Formula Injection

```typescript
function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  // Formula injection prevention: prefixar campos que começam com = + - @ com '
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  // Escapar aspas duplas e envolver em aspas se contém vírgula ou aspas
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
```

### Estrutura de Ficheiros

```
sparta/src/
├── app/(staff)/tendencias/
│   ├── layout.tsx                      CRIAR: Server Component + TendenciasTabNav Client
│   ├── page.tsx                        VERIFICAR: se já tem redirect (Story 5.8); manter redirect
│   ├── fadiga/
│   │   └── page.tsx                    (Story 5.8 — não alterar)
│   └── carga/
│       └── page.tsx                    CRIAR: Server Component
├── components/domain/
│   ├── MonthlyLoadBar.tsx              CRIAR: BarChart mensal não-interactivo
│   ├── MonthlyLoadBar.test.tsx         CRIAR
│   ├── PlayerLoadRow.tsx               CRIAR: linha com carga total + bar + badge
│   ├── PlayerLoadRow.test.tsx          CRIAR
│   ├── LoadFiltersSheet.tsx            CRIAR: sheet de filtros + chips
│   ├── LoadFiltersSheet.test.tsx       CRIAR
│   └── LoadDashboard.tsx               CRIAR: Client Component wrapper
└── lib/
    ├── actions/
    │   └── load.ts                     CRIAR: getCumulativeLoadData()
    └── utils/
        └── export.ts                   CRIAR (ou adicionar a ficheiro existente): exportLoadCsv()
```

### Layout com Tabs — Implementação

```typescript
// sparta/src/app/(staff)/tendencias/layout.tsx
import { TendenciasTabNav } from "@/components/domain/TendenciasTabNav";

export default function TendenciasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TendenciasTabNav />
      {children}
    </div>
  );
}

// sparta/src/components/domain/TendenciasTabNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TendenciasTabNav() {
  const pathname = usePathname();
  const tabs = [
    { href: "/tendencias/fadiga", label: "Fadiga" },
    { href: "/tendencias/carga", label: "Carga" },
  ];
  return (
    <nav aria-label="Secções de tendências" className="flex gap-1 border-b px-4">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            pathname === tab.href
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
```

---

## Dev Notes — Contexto das Stories Anteriores

### Story 5.8 — Padrões a Reutilizar

- `getFatigueTrendsData()` em `trends.ts` usa exatamente o mesmo padrão de 2 queries batch + agrupamento em TypeScript — replicar para `getCumulativeLoadData()` com session_metrics
- `TrendFilters.tsx` padrão de sessionStorage + sheet + chips — copiar para `LoadFiltersSheet.tsx`
- `FatigueSparkline.tsx` padrão de `role="img"` + `aria-label` — usar para `MonthlyLoadBar.tsx`
- Mock do recharts: `vi.mock("recharts", ...)` — copiar de `FatigueChart.test.tsx`

### SeasonToggle — Comportamento Existente

O componente `<SeasonToggle>` (Story 2.5) em `@/components/ui/season-toggle.tsx`:
- Aceita `currentSeason: Season | null`
- Usa internamente `useSeasonView()` de `@/hooks/useSeasonView`
- O `useSeasonView()` retorna `[view, setView]` onde `view` é `"current" | "cumulative"`
- O estado persiste em sessionStorage com chave `sparta-season-view`
- O `<LoadDashboard>` também deve chamar `useSeasonView()` para sincronizar com o toggle

### Story 4.5 — FatigueFilters.tsx — Pattern de Chips Removíveis

```typescript
// Padrão estabelecido — chips são construídos a partir do estado de filtros
const chips: Array<{ label: string; onRemove: () => void }> = [];

if (filters.position !== "all") {
  chips.push({
    label: filters.position,
    onRemove: () => {
      const next = { ...filters, position: "all" as const };
      setFilters(next);
      setDraft(next);
      saveFiltersToStorage(next);
      onFilter(next);
    },
  });
}
```

### Middleware de Story 4.6 — Sem Alterações

O middleware em `sparta/src/middleware.ts` já bloqueia `/tendencias` (com `pathname.startsWith`) para players. A nova sub-rota `/tendencias/carga` é coberta automaticamente.

### `noUncheckedIndexedAccess` (NFR55) — Guards Obrigatórios

```typescript
// ✅ Correcto
const arr = metricsByPlayer.get(p.id) ?? [];
const month = row.sessions.scheduled_at.slice(0, 7);

// ❌ ERRO — sem guard
const arr = metricsByPlayer.get(p.id); // TypeScript: pode ser undefined
```

### Sessões Únicas para Contagem

Para `currentSeasonSessions`, a contagem de sessões é baseada em sessões únicas (não em linhas de session_metrics). Um jogador pode ter múltiplas métricas por sessão? Não — há um `UNIQUE (session_id, player_id)` em `session_metrics` (Story 5.1). Logo `currentMetrics.length === número de sessões`. Usar `currentMetrics.length` directamente.

```typescript
// Simplificado — sem necessidade de Set:
currentSeasonSessions: currentMetrics.length,
totalSessions: allMetrics.length,
```

### Commits Relevantes

- `d5e1f25 5.3 5.4 5.5 - done` — stories 5.3, 5.4, 5.5 concluídas (readiness_snapshots, painel, drill-down)
- `eb1c6a6 Fix` — patches da Story 5.4

---

## Testes — Padrão e Fixtures

### Fixtures Partilhadas

```typescript
// Fixtures para todos os ficheiros de teste desta story

function makeMonthlyLoad(months = 3, load = 500): MonthlyLoad[] {
  return Array.from({ length: months }, (_, i) => ({
    month: `2024-0${i + 9}`,  // "2024-09", "2024-10", "2024-11"
    load,
  }));
}

function makePlayerLoadData(overrides: Partial<PlayerLoadData> = {}): PlayerLoadData {
  return {
    playerId: "player-uuid-1",
    playerName: "João Silva",
    position: "MED",
    ageGroup: "senior",
    currentSeasonLoad: 1500,
    currentSeasonSessions: 12,
    currentSeasonMonthly: makeMonthlyLoad(3, 500),
    totalLoad: 3000,
    totalSessions: 24,
    allTimeMonthly: makeMonthlyLoad(6, 500),
    ...overrides,
  };
}
```

### `MonthlyLoadBar.test.tsx` — Casos Obrigatórios

```typescript
describe("MonthlyLoadBar", () => {
  it("renderiza role=img no container", () => { ... });
  it("renderiza aria-label com resumo de meses", () => { ... });
  it("renderiza — quando data está vazio", () => { ... });
  it("não lança erro com isAnimationActive=false", () => { ... });
  // Mock: vi.mock("recharts", () => ({ BarChart: ..., Bar: ..., ResponsiveContainer: ... }))
});
```

### `PlayerLoadRow.test.tsx` — Casos Obrigatórios

```typescript
describe("PlayerLoadRow", () => {
  it("renderiza nome, posição e escalão", () => { ... });
  it("não mostra badge quando carga está na média (0.5x < load < 1.5x)", () => { ... });
  it("mostra badge 'Carga baixa' quando total_load < seasonAvg * 0.5", () => { ... });
  it("mostra badge 'Carga alta' quando total_load > seasonAvg * 1.5", () => { ... });
  it("badge 'Carga baixa' tem ícone redundante (UX-DR1)", () => { ... });
  it("badge 'Carga alta' tem ícone redundante (UX-DR1)", () => { ... });
  it("carga zero não mostra badge 'Carga baixa'", () => { ... }); // edge case
  it("renderiza contagem de sessões", () => { ... });
});
```

### `LoadFiltersSheet.test.tsx` — Casos Obrigatórios

```typescript
describe("LoadFiltersSheet", () => {
  it("chama onFilter no mount com valores default", () => { ... });
  it("abre sheet ao clicar botão Filtros", () => { ... });
  it("filtra por posição GR ao seleccionar", () => { ... });
  it("ordenação por sessões chama onFilter com sortBy='sessions'", () => { ... });
  it("chips removíveis aparecem para filtros activos (posição)", () => { ... });
  it("Limpar repõe valores default", () => { ... });
  it("persiste filtros em sessionStorage com chave 'sparta:load:filters'", () => { ... });
});
```

### `tendencias-carga.test.tsx` — Integração

```typescript
vi.mock("@/lib/actions/load", () => ({
  getCumulativeLoadData: vi.fn(),
}));
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("LoadDashboard", () => {
  it("renderiza lista de jogadores", async () => { ... });
  it("badge threshold 'Carga alta' visível para jogador com carga > 1.5x média", () => { ... });
  it("badge threshold 'Carga baixa' visível para jogador com carga < 0.5x média", () => { ... });
  it("groupByMonth agrupa corretamente por mês YYYY-MM", () => { ... });
  it("season filter: seasonView='current' usa currentSeasonLoad", () => { ... });
  it("season filter: seasonView='cumulative' usa totalLoad", () => { ... });
  it("exportar CSV descarrega ficheiro com headers corretos", () => { ... }); // mock URL.createObjectURL
  it("EmptyState quando sem época atual", async () => { ... });
  it("zero violações axe", async () => { ... }); // vitest-axe
});
```

### Alvo de Cobertura

≥ 80% em todos os ficheiros novos (NFR54).

---

## Referências

- [Epics.md — Story 5.9](../../_bmad-output/planning-artifacts/epics.md#story-59-analista-dashboard--cumulative-load-per-player-per-season) — ACs completos + FR38
- [Story 5.8](./5-8-analista-dashboard-individual-4-week-fatigue-trends-multi-player-overview.md) — Padrões de TrendsDashboard, TrendFilters, FatigueSparkline
- [seasons.ts](../sparta/src/lib/actions/seasons.ts) — `getCurrentSeason()` + tipo `Season`
- [readiness.ts](../sparta/src/lib/actions/readiness.ts) — `requireStaffRole()` pattern + `auditedRead()` usage
- [FatigueFilters.tsx](../sparta/src/components/domain/FatigueFilters.tsx) — sessionStorage + sheet + chips pattern
- [season-toggle.tsx](../sparta/src/components/ui/season-toggle.tsx) — `<SeasonToggle>` component
- [useSeasonView.ts](../sparta/src/hooks/useSeasonView.ts) — `useSeasonView()` hook
- [audited.ts](../sparta/src/lib/data/audited.ts) — `auditedRead()` com `AuditedReadOptions`
- [database.types.ts](../sparta/src/lib/supabase/database.types.ts) — `session_metrics` + `sessions` schemas
- [AGENTS.md](../sparta/AGENTS.md) — convenções TypeScript, aliases @/*, React 19, noUncheckedIndexedAccess

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

### Notas Chave para o Developer

1. **JOIN obrigatório sessions→season_id** — `session_metrics` não tem `season_id`. Usar `sessions!inner(season_id, scheduled_at)` na query Supabase.
2. **Dois arrays de dados por jogador** — `currentSeasonLoad`/`currentSeasonMonthly` e `totalLoad`/`allTimeMonthly`. O toggle de época selecciona qual usar no cliente sem re-fetch.
3. **`season_avg` recalculado no cliente** — Quando o toggle muda (current ↔ cumulative), a média muda. Calcular `seasonAvg` dentro do `LoadDashboard` baseado nos dados activos.
4. **Carga zero ≠ "Carga baixa"** — Jogador sem sessões sRPE (`total_load === 0`) não deve receber badge. O badge só aparece quando `total_load > 0` e está muito abaixo da média.
5. **`session_metrics` tem UNIQUE (session_id, player_id)** — Cada linha = uma sessão. `metrics.length` = número de sessões. Sem necessidade de Set para contagem.
6. **Mock do recharts** — copiar `vi.mock("recharts", ...)` de `FatigueChart.test.tsx`. Sem este mock, testes falham no jsdom.
7. **Layout com tabs** — Criar `tendencias/layout.tsx` com `<TendenciasTabNav>` (Client Component separado para `usePathname()`). O layout envolve AMBAS as páginas (fadiga + carga).
8. **CSV é client-side** — Não usar a Edge Function de Story 3.6. Gerar CSV em memória com `Blob` + `URL.createObjectURL` + click sintético. Escapar fórmulas.
9. **auditedRead vs after()** — Para fire-and-forget sem read, é mais simples usar `after()` directamente em vez de `auditedRead` com fn trivial. Ambos são válidos.
10. **`noUncheckedIndexedAccess`** — Todos os acessos a arrays/maps precisam de guards: `arr?.[0] ?? null`, `map.get(key) ?? []`.

### File List

**Ficheiros a Criar:**
- `sparta/src/app/(staff)/tendencias/layout.tsx`
- `sparta/src/app/(staff)/tendencias/carga/page.tsx`
- `sparta/src/lib/actions/load.ts`
- `sparta/src/components/domain/TendenciasTabNav.tsx`
- `sparta/src/components/domain/MonthlyLoadBar.tsx`
- `sparta/src/components/domain/MonthlyLoadBar.test.tsx`
- `sparta/src/components/domain/PlayerLoadRow.tsx`
- `sparta/src/components/domain/PlayerLoadRow.test.tsx`
- `sparta/src/components/domain/LoadFiltersSheet.tsx`
- `sparta/src/components/domain/LoadFiltersSheet.test.tsx`
- `sparta/src/components/domain/LoadDashboard.tsx`
- `sparta/src/lib/utils/export.ts`
- `sparta/src/__tests__/app/(staff)/tendencias-carga.test.tsx`

**Ficheiros a Verificar/Modificar:**
- `sparta/src/app/(staff)/tendencias/page.tsx` — verificar se Story 5.8 já adicionou `redirect('/tendencias/fadiga')`; se não, mantê-lo ou deixar o layout de tabs tratar da navegação

---

## Change Log

### 2026-05-27 (Story Created)
- ✅ Análise do Epic 5.9 (FR38, season toggle, threshold badges, CSV export)
- ✅ JOIN obrigatório session_metrics→sessions identificado (sem season_id directo)
- ✅ Padrão dual-arrays (currentSeason + allTime) para toggle client-side sem re-fetch
- ✅ season_avg calculado no cliente (recalculado ao mudar toggle)
- ✅ Layout com tabs /tendencias/layout.tsx especificado (TendenciasTabNav Client Component)
- ✅ CSV export client-side com prevenção de formula injection
- ✅ auditedRead vs after() documentados como ambos válidos
- ✅ Reutilização de SeasonToggle + useSeasonView identificada
- ✅ Padrão de chips removíveis e sessionStorage de FatigueFilters.tsx referenciado
- ✅ noUncheckedIndexedAccess guards e recharts mock documentados
- ✅ Fixtures de testes e casos obrigatórios definidos para 4 ficheiros
