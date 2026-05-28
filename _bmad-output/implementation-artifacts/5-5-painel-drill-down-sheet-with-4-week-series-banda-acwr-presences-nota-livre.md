# Story 5.5: Painel — Drill-Down Sheet com Série de 4 Semanas, Banda ACWR, Presenças, Nota Livre

**Status:** ready-for-dev

**Story ID:** 5.5
**Epic:** Epic 5 — Painel de Prontidão & Inteligência (defining experience do José)
**Criado:** 2026-05-27
**Story anterior:** 5-4-painel-de-prontidao-lista-por-posicao-default-view

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que as Stories **5.1**, **5.2**, **5.3** e **5.4** estejam **done** antes de começar. Todas estão `done` em 2026-05-25.
>
> | Story | Cria | Necessário para |
> |-------|------|-----------------|
> | 5.1 | `session_metrics` table + `srpe_load` | Dados de carga por sessão |
> | 5.2 | `computeAcwr()` + `ACWR_THRESHOLDS` | Scores ACWR por escalão |
> | 5.3 | `readiness_snapshots` + `getClubReadinessSnapshots()` | Fonte de dados materializada |
> | 5.4 | `<ReadinessPanelList>` + `<PlayerRow>` + `<DrillDownSheet>` placeholder | Infra do painel + tap handler |

---

## Story

As a Treinador,
I want to tap any player on the Painel and see a drill-down with their 4-week fatigue series, ACWR with confidence band, presences and free-text note in <500ms,
So that I can investigate amber and red states with evidence in time to decide.

---

## Acceptance Criteria

### AC #1 — Sheet abre em ≤500ms

**Given** o player row (Story 5.4) é tapado

**When** o `<DrillDownSheet>` abre

**Then** a sheet abre em ≤500ms (os dados do snapshot já estão em memória no Painel — zero DB round-trips adicionais para o render inicial)

**And** a sheet mostra imediatamente (enquanto carrega a série): nome do jogador, escalão, posição, ACWR com banda, estado com semáforo

---

### AC #2 — Header da Sheet (nome, escalão, posição, ACWR, estado)

**Given** a `<PlayerDrillDownSheet>` abre

**When** renderiza

**Then** o header contém:
- Nome do jogador (`playerName`)
- Escalão (`derived_age_group`, e.g. "Sénior", "Sub-14")
- Posição primária (`primaryPosition`)
- **ACWR com banda**: se `data_sufficient=true` e `acwr != null`, mostra `"1,32 · banda 0,8–1,5"` (número formatado com vírgula PT-PT)
- **Semáforo**: `<SemaforoBadge state={state} size="lg">` com `aria-label` do estado em PT-PT

**And** se `data_sufficient=false` ou `acwr` é null, a zona ACWR mostra `<TooltipExplain>` com texto "Sem dados suficientes nos últimos 28 dias" em fundo cinzento (UX-DR9)

---

### AC #3 — Série temporal de fadiga (recharts, 4 semanas)

**Given** a sheet abre e dados são carregados

**When** a série temporal renderiza

**Then** um `<LineChart>` recharts mostra 5 linhas (dimensões de fadiga) nos últimos 28 dias:
- `dim_energy` — "Energia" — `#3B82F6` (azul)
- `dim_focus` — "Concentração" — `#A855F7` (roxo)
- `dim_sleep` — "Sono" — `#22C55E` (verde)
- `dim_soreness` — "Dores" — `#EF4444` (vermelho)
- `dim_mood` — "Estado emocional" — `#EAB308` (amarelo)

**And** X-axis: datas formatadas `"d/MM"` com `date-fns` locale `pt` (mesmo padrão de `FatigueChart.tsx`)

**And** Y-axis: domínio 1–5

**And** se não há respostas, mostra `<EmptyState>` com "Sem dados de fadiga nos últimos 28 dias" (UX-DR8)

**And** o gráfico tem `aria-label="Série temporal de fadiga de {playerName}, últimos 28 dias"` (NFR39)

---

### AC #4 — Presenças em fração

**Given** a sheet renderiza

**When** os dados de presenças são exibidos

**Then** mostra `"X/Y sessões"` onde:
- X = número de sessões com resposta de fadiga nos últimos 28 dias (unique `session_id` em `fatigue_responses`)
- Y = total de sessões agendadas do clube nos últimos 28 dias

**And** se `attendance_rate` do snapshot é não-null, usar como referência visual: `aria-label="X de Y sessões nos últimos 28 dias"`

---

### AC #5 — Audit log `readiness.drilldown` (FR50, Story 3.11)

**Given** a sheet abre

**When** `getPlayerDrillDownData(playerId)` é chamado

**Then** um `audit_logs` row é criado com:
- `action='readiness.drilldown'`
- `target_kind='readiness_snapshot'`
- `target_id=playerId`
- `actor_id=auth.uid()`
- `club_id` do staff

**And** o audit é fire-and-forget via `auditedRead()` (Story 3.11)

**And** a ESLint rule `no-direct-health-data-read` é respeitada: query a `fatigue_responses` dentro de callback `auditedRead()`

---

### AC #6 — Nota de decisão data-driven (FR35, preview de Story 5.10)

**Given** a sheet renderiza

**When** a zona de nota livre é exibida

**Then** uma zona no rodapé mostra "Nota de decisão data-driven" como botão ghost discreto (UX-DR25)

**And** em MVP (Story 5.5), este botão está desabilitado com label "Disponível em breve" e `aria-disabled="true"` (funcionalidade completa na Story 5.10)

**And** NÃO criar nenhuma infrastructure de `data_decisions` — isso é da Story 5.10

---

### AC #7 — Degradação offline

**Given** o staff abre o Painel offline

**When** a sheet tenta carregar a série de fadiga

**Then** se a fetch falha (sem rede), a sheet mostra o snapshot já em memória + mensagem discreta `"Série temporal indisponível offline"` em `text-muted-foreground text-xs`

**And** o botão de fechar ainda funciona

---

### AC #8 — Acessibilidade (NFR37, UX-DR42)

**Given** axe-core corre na sheet

**When** testado

**Then** zero violations

**Especificamente:**
- ✅ Focus trap dentro da sheet (já garantido pelo `<DrillDownSheet>` / `<Dialog>` shadcn)
- ✅ ESC fecha a sheet (já garantido pelo Dialog)
- ✅ Focus retorna ao `<PlayerRow>` após fechar (UX-DR6, NFR38)
- ✅ Gráfico tem `aria-label` e é `role="img"` ou `aria-hidden` com dados em tabela escondida
- ✅ ACWR e banda têm `aria-label` em texto corrido (não apenas cores)
- ✅ `<SemaforoBadge>` com `aria-label` descritivo (Story 1.8)
- ✅ Botão de fechar tem `aria-label="Fechar detalhe de {playerName}"`

---

### AC #9 — Keyboard navigation

**Given** o staff navega por teclado

**When** Tab nas rows do painel e Enter numa row

**Then** a sheet abre

**And** ESC fecha a sheet

**And** Tab dentro da sheet navega pelos elementos interativos (semáforo info, fechar)

---

### AC #10 — Cobertura de testes ≥80%

**Given** testes em:
- `sparta/src/__tests__/readiness/player-drill-down-sheet.test.tsx`
- Extensão de `sparta/src/__tests__/app/(staff)/prontidao.test.tsx`

**When** `npm run test --run` executa

**Then** cobertura inclui:
- ✅ Sheet abre com dados do snapshot (render com `data_sufficient=true`)
- ✅ ACWR + banda formatado corretamente (PT-PT vírgula)
- ✅ `data_sufficient=false` → zona cinzenta + tooltip
- ✅ Série temporal com respostas de fadiga → gráfico renderiza
- ✅ Sem respostas → EmptyState
- ✅ Attendance: X/Y calculado corretamente
- ✅ `getPlayerDrillDownData` chamado com `playerId` correto
- ✅ axe-core: zero violations

---

## Tasks / Subtasks

- [ ] **Task 1: Server Action `getPlayerDrillDownData()` em `readiness.ts`** (AC: #4, #5)
  - [ ] Adicionar função `getPlayerDrillDownData(playerId: string)` a `sparta/src/lib/actions/readiness.ts`
  - [ ] `requireStaffRole()` + `auditedRead()` com `action: 'readiness.drilldown'`
  - [ ] Fetch 28-day `fatigue_responses` para `playerId` + `club_id` dentro do callback `auditedRead()`
  - [ ] Fetch 28-day sessions do clube (count) para calcular denominador de presenças
  - [ ] Fetch sessions details (id, scheduled_at, type) para x-axis do gráfico
  - [ ] Return: `{ fatigueResponses, sessions, attendanceNumerator, attendanceDenominator }`
  - [ ] Verificar erros de DB com `if (error) return err(...)`

- [ ] **Task 2: Componente `PlayerDrillDownSheet`** (AC: #1, #2, #3, #4, #6, #7, #8)
  - [ ] Criar `sparta/src/components/domain/readiness/player-drill-down-sheet.tsx` (Client Component, `"use client"`)
  - [ ] Props: `snapshot: PlayerReadinessData | null; open: boolean; onClose: () => void`
  - [ ] Usar `<DrillDownSheet>` wrapper existente em `@/components/ui/drill-down-sheet`
  - [ ] `useEffect` quando `open && snapshot` → chamar `getPlayerDrillDownData(snapshot.player_id)`
  - [ ] Estado interno: `status: 'idle' | 'loading' | 'loaded' | 'error'` + `drillDownData`
  - [ ] Render header: nome, escalão, posição, ACWR + banda ou tooltip, SemaforoBadge
  - [ ] Render gráfico: recharts `<LineChart>` com 5 linhas (padrão de `FatigueChart.tsx`)
  - [ ] Render presenças: `"X/Y sessões"` calculado de `attendanceNumerator / attendanceDenominator`
  - [ ] Render nota live (AC #6): botão ghost desabilitado "Marcar decisão" com `aria-disabled`
  - [ ] Loading: skeleton durante fetch
  - [ ] Offline fallback: catch em fetch → mensagem discreta (AC #7)

- [ ] **Task 3: Atualizar `ReadinessPanelList`** (AC: #1)
  - [ ] Editar `sparta/src/components/domain/readiness/readiness-panel-list.tsx`
  - [ ] Substituir placeholder `<DrillDownSheet>` com `<PlayerDrillDownSheet snapshot={selectedPlayer} open={selectedPlayer !== null} onClose={() => setSelectedPlayer(null)} />`
  - [ ] Remover conteúdo placeholder "disponível na Story 5.5"

- [ ] **Task 4: Testes** (AC: #10)
  - [ ] Criar `sparta/src/__tests__/readiness/player-drill-down-sheet.test.tsx`
  - [ ] Mock `getPlayerDrillDownData` com vi.mock
  - [ ] Testar: render com snapshot data_sufficient=true
  - [ ] Testar: render com data_sufficient=false (TooltipExplain visível)
  - [ ] Testar: serie com responses → gráfico renderiza (mock recharts)
  - [ ] Testar: sem responses → EmptyState
  - [ ] Testar: attendance X/Y correto
  - [ ] Testar: axe-core zero violations
  - [ ] Testar: onClose chamado quando sheet fecha
  - [ ] Estender `prontidao.test.tsx`: verificar que click num PlayerRow abre sheet (selectedPlayer não null)

---

## Architecture / Technical Requirements

### CRÍTICO: Reutilizar, Não Reinventar

| O quê | Localização | Como usar |
|-------|-------------|-----------|
| `<DrillDownSheet>` wrapper | `@/components/ui/drill-down-sheet` | Importar e usar como wrapper — NÃO recriar |
| `<SemaforoBadge>` | `@/components/ui/semaforo-badge` (alias: `@/components/patterns/semaforo-badge`) | `state={state} size="lg"` |
| `<TooltipExplain>` | `@/components/ui/tooltip-explain` | Para ACWR insuficiente |
| `<EmptyState>` | `@/components/ui/empty-state` | Para sem respostas de fadiga |
| Recharts LineChart pattern | `@/components/domain/FatigueChart.tsx` | Copiar padrão `DIMENSIONS`, formatDate, CustomTooltip |
| `FatigueResponse`, `SessionInfo` types | `@/lib/actions/fatigue-staff` | Re-exportar ou importar tipos |
| `auditedRead()` | `@/lib/data/audited` | Dentro de qualquer leitura a health data |
| `requireStaffRole()` | Local function em `readiness.ts` (já existe, privada) | Chamar no início de `getPlayerDrillDownData` |
| `ACWR_THRESHOLDS`, `READINESS_STATE_PRIORITY` | `@/lib/readiness/thresholds` | Não redefinir |
| `PlayerReadinessData` | `@/types/supabase` | Prop type da sheet |

### Hierarquia de Componentes (final)

```
ReadinessPanelList (Client Component — existente)
  ├── [state: selectedPlayer: PlayerReadinessData | null]
  │
  └── <PlayerDrillDownSheet>  ← NEW
        ├── props: snapshot, open, onClose
        ├── <DrillDownSheet open onOpenChange>  ← EXISTENTE (wrapper Dialog)
        │     ├── Header: nome + escalão + posição
        │     ├── ACWR + banda (ou TooltipExplain se sem dados)
        │     ├── <SemaforoBadge state size="lg">
        │     ├── <LineChart>  (recharts — 5 linhas fadiga, 28 dias)
        │     ├── Presenças: "X/Y sessões"
        │     └── Nota decisão: botão ghost disabled (Story 5.10)
        └── [useEffect → getPlayerDrillDownData(playerId)]
```

### Data Flow

1. Staff tapa `<PlayerRow>` → `onSelectPlayer(snapshot)` → `setSelectedPlayer(snapshot)` em `ReadinessPanelList`
2. `<PlayerDrillDownSheet open={true} snapshot={snapshot}>` renderiza imediatamente com dados do snapshot (sem fetch)
3. `useEffect([snapshot?.player_id, open])` → chama `getPlayerDrillDownData(playerId)` (Server Action)
4. Server Action retorna `{ fatigueResponses, sessions, attendanceNumerator, attendanceDenominator }`
5. Gráfico recharts renderiza com dados

### Server Action `getPlayerDrillDownData` — estrutura

```typescript
// Em sparta/src/lib/actions/readiness.ts (adicionar ao ficheiro existente)
export interface DrillDownData {
  fatigueResponses: FatigueResponse[]; // de @/lib/actions/fatigue-staff
  sessions: Record<string, SessionInfo>; // de @/lib/actions/fatigue-staff
  attendanceNumerator: number;
  attendanceDenominator: number;
}

export async function getPlayerDrillDownData(
  playerId: string
): Promise<Result<DrillDownData, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!playerId?.trim()) {
    return err({ code: 'not_found', message: 'Recurso não encontrado' });
  }

  const { userId, clubId } = authResult.data;
  const supabase = await createServerClient();

  const now = new Date();
  const since28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // auditedRead() — OBRIGATÓRIO para health data (ESLint: no-direct-health-data-read)
  const fatigueResult = await auditedRead(
    {
      targetKind: 'readiness_snapshot',
      targetId: playerId,
      action: 'readiness.drilldown',
      actorId: userId,
      clubId,
    },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read
      supabase
        .from('fatigue_responses')
        .select('id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .gte('submitted_at', since28.toISOString())
        .order('submitted_at', { ascending: true })
  );

  if (fatigueResult.error) {
    return err({ code: 'db_error', message: 'Erro ao carregar dados de fadiga' });
  }

  const responses = (fatigueResult.data ?? []) as FatigueResponse[];

  // Fetch sessions for x-axis labels and attendance denominator
  const sessionIds = [...new Set(responses.map((r) => r.session_id))];
  const { data: sessionRows, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type, scheduled_at')
    .eq('club_id', clubId)
    .gte('scheduled_at', since28.toISOString())
    .lte('scheduled_at', now.toISOString());

  if (sessionsError) {
    return err({ code: 'db_error', message: 'Erro ao carregar sessões' });
  }

  const allSessions = sessionRows ?? [];
  const sessionsMap: Record<string, SessionInfo> = {};
  for (const s of allSessions) {
    sessionsMap[s.id] = { id: s.id, type: s.type, scheduled_at: s.scheduled_at };
  }

  const attendanceDenominator = allSessions.length;
  const attendanceNumerator = sessionIds.filter((sid) => sid in sessionsMap).length;

  return ok({
    fatigueResponses: responses,
    sessions: sessionsMap,
    attendanceNumerator,
    attendanceDenominator,
  });
}
```

### ACWR Banda — formatação PT-PT

```typescript
// Formatar número com vírgula (PT-PT), 2 casas decimais
function formatAcwr(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Display: "1,32 · banda 0,80–1,50"
const acwrDisplay = snapshot.acwr != null && snapshot.acwr_band_lo != null && snapshot.acwr_band_hi != null
  ? `${formatAcwr(snapshot.acwr)} · banda ${formatAcwr(snapshot.acwr_band_lo)}–${formatAcwr(snapshot.acwr_band_hi)}`
  : null;
```

### Recharts — padrão do projecto (Story 4.5 — `FatigueChart.tsx`)

```typescript
// Importar exatamente os mesmos componentes recharts usados em FatigueChart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';

// Reutilizar a mesma config DIMENSIONS (cor + label PT-PT)
const DIMENSIONS = [
  { key: 'dim_energy',   label: 'Energia',           color: '#3B82F6' },
  { key: 'dim_focus',    label: 'Concentração',       color: '#A855F7' },
  { key: 'dim_sleep',    label: 'Sono',               color: '#22C55E' },
  { key: 'dim_soreness', label: 'Dores',              color: '#EF4444' },
  { key: 'dim_mood',     label: 'Estado emocional',   color: '#EAB308' },
] as const;

// Formatar data igual a FatigueChart.tsx
function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd/MM', { locale: pt });
  } catch {
    return '—';
  }
}
```

> **ATENÇÃO recharts 3.8.1:** Esta versão tem mudanças de API face a 2.x. Ver padrão existente em `FatigueChart.tsx` para sintaxe correcta — não usar documentação antiga de recharts 2.x.

### Escalão — formatação PT-PT

```typescript
const AGE_GROUP_LABEL: Record<string, string> = {
  u14: 'Sub-14',
  u15: 'Sub-15',
  u17: 'Sub-17',
  u19: 'Sub-19',
  senior: 'Sénior',
};

const escalaoLabel = snapshot.derived_age_group
  ? (AGE_GROUP_LABEL[snapshot.derived_age_group] ?? snapshot.derived_age_group)
  : '—';
```

### ESLint constraint crítica

A rule `no-direct-health-data-read` está activa. Qualquer query directa a `fatigue_responses` **fora** de um callback `auditedRead()` vai falhar o lint. Ver padrão existente em `readiness.ts` e `fatigue-staff.ts`.

```typescript
// ✅ Correcto
const result = await auditedRead(
  { ... },
  async () =>
    // eslint-disable-next-line custom/no-direct-health-data-read
    supabase.from('fatigue_responses').select(...)
);

// ❌ ERRO DE LINT — jamais fazer directamente
const { data } = await supabase.from('fatigue_responses').select(...);
```

### noUncheckedIndexedAccess (NFR55)

```typescript
// ✅ Correcto — guard antes de usar índice
const firstResponse = responses[0];
if (firstResponse !== undefined) {
  // usar firstResponse
}

// ✅ Correcto — optional chaining + fallback
const val = arr[idx] ?? defaultValue;

// ❌ ERRO TypeScript
const val = arr[idx]; // may be undefined
```

### Tipos a importar

```typescript
// Em player-drill-down-sheet.tsx:
import type { PlayerReadinessData } from '@/types/supabase';
import type { FatigueResponse, SessionInfo } from '@/lib/actions/fatigue-staff';
import type { DrillDownData } from '@/lib/actions/readiness'; // novo tipo
```

---

## Dev Notes — Contexto de Story 5.4 (learnings)

### Patches críticos da 5.4 que impactam esta story

- **P-22 (DRY):** `READINESS_STATE_PRIORITY` agora exportado de `@/lib/readiness/thresholds` — importar de lá, não redefinir
- **P-12 (hydration):** `sessionStorage` só lido em `useEffect` — padrão que deve continuar nesta story
- **P-14 (acessibilidade):** `role="tooltip"` + `aria-describedby` em vez de `aria-hidden` nos indicadores
- **P-17 (jerseyNum 0):** `jerseyNum != null` (não `jerseyNum`) — suportar camisola 0
- **P-3 (erros DB):** Nunca silenciar erros das queries — verificar `error` sempre e fazer log

### Ficheiros criados/modificados na Story 5.4 relevantes para esta

- `sparta/src/lib/actions/readiness.ts` — adicionar `getPlayerDrillDownData()` aqui
- `sparta/src/components/domain/readiness/readiness-panel-list.tsx` — atualizar placeholder
- `sparta/src/components/domain/readiness/player-row.tsx` — NÃO modificar (funciona como está)
- `sparta/src/components/ui/drill-down-sheet.tsx` — NÃO modificar (wrapper funciona)
- `sparta/src/lib/readiness/thresholds.ts` — NÃO modificar

### Padrão `auditedRead` nesta codebase (Story 3.11)

```typescript
import { auditedRead } from '@/lib/data/audited';

const result = await auditedRead(
  {
    targetKind: 'readiness_snapshot', // ou 'fatigue_response'
    targetId: playerId,
    action: 'readiness.drilldown',    // ← AC #5 especifica este valor
    actorId: userId,
    clubId,
  },
  async () =>
    // eslint-disable-next-line custom/no-direct-health-data-read
    supabase.from('fatigue_responses').select(...)
);

if (result.error) {
  return err({ code: 'db_error', message: '...' });
}
const data = result.data ?? [];
```

### Padrão de componente com fetch ao abrir (sem Server Component)

Como a sheet é interactiva (Client Component), a fetch de dados acontece no cliente via Server Action:

```typescript
'use client';

export function PlayerDrillDownSheet({ snapshot, open, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [data, setData] = useState<DrillDownData | null>(null);

  useEffect(() => {
    if (!open || !snapshot) return;
    setStatus('loading');
    getPlayerDrillDownData(snapshot.player_id)
      .then((result) => {
        if (result.ok) {
          setData(result.data);
          setStatus('loaded');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [open, snapshot?.player_id]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setData(null);
    }
  }, [open]);
  // ...
}
```

---

## Testes — Padrão e Fixtures

### Setup de mocks obrigatório

```typescript
// Topo do ficheiro de teste
vi.mock('@/lib/actions/readiness', () => ({
  getPlayerDrillDownData: vi.fn(),
}));

// Mock recharts (não renderiza SVG real em jsdom)
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
```

### Fixture de snapshot (Player 1 — "Alerta")

```typescript
const fixtureSnapshot: PlayerReadinessData = {
  player_id: 'player-alert-1',
  session_id: 'session-1',
  club_id: 'club-1',
  state: 'alert',
  acwr: 1.82,
  acwr_band_lo: 0.8,
  acwr_band_hi: 1.5,
  recent_fatigue_avg: 3.8,
  attendance_rate: 0.857,
  data_sufficient: true,
  derived_age_group: 'senior',
  computed_at: new Date().toISOString(),
  playerName: 'João Silva',
  jerseyNum: 4,
  primaryPosition: 'DEF',
};
```

### Fixture de drill-down data

```typescript
import { vi } from 'vitest';
import { getPlayerDrillDownData } from '@/lib/actions/readiness';

const mockDrillDownData = {
  fatigueResponses: [
    {
      id: 'fr-1', player_id: 'player-alert-1', session_id: 'session-1',
      phase: 'post', dim_energy: 2, dim_focus: 3, dim_sleep: 2,
      dim_soreness: 4, dim_mood: 3, srpe_value: 7,
      submitted_at: '2026-05-20T10:00:00Z', submitted_via: 'online',
    },
  ],
  sessions: {
    'session-1': { id: 'session-1', type: 'treino', scheduled_at: '2026-05-20T09:00:00Z' },
  },
  attendanceNumerator: 12,
  attendanceDenominator: 14,
};

// Setup em beforeEach
vi.mocked(getPlayerDrillDownData).mockResolvedValue({ ok: true, data: mockDrillDownData });
```

### Verificações de teste obrigatórias

```typescript
// AC #1 — sheet abre com dados do snapshot
expect(screen.getByText('João Silva')).toBeInTheDocument();
expect(screen.getByText('Sénior')).toBeInTheDocument();

// AC #2 — ACWR formatado PT-PT
expect(screen.getByText(/1,82/)).toBeInTheDocument();
expect(screen.getByText(/banda 0,80/)).toBeInTheDocument();

// AC #3 — gráfico presente
expect(screen.getByTestId('line-chart')).toBeInTheDocument();

// AC #4 — presenças
expect(screen.getByText(/12\/14/)).toBeInTheDocument();

// AC #8 — axe
const results = await axe(container);
expect(results).toHaveNoViolations();
```

---

## Referências

- [Epics.md — Story 5.5](../_bmad-output/planning-artifacts/epics.md#L2482) — ACs completos
- [Epics.md — Story 5.10](../_bmad-output/planning-artifacts/epics.md#L2662) — `data_decisions` (não implementar aqui)
- [UX Design Spec — UX-DR6](../_bmad-output/planning-artifacts/ux-design-specification.md) — DrillDownSheet padrão
- [UX Design Spec — UX-DR25](../_bmad-output/planning-artifacts/ux-design-specification.md) — DataDrivenDecisionInput
- [Architecture.md — FR35, FR52](../_bmad-output/planning-artifacts/architecture.md)
- [Story 5.4](./5-4-painel-de-prontidao-lista-por-posicao-default-view.md) — componentes existentes, patches
- [Story 3.11](./3-11-health-data-access-audit-logging-auto-wrapper-for-staff-reads.md) — auditedRead()
- [Story 4.5](./4-5-staff-read-individual-responses-4-week-trends.md) — FatigueChart.tsx padrão recharts
- [FatigueChart.tsx](../sparta/src/components/domain/FatigueChart.tsx) — padrão recharts completo (LEIA ANTES DE IMPLEMENTAR)
- [fatigue-staff.ts](../sparta/src/lib/actions/fatigue-staff.ts) — tipos FatigueResponse, SessionInfo
- [readiness.ts](../sparta/src/lib/actions/readiness.ts) — adicionar getPlayerDrillDownData() aqui
- [readiness-panel-list.tsx](../sparta/src/components/domain/readiness/readiness-panel-list.tsx) — atualizar placeholder
- [drill-down-sheet.tsx](../sparta/src/components/ui/drill-down-sheet.tsx) — REUTILIZAR, não recriar
- [thresholds.ts](../sparta/src/lib/readiness/thresholds.ts) — ACWR_THRESHOLDS, READINESS_STATE_PRIORITY
- [AGENTS.md](../sparta/AGENTS.md) — aliases @/*, React 19, noUncheckedIndexedAccess, testes

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Status

**Ready-for-dev** — Ficheiro criado com contexto exaustivo para implementação.

### Notas Chave para o Developer

1. **NÃO recriar** `<DrillDownSheet>` — existe em `@/components/ui/drill-down-sheet`. Usá-lo como wrapper.
2. **Dados do snapshot são imediatos** — `PlayerReadinessData` já vem do Painel. Só a série de fadiga precisa de fetch.
3. **auditedRead() obrigatório** — ESLint bloqueia queries directas a health data. Ver padrão em `readiness.ts`.
4. **Recharts 3.8.1** — ver padrão em `FatigueChart.tsx` (Story 4.5). Não usar documentação antiga de 2.x.
5. **ACWR com vírgula PT-PT** — usar `toLocaleString('pt-PT', ...)` ou `Intl.NumberFormat`.
6. **Story 5.10 (data_decisions)** — o botão de nota fica disabled. NÃO criar infra de `data_decisions` aqui.
7. **noUncheckedIndexedAccess** — guardar todos os acessos a arrays com `?.` + `?? fallback`.
8. **Testes no `sparta/`** — correr `npm run test --run` a partir do directório `sparta/`.

### Próximas Stories após 5.5

- **Story 5.6:** Formation view toggle (SVG campo 4-3-3)
- **Story 5.7:** Realtime updates na janela 4h pré-sessão (Supabase Realtime)
- **Story 5.10:** DataDrivenDecisionInput completo com `data_decisions` table

---

## Change Log

### 2026-05-27 (Story Created)
- ✅ Análise exaustiva de Story 5.4 (learnings + patches aplicados)
- ✅ Componentes existentes identificados (`DrillDownSheet`, `FatigueChart.tsx`, `auditedRead`)
- ✅ Server Action `getPlayerDrillDownData` desenhado com audit correcto
- ✅ Padrão recharts documentado (Story 4.5)
- ✅ Acessibilidade especificada (focus trap, ESC, restore focus)
- ✅ Fixtures de teste documentadas
- ✅ Scope Story 5.10 claramente delimitado (botão disabled em MVP)
