# Session Fixes & Technical Decisions Log — 2026-05-29

**Tipo:** Registo de correcções e decisões técnicas
**Sessão:** Retrospectiva + bug fixing — Epics 2, 4, 5
**Autor:** Antero

> Este documento regista as correcções e decisões tomadas numa sessão de retrospectiva ao projecto SPARTA. Complementa os artefactos de story individuais com contexto transversal — padrões estabelecidos, anti-padrões descobertos, e decisões que afectam todo o codebase.
>
> Para as ADRs formais, ver `_bmad-output/planning-artifacts/architecture.md` (secção "Architectural Decision Records").

---

## Correcções Aplicadas

### FIX-01 — Position Grouping: Schema abbreviations em `getPositionKey()`

**Ficheiro:** `sparta/src/components/domain/readiness/readiness-panel-list.tsx`

**Sintoma:** Todos os jogadores apareciam no grupo "Médio" no Painel de Prontidão, independentemente da posição.

**Causa raiz:** `getPositionKey()` usava apenas matching por texto em português (ex: "defesa", "médio"). A tabela `positions` no DB armazena abreviaturas (`GR`, `DD`, `DC`, `DE`, `LIB`, `MDC`, `MC`, `MO`, `MD`, `ME`, `EXD`, `EXE`, `SC`, `PL`). Nenhuma abreviatura correspondia a texto em português → fallback `"MED"` para todos.

**Fix:** Bloco de exact-match para as 14 abreviaturas adicionado antes do matching por texto. Testes: 18 novos casos para cada abreviatura.

**Artefacto relacionado:** `5-4-painel-de-prontidao-lista-por-posicao-default-view.md`

---

### FIX-02 — Build failure: "use server" não pode exportar objectos não-async

**Ficheiros:** `sparta/src/lib/actions/telemetry.ts`, `sparta/src/lib/schemas/telemetry.ts` (novo)

**Sintoma:** Build falha com erro sobre exports não-async em ficheiro "use server".

**Causa raiz:** `TelemetryPayloadSchema` (objecto Zod) era exportado de `telemetry.ts` que tem `"use server"` no topo. O Next.js rejeita qualquer export não-async de ficheiros "use server".

**Fix:** Schema extraído para `lib/schemas/telemetry.ts` (sem directiva). `telemetry.ts` importa de lá.

**Regra estabelecida:** Ver AGENTS.md — secção "Ficheiros use server — apenas funções async".

---

### FIX-03 — CI failures: 10 testes a falhar

**Causa:** Três problemas independentes:

1. `DataDrivenDecisionInput` — botão "expand" estava `disabled={isPending}` durante `useTransition` inicial → testes de click falhavam
2. `KpisValidacaoPage` — era client component com `useEffect`; testes esperavam async server component pattern. Convertida para `async function` que importa directamente de `decisions-server.ts`
3. `DataDecision` type — importado de `@/lib/actions/decisions` (re-export que causava problemas); corrigido para `@/lib/types/decisions`

**Nota:** O fix de `KpisValidacaoPage` também resolveu um segundo problema de build — importar `getDecisionKpiData` através de `decisions.ts` (que re-exporta de um ficheiro "use server") propagava o erro de "use server" para a página. A importação directa de `decisions-server.ts` resolve ambos.

---

### FIX-04 — Drill-down: "Sem dados de fadiga" apesar de dados existirem no DB

**Ficheiro:** `sparta/src/lib/actions/readiness.ts` (`getPlayerDrillDownData`)

**Sintoma:** Drill-down de jogador mostrava "Sem dados de fadiga" mesmo com 8 rows válidas em `fatigue_responses`.

**Causa raiz:** Server Action chamada de `useEffect` no client. O JWT do utilizador não propaga corretamente através da RLS policy `EXISTS (SELECT FROM profiles WHERE id = auth.uid()...)` neste contexto assíncrono. A query retorna array vazio silenciosamente.

**Fix:** Switch para `getServiceRoleClient()` com `requireStaffRole()` como guard application-level. Filtros explícitos `club_id` + `player_id`.

**ADR:** ADR-001 em `architecture.md`

---

### FIX-05 — "Erro ao guardar decisão" em data-driven decisions

**Ficheiros:** `sparta/src/lib/actions/decisions-server.ts`, `sparta/supabase/migrations/000260_data_decisions.sql`

**Sintoma:** Guardar uma decisão data-driven retornava erro genérico.

**Causas:**

1. Migration `000260` estava em `SPARTA/supabase/migrations/` (root) em vez de `SPARTA/sparta/supabase/migrations/` → tabela `data_decisions` nunca foi criada na instância Supabase
2. Migration usava `uuid_generate_v7()` (não existe) em vez de `uuidv7()`
3. RLS policies usavam `auth.club_id()` e JWT claims (não disponíveis em CI local)
4. Server Actions usavam `createServerClient()` → mesmo problema de JWT que FIX-04

**Fix:** Migration movida + corrigida. Todos os Server Actions de `data_decisions` switchados para service role.

**ADRs:** ADR-001, ADR-002 em `architecture.md`

---

### FIX-06 — Readiness: estado `neutral` para todos mesmo com questionários submetidos

**Ficheiros:** `sparta/src/lib/readiness/snapshot.ts`, `sparta/src/components/domain/readiness/readiness-panel.tsx`, `sparta/src/app/(staff)/prontidao/page.tsx`

**Sintoma:** Todos os jogadores mostravam estado `neutral` (círculo tracejado) mesmo com questionários submetidos.

**Causas:**

1. **Threshold demasiado elevado:** `dataSufficient` requeria ≥4 semanas ISO de `session_metrics`. Novo clube = sempre `neutral` no primeiro mês.
2. **Refresh não recalculava:** Botão ↻ chamava apenas `getReadinessPanelData()` (lê snapshots existentes). `refreshUpcomingReadiness()` (recalcula snapshots) nunca era chamado da UI.

**Fix 1 — Threshold:** `ClassifyReadinessInput` redesenhado com dois campos independentes:
- `fatigueResponseCount >= 2` → activa semáforo
- `acwrSufficient` (4 semanas) → activa sinais ACWR

**Fix 2 — Refresh:** `refreshUpcomingReadiness(sessionId)` adicionado a:
- Page server load (`prontidao/page.tsx`)
- `handleManualRefresh` no botão ↻ (`readiness-panel.tsx`)

**ADRs:** ADR-003, ADR-004 em `architecture.md`

---

### FIX-07 — Nova Leitura: campos vazios ao abrir modal

**Ficheiro:** `sparta/src/components/ui/add-metric-sheet.tsx`, `sparta/src/app/(staff)/plantel/[id]/page.tsx`

**Sintoma:** Modal "Nova leitura" abria com campos Peso e Altura vazios, obrigando o utilizador a re-introduzir o último valor conhecidos.

**Fix:** Página extrai `lastWeight` e `lastHeight` de `metrics` (pesquisa independente por campo, do mais recente para o mais antigo). Passa-os ao `AddMetricSheet` como props. Form usa-os como `defaultValues`. Reset pós-save usa os valores acabados de submeter.

**Artefacto relacionado:** `2-3-player-metrics-time-series-weight-height.md`

---

## Padrões Estabelecidos

Resumo rápido — detalhes completos em `sparta/AGENTS.md` e ADRs em `architecture.md`.

| Padrão | Regra | Onde ver |
|---|---|---|
| Service role + requireStaffRole() | Server Actions de client components usam service role após verificação application-level | ADR-001, AGENTS.md |
| "use server" exports | Só funções async. Schemas/tipos → `lib/schemas/` ou `lib/types/` | AGENTS.md |
| RLS policies CI | Sempre EXISTS/profiles. Nunca `auth.club_id()` ou JWT claims | ADR-002, AGENTS.md |
| Migration path | `sparta/supabase/migrations/` sempre. UUID: `uuidv7()` | AGENTS.md |
| Snapshot refresh | Chamar `refreshUpcomingReadiness()` antes de ler dados | ADR-004, AGENTS.md |

---

## Ficheiros Modificados nesta Sessão

| Ficheiro | Tipo | Fix |
|---|---|---|
| `src/components/domain/readiness/readiness-panel-list.tsx` | Fix | Schema abbreviations em getPositionKey |
| `src/components/domain/readiness/player-row.tsx` | Fix | Tooltip actualizado |
| `src/components/domain/readiness/readiness-panel.tsx` | Fix | Refresh chama refreshUpcomingReadiness |
| `src/lib/readiness/snapshot.ts` | Fix | ClassifyReadinessInput redesenhado |
| `src/lib/actions/readiness.ts` | Fix | Service role para drilldown fatigue |
| `src/lib/actions/decisions-server.ts` | Fix | Service role + club_id filter |
| `src/lib/schemas/telemetry.ts` | Novo | Schema extraído de "use server" |
| `src/lib/actions/telemetry.ts` | Fix | Importa schema de lib/schemas/ |
| `src/app/(staff)/prontidao/page.tsx` | Fix | refreshUpcomingReadiness no load |
| `src/app/(staff)/configuracoes/kpis-validacao/page.tsx` | Fix | Async server component |
| `src/app/(staff)/configuracoes/kpis-validacao/kpis-content.tsx` | Fix | Props em vez de useEffect |
| `src/app/(staff)/plantel/[id]/page.tsx` | Feat | Passa lastWeight/lastHeight |
| `src/components/ui/add-metric-sheet.tsx` | Feat | Pre-fill com últimos valores |
| `src/__tests__/app/(staff)/prontidao.test.tsx` | Testes | 18 novos testes de abreviaturas |
| `src/__tests__/lib/readiness/snapshot.test.ts` | Testes | 24 testes actualizados |
| `supabase/migrations/000260_data_decisions.sql` | Fix | Path + uuidv7 + RLS policies |
