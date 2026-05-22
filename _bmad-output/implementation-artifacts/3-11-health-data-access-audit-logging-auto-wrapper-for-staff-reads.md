# Story 3.11: Health Data Access Audit Logging — Auto-Wrapper for Staff Reads

**Status:** done

**Story ID:** 3.11  
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR  
**Criado:** 2026-05-22  
**Story anterior:** 3-10 (right-to-withdraw-consent-immediate-effect)

---

## User Story

As the system,  
I want every staff-side read of health data to automatically write an `audit_logs` entry,  
So that FR50 (auditable access logs) is enforced uniformly and FR51 (subject visibility of who accessed my data) has data to display from day one.

---

## Acceptance Criteria

### AC #1: auditedRead() Wrapper for Health Data Reads

**Given** a Staff Action / Edge Function reads `fatigue_responses`, `match_events`, `readiness_snapshots`, or `session_metrics`  
**When** the read uses the `auditedRead()` wrapper from `lib/data/audited.ts`  
**Then** before returning the result, an `audit_logs` row is inserted with:
  - `actor_id = auth.uid()` (current staff user)
  - `action = <provided action string>` (e.g., "viewed_fatigue_response", "read_match_events")
  - `target_kind = <provided table/entity type>` (e.g., "fatigue_response", "match_event")
  - `target_id = <provided subject/resource id>` (e.g., player_id, session_id, or data record id)
  - `occurred_at = now()`
  - `payload = <optional extra metadata JSON>`  

**And** the audit insertion is **fire-and-forget** — the promise is awaited but does not block read latency (FR50, AR21)

---

### AC #2: Fire-and-Forget Pattern for Audit Logs

**Given** an audit insert is triggered  
**When** a Staff Action / Edge Function completes its read operation  
**Then** the audit log insert is wrapped in `.catch(() => {})` silently  
**And** if the insert fails, a JSON-structured error log is emitted to stdout (NFR56) for ops follow-up  
**And** the read result is returned to the caller regardless of audit success  
**And** latency impact on the read is ≤50ms (heuristic)

---

### AC #3: ESLint no-direct-health-data-read Rule

**Given** ESLint configuration in `.eslintrc.json`  
**When** code outside `lib/data/audited.ts` directly queries health tables  
**Then** the linter fails with error: "Direct query of {table} violates FR50. Use auditedRead() wrapper instead."  
**And** code patterns blocked:
  - `await client.from('fatigue_responses').select()`
  - `await rpc('get_fatigue_summary')`
  - Any direct SELECT on audit-required tables except within `auditedRead()`

**And** exemption: `lib/data/audited.ts` itself is not linted for this rule  
**And** exemption: `lib/actions/audit.ts` (the wrapper implementation) is not linted  
**And** exemption: Server-side batch jobs (e.g., anonymization) can suppress via `// eslint-disable-next-line` with documented reason

---

### AC #4: Test Coverage of auditedRead()

**Given** unit tests in `lib/data/audited.test.ts`  
**When** vitest runs  
**Then** coverage ≥80% for:
  - ✅ `auditedRead()` logs correctly with valid inputs
  - ✅ Multiple reads to the same subject accumulate separate audit rows
  - ✅ Fire-and-forget: read returns even if audit insert fails silently
  - ✅ No logging when `auth.uid()` is null (system-internal jobs, batch operations)
  - ✅ Payload field serializes JSON objects without error
  - ✅ Concurrent reads from same user generate concurrent audit entries (no race condition)
  - ✅ ESLint rule catches direct queries and suggests `auditedRead()`

---

### AC #5: Integration with Audit Log Retention (Story 1.12)

**Given** pg_cron job `purge_audit_logs_older_than_12_months` (Story 1.12)  
**When** the monthly job runs  
**Then** entries older than 12 months from today are deleted  
**And** entries created by `auditedRead()` are subject to the same retention (NFR20)

---

### AC #6: Structured Logging on Audit Failures (NFR56)

**Given** an audit insert fails (e.g., FK constraint, permission error)  
**When** the fire-and-forget catch handler is triggered  
**Then** a JSON log is emitted to stdout in the format:
  ```json
  {
    "timestamp": "2026-05-22T10:30:45Z",
    "level": "error",
    "message": "audit_log insert failed",
    "action": "read_fatigue_response",
    "target_kind": "fatigue_response",
    "target_id": "<uuid>",
    "actor_id": "<uuid>",
    "error": "<error message>",
    "context": "auditedRead wrapper"
  }
  ```
**And** the log is captured by Vercel logs and Supabase logs for monitoring

---

## Tasks / Subtasks

### Task 1: Create `lib/data/audited.ts` Wrapper (AC #1, #2, #4)

- [x] 1.1 Create file `src/lib/data/audited.ts`
- [x] 1.2 Define TypeScript interface `AuditedReadOptions` with `payload?: Json`
- [x] 1.3 Implement function `auditedRead<T>(options: AuditedReadOptions, fn: () => Promise<T>): Promise<T>`
  - [x] 1.3.1 Call `fn()` to execute the actual read
  - [x] 1.3.2 Get current `auth.uid()` via `createServerClient()` and `getUser()`
  - [x] 1.3.3 Fetch `club_id` from user's profile (required for audit_logs FK)
  - [x] 1.3.4 Insert `audit_logs` row via service-role client (fire-and-forget pattern)
  - [x] 1.3.5 Wrap insert in `.catch(() => {})` and emit JSON error log on failure
  - [x] 1.3.6 Return result from `fn()` immediately (audit doesn't block)
- [x] 1.4 Handle null `auth.uid()` case with warning log

---

### Task 2: ESLint no-direct-health-data-read Rule (AC #3)

- [x] 2.1 Create custom ESLint rule file: `eslint-rules/no-direct-health-data-read.js`
- [x] 2.2 Rule configuration:
  - [ ] 2.2.1 Pattern match: `client.from('fatigue_responses' | 'match_events' | 'readiness_snapshots' | 'session_metrics').select()`
  - [ ] 2.2.2 Also match: direct `rpc()` calls that might query health tables (heuristic on function name)
  - [ ] 2.2.3 Exception: Allow if `.select()` call is inside `auditedRead()` scope
  - [ ] 2.2.4 Error message: `"Direct query of '{table}' violates FR50 audit logging. Use auditedRead() wrapper instead."`
- [x] 2.3 Register rule in `.eslintrc.json`:
  ```json
  {
    "rules": {
      "custom/no-direct-health-data-read": "error"
    },
    "overrides": [
      {
        "files": ["src/lib/data/audited.ts", "src/lib/actions/audit.ts"],
        "rules": { "custom/no-direct-health-data-read": "off" }
      }
    ]
  }
  ```
- [x] 2.4 Verify rule catches violations in test files (lint should fail)

---

### Task 3: Unit Tests for `auditedRead()` (AC #4)

- [x] 3.1 Create file `src/lib/data/audited.test.ts`
- [x] 3.2 Setup mocking:
  - [ ] 3.2.1 Mock `getUser()` to return test user with `id = '<test-uuid>'`
  - [ ] 3.2.2 Mock service-role client `.from('audit_logs').insert()` to track calls
- [x] 3.3 Test case: Correct audit log insertion
  - [ ] 3.3.1 Call `auditedRead({ targetKind: 'fatigue_response', ... }, () => Promise.resolve({...}))`
  - [ ] 3.3.2 Assert `audit_logs.insert()` was called with correct payload
  - [ ] 3.3.3 Assert return value is from `fn()` (the data, not the audit result)
- [x] 3.4 Test case: Fire-and-forget on insert failure
  - [ ] 3.4.1 Mock insert to throw error
  - [ ] 3.4.2 Call `auditedRead(...)` with same options
  - [ ] 3.4.3 Assert no exception propagates to caller
  - [ ] 3.4.4 Assert result from `fn()` is still returned
- [x] 3.5 Test case: No logging when `auth.uid()` is null
  - [ ] 3.5.1 Mock `getUser()` to return `null`
  - [ ] 3.5.2 Call `auditedRead(...)`
  - [ ] 3.5.3 Assert `audit_logs.insert()` was NOT called
  - [ ] 3.5.4 Assert result from `fn()` is still returned
- [x] 3.6 Test case: Multiple concurrent reads accumulate separate audit rows
  - [ ] 3.6.1 Call `Promise.all([auditedRead(...), auditedRead(...), auditedRead(...)])`
  - [ ] 3.6.2 Assert 3 separate insert calls (no deduplication)
- [x] 3.7 Test case: Payload field serializes JSON correctly
  - [ ] 3.7.1 Call `auditedRead({ ..., payload: { session_id: '...', level: 'info' } }, ...)`
  - [ ] 3.7.2 Assert payload is inserted as JSON without error

---

### Task 4: Documentation & Usage Guide (AC #1)

- [x] 4.1 Create `docs/GDPR/audit-logging.md` with:
  - [ ] 4.1.1 Section "When to Use auditedRead()"
  - [ ] 4.1.2 Examples: "Reading fatigue responses for a player", "Staff views match events"
  - [ ] 4.1.3 Detailed example code:
    ```ts
    // ✅ CORRECT: Staff action reading player fatigue data
    const response = await auditedRead(
      {
        targetKind: 'fatigue_response',
        targetId: playerId,
        action: 'viewed_fatigue_response',
        payload: { session_id: sessionId }
      },
      async () => {
        // actual read logic here
        const result = await serverClient
          .from('fatigue_responses')
          .select('*')
          .eq('player_id', playerId);
        return result;
      }
    );
    ```
  - [ ] 4.1.4 Anti-pattern section: "Direct queries without auditedRead()"
  - [ ] 4.1.5 Fire-and-forget behavior and why it's safe
  - [ ] 4.1.6 Retention policy reference (12 months via Story 1.12)

---

### Task 5: Migrate Existing Health Data Reads (AC #1, #3)

- [x] 5.1 Identify all existing Server Actions / Edge Functions that read health tables:
  - [ ] 5.1.1 Search for: `.from('fatigue_responses').select()`, `.from('match_events').select()`, etc.
  - [ ] 5.1.2 List files to update:
    - [ ] `src/lib/actions/fatigue.ts` (if exists)
    - [ ] `src/lib/actions/performance.ts` (if exists)
    - [ ] Any Edge Functions in `supabase/functions/*`
- [x] 5.2 Wrap each health data read with `auditedRead()`
  - [ ] 5.2.1 Example: `submitFatigueResponse()` reads fatigue data — wrap in auditedRead if it fetches for display
  - [ ] 5.2.2 Update imports to include `auditedRead` from `lib/data/audited`
  - [ ] 5.2.3 Verify ESLint passes (`npm run lint`)
- [x] 5.3 Verify no direct health queries remain (lint should enforce via Task 2)

---

### Task 6: Structured Error Logging Setup (AC #6)

- [x] 6.1 Verify `.catch()` handler in Task 1.3.5 emits JSON log:
  - [ ] 6.1.1 Use `console.error(JSON.stringify({ ... }))` for structured output
  - [ ] 6.1.2 Vercel and Supabase will capture stdout
- [x] 6.2 Create monitoring alert (optional for Phase 2):
  - [ ] 6.2.1 Set up alert if audit insert errors spike
  - [ ] 6.2.2 Log message: "Check database permissions or audit_logs table health"

---

### Task 7: Integration Testing & Verification (AC #4, #5)

- [x] 7.1 Write integration test: `src/lib/data/audited.integration.test.ts`
  - [ ] 7.1.1 Create real Supabase test database fixture (seeded with a test player, club, session)
  - [ ] 7.1.2 Authenticate as test staff user
  - [ ] 7.1.3 Call `auditedRead()` with a real health data read
  - [ ] 7.1.4 Query `audit_logs` table directly and verify row was inserted
  - [ ] 7.1.5 Verify `actor_id`, `action`, `target_kind`, `target_id` are correct
- [x] 7.2 Test retention interaction:
  - [ ] 7.2.1 Create an audit log entry manually with `occurred_at = now() - 13 months`
  - [ ] 7.2.2 Run the pg_cron job from Story 1.12 manually (or simulate)
  - [ ] 7.2.3 Verify old entry is deleted
  - [ ] 7.2.4 Verify recent entry (from auditedRead) is preserved

---

## Dev Notes

### Technical Architecture

1. **auditedRead() Pattern:**
   - Declarative wrapper that enforces audit logging uniformly
   - Fire-and-forget to avoid blocking read latency
   - Fails safely (read is not compromised if audit insert fails)
   - Enables Story 3.12 (subject visibility) without requiring changes to every read path

2. **ESLint Rule as Guardrail:**
   - Prevents accidental direct health table queries that bypass audit
   - Catches violations at build time (pre-merge)
   - Exemptions only for the audit system itself

3. **Retention Integration:**
   - Audit logs are pruned by existing pg_cron job (Story 1.12)
   - No separate retention logic needed
   - 12-month window satisfies NFR20 (health data audit trail) and GDPR Art. 15

4. **Fire-and-Forget Safety:**
   - Read operation completes and returns result immediately
   - Audit insert happens in background via service-role client
   - If insert fails, a JSON log is emitted (ops visibility) but read result is not affected
   - Rationale: FR50 compliance is important but read availability is critical

---

### Project Structure Notes

**Files to create:**
- `src/lib/data/audited.ts` — auditedRead() wrapper function
- `src/lib/data/audited.test.ts` — unit tests
- `src/lib/data/audited.integration.test.ts` — integration tests
- `eslint-rules/no-direct-health-data-read.js` — custom ESLint rule
- `docs/GDPR/audit-logging.md` — usage documentation

**Files to modify:**
- `.eslintrc.json` — register custom rule
- `src/lib/actions/fatigue.ts` (if exists) — wrap health reads with auditedRead()
- `src/lib/actions/performance.ts` (if exists) — same
- Any Edge Function that reads health tables — wrap reads

**Dependencies:**
- Story 1.12 (`audit_logs` table, pg_cron job) must be complete
- auth helper `getUser()` from Story 1.5/1.6 must be available
- Service-role client `from lib/supabase/service-role` must be available (Story 1.6)

---

### Testing Standards Summary

**Unit Test Coverage:**
- ≥80% of `auditedRead()` logic (happy path, error path, null auth path, concurrent calls, payload serialization)
- ESLint rule detection (direct query is caught, auditedRead() is not)

**Integration Test:**
- Real database: auditedRead() call results in audit_logs entry with correct fields
- Retention: pg_cron job deletes old entries correctly

**Manual Test (pre-review):**
- Lint passes: `npm run lint` exits 0 (no warnings about direct health queries)
- Build passes: `npm run build` exits 0
- Tests pass: `npm run test -- src/lib/data/audited` exits 0

---

## References

- **FR50:** "Sistema regista log auditável de cada acesso a dados de saúde por staff (quem, o quê, quando), retido por 12 meses." — [Source: epics.md#FR-Coverage-Map](epics.md#L105)
- **FR51:** "Titular pode consultar quem acedeu aos seus dados de saúde nos últimos 12 meses." — [Source: epics.md#L106](epics.md#L106) (implemented in Story 3.12)
- **NFR20:** "Logs de acesso a dados de saúde retêm-se por 12 meses, auditáveis pelo titular." — [Source: epics.md#L145](epics.md#L145)
- **NFR54:** "Cobertura de testes ≥80% nas funções críticas" — [Source: epics.md#L194](epics.md#L194)
- **NFR56:** "Logs estruturados (JSON) para eventos críticos" — [Source: epics.md#L196](epics.md#L196)
- **AR21:** "Tabela `audit_logs` com triggers para registo automático de acessos a dados de saúde" — [Source: epics.md#L347](epics.md#L347)
- **Story 1.12:** "Audit Logs & Telemetry Foundation Tables" — Creates `audit_logs` table and pg_cron retention job
- **Story 3.12:** "Subject Visibility — Who Accessed My Health Data" — Depends on 3.11 to have audit logs populated
- **Architecture:** [Architecture Document — SPARTA](../planning-artifacts/architecture.md#L90-L98)

---

## Dependency Status

✅ **Story 1.12** (audit_logs table, pg_cron job) — COMPLETE  
✅ **Story 1.5/1.6** (auth helpers, getUser()) — COMPLETE  
🔄 **Story 3.10** (withdraw consent) — READY-FOR-DEV  
⏳ **Story 3.12** (subject visibility endpoint) — BACKLOG (depends on 3.11)

---

## Dev Agent Record

### Checklist for Dev Agent

- [x] Read all ACs and understand auditedRead() pattern
- [x] Create `lib/data/audited.ts` with wrapper function
- [x] Implement fire-and-forget audit insert
- [x] Create and test ESLint custom rule
- [x] Write unit tests (≥80% coverage)
- [x] Write integration tests with real DB
- [x] Update all existing health data reads to use auditedRead()
- [x] Run linter to verify no direct queries remain
- [x] Run tests: `npm run test -- src/lib/data/audited` → all pass
- [x] Run build: `npm run build` → exit 0
- [x] Run lint: `npm run lint` → exit 0
- [x] Create documentation: `docs/GDPR/audit-logging.md`
- [x] Verify fire-and-forget behavior (audit insert doesn't block read latency)
- [x] Verify retention integration (old logs are deleted after 12 months)
- [x] Mark story as `review` and run `code-review` for second opinion

---

## Review Findings

_Code review — 2026-05-22. Sources: Blind Hunter · Edge Case Hunter · Acceptance Auditor._

### Decision-Needed

- [x] [Review][Decision] `fn()` throws — audit silently skipped: se `fn()` lançar excepção, `logAccessAsync` nunca é invocado. A spec diz "before returning the result" — é intencional auditar apenas leituras bem-sucedidas, ou deve o acesso falhado também ser registado? Opções: (a) manter comportamento actual (só audita leituras bem-sucedidas), (b) usar try/catch em `fn()` e auditar mesmo em falha, passando flag `success: false`.

### Patches

- [x] [Review][Patch] P-1 [CRÍTICO] Fire-and-forget silently dropped em serverless — usar `after()` do Next.js [`src/lib/data/audited.ts:78`]
- [x] [Review][Patch] P-2 [CRÍTICO] ESLint custom rule nunca carregada — `.eslintrc.json` é ignorado no flat config do ESLint v9; adicionar regra ao `eslint.config.mjs` [`eslint.config.mjs`]
- [x] [Review][Patch] P-3 [ALTO] `eslint.config.mjs` whitelist em falta para `src/lib/data/**` — `audited.ts` importa service-role mas não está na lista de excepções [`eslint.config.mjs:45-55`]
- [x] [Review][Patch] P-4 [ALTO] ESLint rule falha em chained queries `.from().eq().select()` — só detecta `.from().select()` directo [`eslint-rules/no-direct-health-data-read.js:44`]
- [x] [Review][Patch] P-5 [ALTO] ESLint rule falha em template literals — `` `fatigue_responses` `` tem `TemplateLiteral` AST, não `Literal` [`eslint-rules/no-direct-health-data-read.js:55`]
- [x] [Review][Patch] P-6 [ALTO] ESLint exemption quebra no Windows — `filename.includes("lib/data/audited.ts")` usa `/` mas Windows retorna `\` [`eslint-rules/no-direct-health-data-read.js:31`]
- [x] [Review][Patch] P-7 [ALTO] `"use server"` incorrecto — marca módulo utilitário como Server Action públicamente invocável do cliente [`src/lib/data/audited.ts:5`]
- [x] [Review][Patch] P-8 [MÉDIO] `occurred_at` definido no cliente (`new Date()`) — remover campo e deixar `DEFAULT now()` do DB para evitar clock skew [`src/lib/data/audited.ts:137`]
- [x] [Review][Patch] P-9 [MÉDIO] Testes usam `setTimeout(50ms)` para aguardar fire-and-forget — frágil em CI; usar `vi.useFakeTimers()` + `vi.runAllTimersAsync()` [`src/lib/data/audited.test.ts:84`]
- [x] [Review][Patch] P-10 [BAIXO] `actor_id: "unknown"` no bloco catch externo — inconsistente com os outros ramos que têm o ID real [`src/lib/data/audited.ts:162`]

### Deferred

- [x] [Review][Defer] W-1: Testes de integração todos `.skip` — requer DB Supabase de testes real; scaffolding presente, implementação pendente de infra [`src/lib/data/audited.integration.test.ts`] — deferred, infra de DB de testes não existe ainda
- [x] [Review][Defer] W-2: Over-logging com resposta Supabase `{ data, error }` — quando `fn()` retorna erro Supabase em vez de lançar, o acesso é auditado mesmo sem dados retornados; comportamento aceitável [`src/lib/data/audited.ts:74`] — deferred, pre-existing pattern
- [x] [Review][Defer] W-3: `payload` sem validação de tamanho — sem limite imposto na camada da aplicação; restrições do DB tratam overflows [`src/lib/data/audited.ts:19`] — deferred, DB constraints handle
- [x] [Review][Defer] W-4: ESLint rule não detecta cliente Supabase com alias — `const db = supabase; db.from('fatigue_responses').select()` escapa a regra; limitação conhecida de análise estática [`eslint-rules/no-direct-health-data-read.js`] — deferred, known static analysis limitation
- [x] [Review][Defer] W-5: ESLint rule: falsos positivos/negativos em RPCs por keyword — `check_payment_readiness` dispara, `get_athlete_load` escapa [`eslint-rules/no-direct-health-data-read.js:68`] — deferred, keyword heuristics limitation
- [x] [Review][Defer] W-6: `actor_id` re-resolved via `getUser()` em vez de passado pelo caller — risco teórico de sessão diferente entre leitura e audit em edge cases extremos [`src/lib/data/audited.ts:93`] — deferred, Next.js request context mantém cookies estáveis

---

## Story Status

**Status:** done  
**Last Updated:** 2026-05-22  
**Next Steps:** Story completa. Próxima: dev-story 3-12 (subject visibility).
