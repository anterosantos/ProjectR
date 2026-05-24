# Story 4.6: "Dados Mediados" Block — Player Has No Self-Access to Processed Data

**Status:** done

**Story ID:** 4.6  
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)  
**Criado:** 2026-05-24  
**Story anterior:** 4-5-staff-read-individual-responses-4-week-trends

---

## Story

As the system,
I want to enforce that a Jogador has no UI path or API path to their Painel de Prontidão, Recovery Curve, or generated reports,
So that the deliberate product principle (mediated data — staff conveys, not the system directly) is technically guaranteed.

---

## Acceptance Criteria

**AC #1 — Middleware blocks staff-only routes with 404**

**Given** a player is authenticated and attempts to navigate to a staff-only route:
- `/prontidao` (readiness dashboard — planned for Epic 5)
- `/tendencias` (trends dashboard — planned for Epic 5)
- `/relatorios/[id]` (report view — planned for Growth)
- `/plantel` (staff player roster — planning view)
- `/plantel/[id]` (staff player profile)
- `/plantel/[id]/fadiga` (staff fatigue trends from Story 4-5)

**When** the middleware evaluates the request

**Then** the middleware returns HTTP 404 (not 403, to avoid hinting resource existence) (FR26)

**And** no clue is given to the player that the route exists but is forbidden

**And** staff (role='coach'|'analyst') continue to access these routes normally

**AC #2 — API/Server Actions block player reads with authorization error**

**Given** any Server Action or Edge Function that returns processed data:
- `readiness_snapshots` rows for the player's own `player_id`
- Time-series aggregates (ACWR, sRPE, trends) scoped to the player's own data
- PDF reports or CSV exports of processed metrics
- Recovery curve data

**When** called by an authenticated player (not staff)

**Then** the action returns error response: `{ error: "Não autorizado" }` without any status code that reveals whether the data exists (FR26)

**And** the error message is generic and does NOT differentiate between "you don't have permission" and "this data doesn't exist"

**And** no audit log is created (since the request is rejected before reading)

**AC #3 — Player's `/historico` shows only raw answers, no derivation**

**Given** the player views their own `/hoje` (today) or historical tab at `/historico`

**When** fatigue responses are displayed

**Then** only the **raw submitted answers** are shown:
- Date of submission
- Phase (pré-sessão / pós-sessão)
- Raw dimension values (1–5 per dimension: energia, concentração, sono, dor, humor)
- Optional sRPE value (1–10) if post-session

**And** NO derived or processed metrics are visible:
- ❌ No ACWR calculation or readiness state
- ❌ No trend visualization or 4-week aggregates
- ❌ No comparison to thresholds or age-group bands
- ❌ No recovery curve
- ❌ No sRPE load computation or fatigue indices

**And** accompanying copy reads: "As tuas respostas. O treinador é quem interpreta como conjunto." (UX-DR38, FR26)

**AC #4 — Test contract: no metric leakage in player responses**

**Given** integration tests run for player-scoped data access

**When** a test calls any read path or API with player authentication for their own data

**Then** the response payload is scanned for these patterns and MUST NOT contain:
- `readiness_snapshots` table data or derived state ('ready', 'caution', 'alert', 'neutral')
- `acwr` field or any ACWR-derived metric
- `acwr_band`, `acwr_band_lo`, `acwr_band_hi` (confidence band data)
- `recent_fatigue_avg` or `attendance_rate` (aggregate metrics)
- `session_metrics.srpe_load` (computed load, not raw srpe_value)
- `recovery_curve` or `recovery_trajectory` or any time-derivative
- `data_sufficient` or `dataSufficient` (confidence signal)

**And** the assertion logs the response structure if any leak is detected, with context for debugging

**AC #5 — Backward compatibility: existing player routes continue to work**

**Given** routes that SHOULD remain accessible to players:
- `/hoje` (today's view)
- `/historico` (raw response history — per AC #3)
- `/questionario/[sessionId]/[phase]` (fatigue submission — Story 4-2)
- `/configuracoes` (settings, profile, push notifications)

**When** a player navigates to these routes

**Then** access is not blocked and functionality is unaffected

**And** no middleware rule inadvertently breaks these routes

**AC #6 — Error handling: graceful fallback for staff routes accessed via direct URL**

**Given** a player has a bookmarked or cached URL to `/plantel/[id]/fadiga`

**When** they click it or navigate directly

**Then** the 404 response is rendered as a user-friendly error page (Next.js default 404 or custom)

**And** no server-side exception or 500 error occurs

**And** no sensitive context (player ID, club ID, route path) is leaked in the error message

---

## Technical Requirements

### Middleware Implementation

**File:** `src/middleware.ts` (or extend from `src/lib/supabase/middleware.ts`)

**Pattern:**
```typescript
// Pseudo-code outline (actual implementation depends on existing middleware structure)

export async function middleware(request: NextRequest) {
  const session = getSession(request); // Supabase session
  const userRole = session?.user?.user_metadata?.user_role;

  // Extract pathname
  const pathname = request.nextUrl.pathname;

  // Staff-only route blocklist
  const staffOnlyRoutes = [
    /^\/prontidao(\/|$)/,           // readiness dashboard
    /^\/tendencias(\/|$)/,          // trends
    /^\/relatorios(\/|$)/,          // reports
    /^\/plantel(\/|$)/,             // staff player roster
  ];

  // Check if player (non-staff) accesses staff-only route
  if (userRole !== 'coach' && userRole !== 'analyst') {
    if (staffOnlyRoutes.some(pattern => pattern.test(pathname))) {
      // Return 404, not 403
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // Continue with existing middleware logic (session refresh, etc.)
  return next(request);
}

export const config = {
  matcher: [
    // Existing patterns...
    '/prontidao/:path*',
    '/tendencias/:path*',
    '/relatorios/:path*',
    '/plantel/:path*',
  ],
};
```

**Key Decision:** Return 404 status code (not 403) to avoid revealing resource existence. Next.js will render the default 404 page.

### Server Action Authorization

**Pattern:** All Server Actions that return processed data must validate `auth.user_role()`

**Template for data reads:**
```typescript
// src/lib/actions/readiness.ts (placeholder for future Epic 5)

"use server";

import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/errors";

export async function getPlayerReadinessSnapshot(playerId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const userRole = session?.user?.user_metadata?.user_role;

  // Reject if player tries to read their own processed data
  if (userRole === 'player' || !userRole) {
    throw new AuthorizationError('Não autorizado');
  }

  // Only staff can proceed (club_id enforcement via RLS)
  const result = await supabase
    .from('readiness_snapshots')
    .select('*')
    .eq('player_id', playerId)
    .single();

  return result.data;
}
```

**RLS Enforcement (SQL):**
- Table `readiness_snapshots` should have RLS policy:
  ```sql
  CREATE POLICY "staff read only" ON readiness_snapshots
  FOR SELECT
  USING (
    auth.user_role() IN ('coach', 'analyst')
    AND club_id = auth.club_id()
  );
  
  -- Player cannot read (no policy for role='player')
  ```

### Player `/historico` Route (Raw Answers Only)

**File:** `src/app/(player)/historico/page.tsx`

**Component Requirements:**
1. Query `fatigue_responses` for current player (filtered via RLS)
2. Display in **chronological order** (newest first)
3. Show only these columns:
   - **Data:** `submitted_at` formatted as "7 Maio, 14:30"
   - **Fase:** "Pré-sessão" or "Pós-sessão"
   - **Respostas:** Raw 1–5 values per dimension (no aggregation, no visual encoding beyond labels)
   - **sRPE (pós):** 1–10 value if post-session, otherwise empty
4. **Introductory copy:** "As tuas respostas. O treinador é quem interpreta como conjunto." (UX-DR38)
5. **No derivation:** NO trend visualization, NO ACWR, NO recovery curve, NO color-coded readiness state

**Accessibility:**
- Table has `role="table"`, headers `scope="col"`, cells labeled correctly
- Zero axe-core violations

### Test Contract (Integration Test)

**File:** `__tests__/integration/dados-mediados-block.test.ts`

**Test Structure:**

```typescript
describe("Dados Mediados Block — Player Cannot Access Processed Data", () => {
  describe("Middleware blocks staff routes", () => {
    test("GET /prontidao returns 404 for player", async () => {
      // Setup: authenticated as player
      // Fetch: GET /prontidao
      // Assert: status === 404
    });

    test("GET /plantel returns 404 for player", async () => {
      // Setup: authenticated as player
      // Fetch: GET /plantel
      // Assert: status === 404
    });

    test("GET /plantel/[id]/fadiga returns 404 for player", async () => {
      // Setup: authenticated as player
      // Fetch: GET /plantel/<someid>/fadiga
      // Assert: status === 404
    });

    test("staff can still access /plantel/[id]/fadiga", async () => {
      // Setup: authenticated as coach/analyst
      // Fetch: GET /plantel/<player_id>/fadiga
      // Assert: status === 200
      // Assert: response contains fatigue data
    });
  });

  describe("Server Actions reject player reads", () => {
    test("getPlayerReadinessSnapshot throws for player role", async () => {
      // Setup: player auth context
      // Call: getPlayerReadinessSnapshot(somePlayerId)
      // Assert: throws AuthorizationError with message "Não autorizado"
    });

    test("getPlayerReadinessSnapshot works for coach", async () => {
      // Setup: coach auth context
      // Call: getPlayerReadinessSnapshot(somePlayerId)
      // Assert: returns data (or null if no snapshots exist, but no error)
    });
  });

  describe("Player /historico shows raw answers only", () => {
    test("/historico renders fatigue_responses without metric leakage", async () => {
      // Setup: create test fatigue response for player
      // Setup: create corresponding readiness_snapshot (staff can see, not player)
      // Fetch: GET /historico as player
      // Assert: response contains raw dim_energy, dim_focus, etc. (1–5 values)
      // Assert: response does NOT contain readiness_snapshots data
      // Assert: response does NOT contain acwr, acwr_band, recovery_curve, etc.
      // Parse JSON payload
      // Assert via schema validation that no forbidden keys exist
    });

    test("/historico copy includes mediated-data disclaimer", async () => {
      // Fetch: GET /historico as player
      // Assert: response body includes "As tuas respostas. O treinador é quem interpreta"
    });
  });

  describe("No metric leakage in player-scoped API", () => {
    test("Player cannot query readiness_snapshots via RLS", async () => {
      // Setup: authenticated as player
      // Setup: supabase client with player session
      // Query: select from readiness_snapshots where player_id = $1
      // Assert: returns empty result (RLS blocks it)
    });

    test("Payload schema validation: no ACWR/readiness fields in /historico", async () => {
      // Define schema with exclusions:
      //   - No 'acwr', 'acwr_band_lo', 'acwr_band_hi'
      //   - No 'recent_fatigue_avg', 'attendance_rate'
      //   - No 'data_sufficient'
      //   - No 'recovery_trajectory', 'recovery_curve'
      //   - No 'session_metrics.srpe_load' (allow raw srpe_value only)
      // Fetch: /historico as player
      // Parse JSON
      // Assert: schema validation passes (forbidden keys not present)
    });
  });

  describe("Backward compatibility: player routes remain accessible", () => {
    test("GET /hoje is accessible to player", async () => {
      // Fetch: GET /hoje as player
      // Assert: status === 200
    });

    test("GET /questionario/[sessionId]/pré is accessible to player", async () => {
      // Fetch: GET /questionario/<sessionId>/pre as player
      // Assert: status === 200
    });

    test("GET /configuracoes is accessible to player", async () => {
      // Fetch: GET /configuracoes as player
      // Assert: status === 200
    });
  });

  describe("Error handling: 404 graceful for cached links", () => {
    test("Invalid /plantel/[id] doesn't cause 500", async () => {
      // Fetch: GET /plantel/invalid-uuid as player
      // Assert: status === 404 (or 400 for invalid UUID)
      // Assert: no 500 error
    });

    test("404 page renders without sensitive context leaks", async () => {
      // Fetch: GET /prontidao as player
      // Assert: response contains friendly 404 message
      // Assert: response does NOT leak player_id, club_id, or route specifics
    });
  });
});
```

**Key Assertion Pattern:**
```typescript
// Helper to scan payload for forbidden keys
function assertNoMetricLeakage(payload: any) {
  const forbiddenPatterns = [
    /acwr/i,
    /readiness/i,
    /recovery/i,
    /fatigue_avg/i,
    /attendance_rate/i,
    /srpe_load/i, // Allow srpe_value, block srpe_load
  ];

  const json = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const flatKeys = Object.keys(json).join(',');

  forbiddenPatterns.forEach(pattern => {
    expect(flatKeys).not.toMatch(pattern);
  });
}

// Usage in test
const response = await fetch('/historico', { headers: authHeaders });
const body = await response.json();
assertNoMetricLeakage(body);
```

---

## Previous Story Intelligence

**Story 4-5** (`4-5-staff-read-individual-responses-4-week-trends.md`) implemented the **inverse** of this story:

- ✅ Created `/plantel/[id]/fadiga` route (staff-only)
- ✅ Built `<FatigueChart>` and `<FatigueTable>` components for staff to view player trends
- ✅ Used `auditedRead()` to automatically log staff access (FR50)
- ✅ Implemented 4-week trend visualization with recharts

**Learning for 4-6:**
- The `/plantel/[id]/fadiga` route MUST be blocked from players (middleware 404)
- The `auditedRead()` pattern should NOT be used by players (only staff calls it)
- Any Server Action that returns readiness or derived metrics MUST check `auth.user_role()`

---

## Git Intelligence

**Recent commits (context):**
- `bf0b8a2` feat(4-3): fatigue questionnaire i18n for sub-14 players — code-review complete
- `5c53a14` feat(4-2): fatigue-questionnaire-ui-5-sliders-with-snap-single-view
- `f1c10c6` feat(4-1): fatigue response schema + idempotent server action

**Pattern established:**
- Migrations use `000200_*` series for Epic 4 tables
- Server Actions live in `src/lib/actions/fatigue.ts`
- Components use `"use client"` for interactivity
- Tests use Vitest + fake-indexeddb for offline flows

---

## Latest Tech Information

**Relevant Updates:**

1. **Next.js 16 Middleware:** Middleware in Next.js 16 runs on the edge for all matched routes. Using pathname patterns is more efficient than conditional logic in individual route handlers.

2. **TypeScript `noUncheckedIndexedAccess`:** All property access on auth objects must be guarded. Use optional chaining: `session?.user?.user_metadata?.user_role ?? 'guest'`

3. **Supabase RLS Best Practice:** RLS policies should be restrictive by default (deny all, allow explicit). A table with NO policy for a role effectively denies that role.

4. **HTTP 404 vs 403:** Per OWASP (https://owasp.org/www-community/attacks/Information_Disclosure), returning 404 instead of 403 for non-existent or unauthorized resources prevents enumeration attacks. Best practice for protecting resource existence.

5. **Zod Parsing in Server Actions:** Always parse and validate input with Zod before making database queries, even in Server Actions, to catch type errors early.

---

## Developer Checklist

**Before Implementation:**

- [ ] Understand the "dados mediados" philosophy: players submit data, staff interprets (not system)
- [ ] Review Story 4-5 for context on staff-side `/plantel/[id]/fadiga` route
- [ ] Review existing middleware structure in `src/lib/supabase/middleware.ts`
- [ ] Check that `/historico` route exists for players (read-only raw answers view)

**Implementation Phases:**

1. **Phase 1: Middleware Setup** (AC #1)
   - Update middleware to block `/prontidao`, `/tendencias`, `/relatorios`, `/plantel` routes
   - Return HTTP 404 for player role
   - Allow staff (coach, analyst) access
   - Test: player gets 404, staff gets through

2. **Phase 2: Server Action Authorization** (AC #2)
   - Add role check to any Server Actions returning processed data
   - Return generic "Não autorizado" error
   - Pattern: check `auth.user_role()` at top of action
   - Test: player auth throws error, staff auth succeeds

3. **Phase 3: Player `/historico` Refinement** (AC #3)
   - Verify `/historico` shows only raw `fatigue_responses` fields
   - Add introductory copy: "As tuas respostas. O treinador é quem interpreta como conjunto."
   - Confirm NO derived metrics visible
   - Test: axe-core passes, no a11y violations

4. **Phase 4: Integration Test Suite** (AC #4, AC #6)
   - Write comprehensive tests for all middleware blocks
   - Create payload schema validation to detect metric leakage
   - Test error handling (404, no 500)
   - Verify backward compatibility (AC #5)

**Build & Lint:**
```bash
npm run build
npm run lint
npm run test --run
```

**QA Checklist:**
- [ ] Player cannot navigate to any `/plantel/*` route (404)
- [ ] Player cannot call API for ACWR, readiness state, recovery curve
- [ ] Player `/historico` shows only raw 1–5 values, no trends
- [ ] Copy "As tuas respostas..." is visible on `/historico`
- [ ] Staff `/plantel/[id]/fadiga` still works (chart, table, filters)
- [ ] No 500 errors on edge cases (invalid UUID, missing player)
- [ ] Lighthouse ≥85 Performance, ≥90 Accessibility
- [ ] All 8 ACs verified ✅

---

## AC Verification Template

| AC | Verified | Notes |
|----|----------|-------|
| AC #1 | ❌ Pending | Middleware 404 for /prontidao, /plantel, etc. |
| AC #2 | ❌ Pending | Server Action "Não autorizado" error |
| AC #3 | ❌ Pending | /historico shows raw answers, mediated copy |
| AC #4 | ❌ Pending | Integration test suite, no metric leakage |
| AC #5 | ❌ Pending | /hoje, /questionario, /configuracoes still accessible |
| AC #6 | ❌ Pending | 404 graceful, no 500, no PII leaks |

---

## Tasks/Subtasks

- [x] **Task 1 — Middleware: bloqueio 404 para rotas staff-only** (AC #1, AC #6)
  - [x] 1.1 Adicionar `STAFF_ONLY_ROUTES_404` (prontidao, tendencias, relatorios, plantel) ao proxy.ts
  - [x] 1.2 Para role=player acedendo a rota staff-only, devolver `NextResponse` com status 404
  - [x] 1.3 Adicionar `/questionario` a `ROLE_ALLOWED_ROUTES.player` (fix bug latente — AC #5)
  - [x] 1.4 Atualizar testes existentes em middleware.test.ts para refletir novo comportamento (404 em vez de 307)
  - [x] 1.5 Adicionar novos testes: player → 404, coach → acesso normal, player → /questionario OK

- [x] **Task 2 — Server Action Authorization** (AC #2)
  - [x] 2.1 Criar `src/lib/actions/readiness.ts` com `getPlayerReadinessSnapshot` com role check
  - [x] 2.2 Player recebe `{ error: "Não autorizado" }` sem revelar existência de dados
  - [x] 2.3 Staff (coach/analyst) consegue chamar a ação normalmente
  - [x] 2.4 Escrever testes unitários para o Server Action (player rejeitado, staff aceite)

- [x] **Task 3 — Player /historico: respostas raw com copy mediado** (AC #3)
  - [x] 3.1 Implementar `src/app/(player)/historico/page.tsx` com query `fatigue_responses` para o player atual
  - [x] 3.2 Mostrar apenas campos raw: data, fase, dim_energy/focus/sleep/soreness/mood (1-5), srpe_value se pós-sessão
  - [x] 3.3 Adicionar copy "As tuas respostas. O treinador é quem interpreta como conjunto." (UX-DR38)
  - [x] 3.4 Garantir zero métricas derivadas (sem ACWR, sem readiness state, sem tendências)
  - [x] 3.5 Acessibilidade: tabela com role="table", headers scope="col", zero vitest-axe violations
  - [x] 3.6 Escrever testes: render correto, copy presente, sem metric leakage no payload

- [x] **Task 4 — Testes de integração e backward compat** (AC #4, AC #5, AC #6)
  - [x] 4.1 Criar `src/__tests__/dados-mediados-block.test.ts` com suite completa
  - [x] 4.2 Testes: middleware bloqueia /prontidao, /plantel, /plantel/id/fadiga com 404 para player
  - [x] 4.3 Testes: Server Action rejeita player, aceita coach
  - [x] 4.4 Testes: /historico não contém campos forbidden (acwr, readiness, recovery, srpe_load)
  - [x] 4.5 Testes: /hoje, /questionario, /configuracoes continuam acessíveis para player (AC #5)
  - [x] 4.6 Testes: edge case 404 sem 500 (UUID inválido, sem PII no erro)

### Review Findings

- [x] [Review][Decision] 404 response body: null vs `{ error: 'Not found' }` — **DECISÃO: manter null body** (mais seguro, sem surface OWASP de API revelada; teste valida body vazio; desvio da spec é intencional) [`proxy.ts:~113`]
- [x] [Review][Patch] Dados-mediados check usa `=== "player"` em vez de `!== "coach" && !== "analyst"` — utilizadores sem JWT claims ou com roles desconhecidos contornam o bloco 404 [`proxy.ts:~113`] ✅ APLICADO: `userRole && userRole !== "coach" && userRole !== "analyst"`
- [x] [Review][Patch] Query `fatigue_responses` sem filtro `player_id` a nível de aplicação — correctness delegada exclusivamente ao RLS; sem defence-in-depth para dados de saúde [`historico/page.tsx:~83`] ✅ APLICADO: `.eq("player_id", player.id)` + guard se player é null
- [x] [Review][Patch] Headers da tabela dinâmicos (`copy.dimensions`) mas células hardcoded (5 `<td>` fixos) — mismatch se `copy.dimensions` tiver ≠5 dimensões num futuro age group [`historico/page.tsx:~119`] ✅ APLICADO: células agora mapeadas via `copy.dimensions.map(dim => row[dim.key])`
- [x] [Review][Patch] `phaseLabel()` retorna valor raw da DB como fallback — expõe enum interno ao player [`historico/page.tsx:~37`] ✅ APLICADO: fallback alterado para `"—"`
- [x] [Review][Patch] Return type union `| null` nunca retornado por `getPlayerReadinessSnapshot` nem `getPlayerAcwrTrend` — tipo enganador [`readiness.ts:~66,~88`] ✅ APLICADO: `| null` removido dos return types
- [x] [Review][Defer] `requireStaffRole()` retorna mesmo código "unauthorized" para erros de DB e negação de acesso — erros de infra não distinguíveis de negações intencionais [`readiness.ts:~28`] — deferred, pre-existing
- [x] [Review][Defer] `requireStaffRole()` usa cliente anon em vez de service role para query de profiles — pattern padrão em Server Actions; risco só materializa com sessões expiradas capturadas upstream [`readiness.ts:~40`] — deferred, pre-existing
- [x] [Review][Defer] `formatSubmittedAt` engole excepções silenciosamente sem logging [`historico/page.tsx:~22`] — deferred, pre-existing pattern
- [x] [Review][Defer] `assertNoMetricLeakage` pode ter falsos positivos em valores que contenham substrings de keys proibidas [`dados-mediados-block.test.ts:~86`] — deferred, acceptable for CI
- [x] [Review][Defer] `/relatorios` ausente de `ROLE_ALLOWED_ROUTES` para roles de staff — funcionalidade futura (Epic 7); staff recebe redirect para default route [`proxy.ts:~18`] — deferred, pre-existing

---

## Dev Agent Record

### Implementation Plan

**Abordagem:** Implementar em 4 fases sequenciais seguindo o ciclo red-green-refactor.

1. Fase 1: Atualizar `proxy.ts` para devolver 404 (não 307) para rotas staff-only quando acedidas por players. Também corrigir bug latente: adicionar `/questionario` às rotas permitidas de player.

2. Fase 2: Criar `src/lib/actions/readiness.ts` como placeholder com padrão de autorização para quando as `readiness_snapshots` (Epic 5) forem implementadas. Server Action retorna "Não autorizado" para players.

3. Fase 3: Implementar `/historico` page com query real de `fatigue_responses`. Mostrar apenas raw values, adicionar copy mediado "As tuas respostas...".

4. Fase 4: Suite de testes completa cobrindo todos os ACs incluindo backward compatibility e payload schema validation para garantir zero metric leakage.

### Debug Log

- **Fix 1:** `eslint-disable-next-line` em `fatigue-staff.ts` apontava para linha errada após refactoring do commit `ac100cd`. Movido para a linha correta imediatamente antes de `.from("fatigue_responses")`.
- **Fix 2:** Mock `?? default` em testes de Server Action/historico não distinguia `null` de `undefined`. Corrigido para `!== undefined ? valor : default`.
- **Fix 3:** Teste `dataSufficient` esperava casing incorreto (`datasufficient` vs `dataSufficient`). Corrigido para preservar casing original de `FORBIDDEN_KEYS`.
- **Fix 4:** Testes de historico page para redirect usam try/catch — `redirect()` mockado não lança exceção mas a execução continua.

### Completion Notes

**Implementado em 2026-05-24 por claude-sonnet-4-6.**

**Ficheiros criados:**
- `sparta/src/lib/actions/readiness.ts` — Server Actions `getPlayerReadinessSnapshot` + `getPlayerAcwrTrend` com role guard; players recebem "Não autorizado" genérico; stub para Epic 5
- `sparta/src/__tests__/lib/actions/readiness.test.ts` — 14 testes unitários (player rejeitado, coach/analyst aceite, unauthenticated, missing club_id, empty playerId, error message integrity)
- `sparta/src/__tests__/dados-mediados-block.test.ts` — 27 testes de integração (AC #4: payload schema validation com `assertNoMetricLeakage`; AC #5: backward compat /hoje, /historico, /questionario, /configuracoes; AC #6: 404 graceful sem 500, sem PII leakage)
- `sparta/src/__tests__/app/historico/page.test.tsx` — 14 testes do componente (redirect unauthenticated/staff, copy mediado, empty state, raw values, sRPE, no derived metrics, table ARIA, axe-core scan)

**Ficheiros modificados:**
- `sparta/src/proxy.ts` — `STAFF_ONLY_ROUTES_404` + bloco dados mediados (404 para players em rotas staff); `/questionario` adicionado a `ROLE_ALLOWED_ROUTES.player`
- `sparta/src/app/(player)/historico/page.tsx` — implementação completa (era placeholder); query `fatigue_responses` via RLS, tabela acessível, copy mediado UX-DR38
- `sparta/src/__tests__/middleware.test.ts` — teste de redirect 307→404 para dados mediados; novos testes AC #1 (7 rotas staff-only + staff não bloqueado + player sem JWT claims)
- `sparta/src/lib/actions/fatigue-staff.ts` — fixado `eslint-disable-next-line` para linha correcta (bug pré-existente do commit ac100cd)

---

## File List

**Criados:**
- `sparta/src/lib/actions/readiness.ts`
- `sparta/src/__tests__/lib/actions/readiness.test.ts`
- `sparta/src/__tests__/dados-mediados-block.test.ts`
- `sparta/src/__tests__/app/historico/page.test.tsx`

**Modificados:**
- `sparta/src/proxy.ts`
- `sparta/src/app/(player)/historico/page.tsx`
- `sparta/src/__tests__/middleware.test.ts`
- `sparta/src/lib/actions/fatigue-staff.ts` (fix eslint-disable-next-line)

---

## Change Log

- **2026-05-24:** Implementação completa da Story 4.6 por dev-story. Middleware bloqueia /prontidao, /tendencias, /relatorios, /plantel com 404 para players. Server Actions readiness.ts com authorization gate. /historico implementado com raw answers + copy mediado. 77/77 testes ✅; lint 0 erros; typecheck sem regressões. AC #1–#6 verificados.

---

## Status Log

**2026-05-24:** Story file created via bmad-create-story. Comprehensive context gathered from epics, architecture, and previous stories. Ready for dev implementation.

**2026-05-24:** dev-story iniciada. Status atualizado para in-progress.

---

## Story Metadata

- **Epic Key:** 4
- **Story Key:** 4-6
- **Complexity:** Medium (routing + authorization logic, comprehensive testing)
- **Estimated Effort:** 4–6 hours (middleware, refactor existing routes, write test suite)
- **Dependencies:** Story 4-5 (established staff routes), Story 1.9 (role-based routing), Story 3.11 (auditedRead pattern)
- **Blocks:** Story 5.3 (readiness snapshots cannot be player-visible), Story 5.4 (painel must be staff-only)
- **Test Category:** Integration (middleware behavior + API authorization + payload validation)
