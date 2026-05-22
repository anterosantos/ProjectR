# Story 3.12: Subject Visibility — Who Accessed My Health Data

**Status:** ready-for-dev

**Story ID:** 3.12  
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR  
**Criado:** 2026-05-22  
**Story anterior:** 3-11 (health-data-access-audit-logging-auto-wrapper-for-staff-reads)

---

## User Story

As an adult titular or Encarregado de Educação,  
I want to see a list of every staff access to my (or my child's) health data in the last 12 months,  
So that GDPR Art. 15 (Right of Access) is honoured concretely with named accesses, not abstract policy.

---

## Acceptance Criteria

### AC #1: Route Structure — Two Entry Points

**Given** two distinct access patterns:
- **Titular (adult ≥16):** Authenticated session, route `/configuracoes/direitos/acessos` (FRprecision51)
- **Encarregado (parent via token):** Tokenized anonymous, route `/direitos/[token]/acessos` (FR5, FR8)

**When** either route is accessed  
**Then** the page is server-rendered with proper RLS enforcement (Story 1.12, AR13)  
**And** title shows "Quem consultou os teus dados?" (titular) or "Quem consultou os dados de [child_name]?" (Encarregado)

---

### AC #2: Audit Log Display — Last 12 Months

**Given** the page loads for a valid subject (titular or verified Encarregado)  
**When** data is fetched via Server Action `getAuditLogForSubject(subjectId)`  
**Then** the query fetches all `audit_logs` rows where:
  - `target_id = subjectId` (the subject or child)
  - `created_at >= now() - interval '12 months'` (NFR20 retention window)
  - Ordered by `occurred_at DESC` (most recent first)

**And** query uses RLS policy from Story 1.12:
  - Subject can only see own logs (policy: `target_id = auth.uid()`)
  - Encarregado via token can see child's logs (policy: verified token + `target_id = linked_player_id`)

**And** if no entries exist, an `<EmptyState>` is shown with copy: "Sem acessos registados. Os teus dados ainda não foram consultados pelo staff." (UX-DR8)

---

### AC #3: Each Audit Entry Display Format

**Given** each `audit_logs` row is displayed  
**When** rendered as a list item  
**Then** each entry shows (in order):
  - **Date & Time:** `occurred_at` formatted via `date-fns` with locale `pt-PT`
    - Format: `7 de maio de 2026 às 10:30` (via `formatDateTime` from app util) (UX-DR36)
  - **Staff Member:** Actor's `full_name` + `role` (e.g., "João Silva (Treinador)")
    - Retrieved by joining `profiles` table on `actor_id` (can be cached, <10ms)
  - **Action:** `action` field translated to PT-PT user-friendly copy
    - **Mapping (examples):**
      - `"viewed_fatigue_response"` → `"Consultou questionário de fadiga"`
      - `"read_match_events"` → `"Consultou eventos de jogo"`
      - `"read_readiness_snapshot"` → `"Consultou painel de prontidão"`
      - `"read_session_metrics"` → `"Consultou métricas da sessão"`
      - `"subject.exported"` → `"Solicitou exportação de dados"`
      - `"subject.withdrew"` → `"Retirou consentimento"`
    - All translations ≤15 words, 2nd person singular ("Consultou", not "Acesso a") (UX-DR38)
  - **Target Kind:** `target_kind` field translated
    - **Mapping:**
      - `"fatigue_response"` → `"Questionário de fadiga"`
      - `"match_event"` → `"Evento de jogo"`
      - `"readiness_snapshot"` → `"Painel de prontidão"`
      - `"session_metrics"` → `"Métricas da sessão"`
      - `"player"` → `"Perfil"`

**And** each entry is rendered in a neutral `<div>` card with hairline border (UX-DR1) + subtle hover state  
**And** no action buttons on individual entries (display-only, no revoke option)

---

### AC #4: Pagination for Large Lists

**Given** the subject has >100 audit entries  
**When** the page loads  
**Then** entries are paginated with 50 per page (conservative for performance)  
**And** pagination controls show "Página 1 de X" (e.g., "Página 1 de 3")  
**And** Previous/Next buttons navigate between pages (disabled when at start/end)  
**And** each page request uses Server Action `getAuditLogForSubject(subjectId, page: number, pageSize: 50)`

**And** no client-side infinite scroll (simpler, better a11y via semantic `<nav role="navigation">`)

---

### AC #5: Date Range Search/Filter

**Given** the list is displayed  
**When** there are >20 entries  
**Then** a "Filter by date range" option is shown (optional — not required for MVP, but recommended UI)  
**And** if implemented: two date inputs (`from`, `to`) + "Filter" button
  - Server-side filtering: `occurred_at >= :from AND occurred_at < :to` (exclusive of next day's 00:00)
  - Reset button clears both inputs and reloads full 12-month range

**Note:** If omitted in MVP, list remains chronological (no date filter) — acceptable per Acceptance Criteria

---

### AC #6: Export Option

**Given** the page displays audit log data  
**When** the user taps "Exportar este histórico"  
**Then** a Server Action calls the existing Story 3.6 `requestDataExportForSelf()` Edge Function
  - Exports all 12 months of `audit_logs` rows for the subject (not just this view, but all data)
  - Returns signed URL (if ≤5MB) or async email (if >5MB)

**And** `<CalmConfirmation>` feedback is shown per Story 3.6 behavior

**And** note: "O ficheiro exportado inclui todos os teus dados e acessos (último registo de 12 meses)."

---

### AC #7: Accessibility & Responsive Design

**Given** the page renders on mobile, tablet, desktop  
**When** tested  
**Then** all of the following are satisfied:
  - ✅ Semantic HTML: `<main>`, `<section>`, `<nav>`, `<article>` for each entry
  - ✅ Focus: Pagination buttons and "Exportar" button are focusable via Tab
  - ✅ ARIA: Pagination `<nav>` has `role="navigation"` and `aria-label="Paginação"`
  - ✅ ARIA: Each audit entry has `role="article"` with semantic date/actor/action structure (or implied by semantic HTML)
  - ✅ Dark mode: Colors respect `prefers-color-scheme` (Story 1.17 tokens)
  - ✅ Contrast: Text ≥4.5:1 on background (NFR37)
  - ✅ Touch targets: Pagination buttons, export button ≥44×44px (NFR40)
  - ✅ Reduced motion: No animations beyond fade-in of list (UX-DR3)
  - ✅ axe-core: Zero violations (NFR37)

---

### AC #8: Copy Tone & Language

**Given** all visible copy on the page  
**When** rendered  
**Then** the following rules are applied:
  - Tone is neutral, factual — no apology, no emojis (UX-DR38)
  - All sentences ≤15 words ("Quem consultou os dados de [child_name]?" ✅ vs "O sistema registou quem acessou..." ❌)
  - 2nd person singular ("Consultou", "Solicitou", "Retirou") — not 3rd person "Acesso", "Foi exportado"
  - B1 CEFR ceiling for language (NFR42)
  - Example ✅: "Consultou questionário de fadiga"  
  - Example ❌: "Staff member accessed your fatigue survey data"

---

### AC #9: RLS Enforcement & Security

**Given** the Server Action `getAuditLogForSubject(subjectId)`  
**When** invoked  
**Then** RLS policy ensures:
  - Titular querying own logs: only rows where `target_id = auth.uid()`
  - Encarregado via token querying child logs: only rows where `target_id = <child_player_id>` AND token is valid
  - No cross-subject leakage (integration test required)

**And** the query does NOT return actor email or any PII beyond name + role  
**And** if a subject tries to query another subject's logs, the query returns `[]` (empty) without error

---

### AC #10: Test Coverage

**Given** tests in `src/app/direitos/[token]/acessos/page.test.ts` and `src/app/(staff)/configuracoes/direitos/acessos/page.test.ts`  
**When** vitest runs  
**Then** coverage ≥80% for:
  - ✅ Renders list of audit entries correctly
  - ✅ Pagination controls work (loads next/prev pages)
  - ✅ Empty state displays when no entries exist
  - ✅ Date-time formatting is PT-PT (via `date-fns` locale)
  - ✅ Action translations map correctly (direct snapshot test of mapping)
  - ✅ RLS isolation: titular cannot see other subject's logs (integration test with real DB seeding)
  - ✅ Encarregado via token: only child's logs visible
  - ✅ Export button triggers Story 3.6 flow

---

## Tasks / Subtasks

### Task 1: Create Server Action `getAuditLogForSubject` (AC #1, #2, #9)

- [ ] 1.1 Create file `src/lib/actions/audit-visibility.ts`
- [ ] 1.2 Define TypeScript types:
  ```ts
  interface AuditLogEntry {
    id: string;
    actor_id: string;
    action: string;
    target_kind: string;
    target_id: string;
    occurred_at: string; // ISO 8601
    payload?: Record<string, unknown>;
  }

  interface AuditVisibilityResult {
    entries: AuditLogEntry[];
    actorMap: Record<string, { full_name: string; role: string }>; // cache of actor profiles
    totalCount: number;
    hasMore: boolean;
  }
  ```
- [ ] 1.3 Implement Server Action:
  ```ts
  export async function getAuditLogForSubject(
    subjectId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<Result<AuditVisibilityResult, AppError>>
  ```
  - [ ] 1.3.1 Get current user via `getUser()`
  - [ ] 1.3.2 Verify subject ownership (user = subjectId) OR token validity (for Encarregado)
  - [ ] 1.3.3 Query `audit_logs` filtered by:
    - `target_id = subjectId`
    - `created_at >= now() - interval '12 months'`
  - [ ] 1.3.4 Apply RLS at DB level (Supabase will enforce automatically)
  - [ ] 1.3.5 Fetch actor profiles (name, role) in bulk for display
  - [ ] 1.3.6 Return paginated result with `totalCount` and `hasMore` flag
  - [ ] 1.3.7 If query returns empty, return `{ entries: [], actorMap: {}, totalCount: 0, hasMore: false }`
- [ ] 1.4 Error handling:
  - [ ] 1.4.1 If not authenticated and no token: return `err({ code: 'unauthorized' })`
  - [ ] 1.4.2 If token invalid or expired: return `err({ code: 'invalid_token' })`
  - [ ] 1.4.3 If subjectId doesn't match user: return `err({ code: 'forbidden' })`

---

### Task 2: Action Translation Map & Utility (AC #3)

- [ ] 2.1 Create file `src/lib/i18n/audit-actions.ts`
- [ ] 2.2 Define translation object:
  ```ts
  const AUDIT_ACTION_TRANSLATIONS: Record<string, string> = {
    'viewed_fatigue_response': 'Consultou questionário de fadiga',
    'read_match_events': 'Consultou eventos de jogo',
    'read_readiness_snapshot': 'Consultou painel de prontidão',
    'read_session_metrics': 'Consultou métricas da sessão',
    'subject.exported': 'Solicitou exportação de dados',
    'subject.withdrew': 'Retirou consentimento',
    'subject.restricted': 'Limitou o processamento de dados',
    'subject.rectified': 'Solicitou retificação de dados',
    // ... more as discovered
  };

  const TARGET_KIND_TRANSLATIONS: Record<string, string> = {
    'fatigue_response': 'Questionário de fadiga',
    'match_event': 'Evento de jogo',
    'readiness_snapshot': 'Painel de prontidão',
    'session_metrics': 'Métricas da sessão',
    'player': 'Perfil',
  };
  ```
- [ ] 2.3 Export functions:
  - [ ] `translateAction(action: string): string` — returns translated action or fallback to action as-is
  - [ ] `translateTargetKind(kind: string): string` — same for target_kind
- [ ] 2.4 Test snapshot: translations map correctly for all discovered actions

---

### Task 3: Create Titular Route `/configuracoes/direitos/acessos` (AC #1, #2, #3)

- [ ] 3.1 Create directory: `src/app/(staff)/configuracoes/direitos/acessos/`
- [ ] 3.2 Create file: `page.tsx` (Client Component)
  - [ ] 3.2.1 Route guards: middleware redirects if not authenticated (Story 1.5/1.6)
  - [ ] 3.2.2 Fetch server-side: call `getAuditLogForSubject(auth.uid())`
  - [ ] 3.2.3 Render:
    - [ ] Header: "Quem consultou os teus dados?" + breadcrumb "Configurações > Os meus direitos > Acessos"
    - [ ] `<AuditLogList>` component with entries, pagination, export button
    - [ ] Or empty state if no entries
- [ ] 3.3 Create file: `layout.tsx` (if needed) — use common layout from `(staff)` group
- [ ] 3.4 Create Client Component: `src/components/domain/AuditLogList.tsx`
  - [ ] 3.4.1 Props:
    ```ts
    interface AuditLogListProps {
      entries: AuditLogEntry[];
      actorMap: Record<string, { full_name: string; role: string }>;
      totalCount: number;
      currentPage: number;
      pageSize: number;
      onPageChange: (page: number) => void;
      isLoading?: boolean;
      onExport?: () => void;
    }
    ```
  - [ ] 3.4.2 Render:
    - [ ] List of entries with date, actor, action, target_kind (AC #3)
    - [ ] Pagination controls at bottom (AC #4)
    - [ ] "Exportar este histórico" button (AC #6)
    - [ ] Empty state when `entries.length === 0` (AC #2)

---

### Task 4: Create Encarregado Route `/direitos/[token]/acessos` (AC #1, #2)

- [ ] 4.1 Create directory: `src/app/direitos/[token]/acessos/`
- [ ] 4.2 Create file: `page.tsx`
  - [ ] 4.2.1 Extract token from URL params: `params.token`
  - [ ] 4.2.2 Validate token via Edge Function `consent-validate` (Story 3.3, existing) OR custom Server Action
  - [ ] 4.2.3 Fetch linked player_id from `parental_consents` table (service-role, token-based)
  - [ ] 4.2.4 Call `getAuditLogForSubject(player_id, { token })`
  - [ ] 4.2.5 Render same `<AuditLogList>` component but with:
    - [ ] Title: "Quem consultou os dados de [child_name]?"
    - [ ] Export redirects to `/direitos/[token]/exportar` (Story 3.6 flow)
    - [ ] Empty state + "Sem acessos registados. Os dados ainda não foram consultados pelo staff."
  - [ ] 4.2.6 Error states:
    - [ ] Invalid/expired token → show `<EmptyState>` "Link expirado ou inválido"
    - [ ] No parental consent found → same as above

---

### Task 5: Pagination Component & Logic (AC #4)

- [ ] 5.1 Create component: `src/components/patterns/Pagination.tsx`
  - [ ] 5.1.1 Props:
    ```ts
    interface PaginationProps {
      currentPage: number;
      totalPages: number;
      onPageChange: (page: number) => void;
      isLoading?: boolean;
    }
    ```
  - [ ] 5.1.2 Render:
    - [ ] "Página X de Y" text
    - [ ] "Anterior" button (disabled if page = 1, `aria-disabled="true"`)
    - [ ] "Próxima" button (disabled if page = totalPages, `aria-disabled="true"`)
    - [ ] `role="navigation"` + `aria-label="Paginação"`
  - [ ] 5.1.3 Button styling: ghost variant (UX-DR30), touch target ≥44px (NFR40)
- [ ] 5.2 Integration in `AuditLogList`:
  - [ ] 5.2.1 Maintain `currentPage` state
  - [ ] 5.2.2 Re-fetch data on page change via `getAuditLogForSubject(subjectId, currentPage)`
  - [ ] 5.2.3 Show loading skeleton while fetching (Story 1.8 pattern)

---

### Task 6: Date-Time Formatting Utility (AC #3)

- [ ] 6.1 Create file: `src/lib/format/date-time.ts`
- [ ] 6.2 Implement function:
  ```ts
  export function formatAuditLogDateTime(isoString: string): string {
    // Input: "2026-05-22T10:30:45.000Z"
    // Output: "22 de maio de 2026 às 10:30"
    // Uses date-fns with locale 'pt-PT'
    const date = parseISO(isoString);
    return formatISO(date, { locale: ptPT, format: 'PPP' }) + ' às ' + format(date, 'HH:mm', { locale: ptPT });
    // or simpler: formatRelative(date, new Date(), { locale: ptPT })
  }
  ```
- [ ] 6.3 Use in `AuditLogList` for rendering `occurred_at`

---

### Task 7: Unit Tests (AC #10)

- [ ] 7.1 Create test file: `src/app/(staff)/configuracoes/direitos/acessos/page.test.ts`
  - [ ] 7.1.1 Mock `getAuditLogForSubject` to return seeded audit entries
  - [ ] 7.1.2 Test: Page renders list with correct layout
  - [ ] 7.1.3 Test: Pagination buttons work (page state changes)
  - [ ] 7.1.4 Test: Empty state shows when no entries
  - [ ] 7.1.5 Test: Action translations display correctly
  - [ ] 7.1.6 Test: Date formatting is PT-PT ("22 de maio de 2026 às 10:30")
  - [ ] 7.1.7 Test: Export button is visible and clickable
  - [ ] 7.1.8 Test: a11y via axe-core (zero violations)

- [ ] 7.2 Create test file: `src/lib/i18n/audit-actions.test.ts`
  - [ ] 7.2.1 Snapshot test: all action translations
  - [ ] 7.2.2 Snapshot test: all target_kind translations
  - [ ] 7.2.3 Test: fallback for unknown action/kind (returns input unchanged)

- [ ] 7.3 Create integration test: `src/lib/actions/audit-visibility.integration.test.ts`
  - [ ] 7.3.1 Setup: seed DB with test club, staff, player, audit logs
  - [ ] 7.3.2 Test: RLS isolation (titular cannot see other subject's logs)
  - [ ] 7.3.3 Test: Encarregado with valid token sees child's logs
  - [ ] 7.3.4 Test: Unauthorized user gets `forbidden` error
  - [ ] 7.3.5 Test: 12-month filter works (old entries not returned)

---

### Task 8: Encarregado Route Tests (AC #10)

- [ ] 8.1 Create test file: `src/app/direitos/[token]/acessos/page.test.ts`
  - [ ] 8.1.1 Test: Valid token loads child's logs
  - [ ] 8.1.2 Test: Invalid token shows error state
  - [ ] 8.1.3 Test: Expired token shows error state
  - [ ] 8.1.4 Test: Export button on Encarregado route redirects to `/direitos/[token]/exportar`

---

### Task 9: Integration with Story 3.6 Export (AC #6)

- [ ] 9.1 Verify export button in both routes:
  - [ ] Titular: calls `requestDataExportForSelf()` from Story 3.6
  - [ ] Encarregado: calls variant `requestDataExportByToken(token)` from Story 3.6
- [ ] 9.2 Verify `<CalmConfirmation>` feedback matches Story 3.6 spec
- [ ] 9.3 Verify exported CSV includes all data (not just audit logs — full data export per FR46)

---

### Task 10: Documentation & Copy Finalization (AC #8)

- [ ] 10.1 Create `docs/GDPR/subject-visibility.md` with:
  - [ ] 10.1.1 Overview: "What audit logs are and why they exist"
  - [ ] 10.1.2 User guide: "How to check who accessed my data"
  - [ ] 10.1.3 Action translation list (comprehensive)
  - [ ] 10.1.4 RLS enforcement explanation
  - [ ] 10.1.5 Retention window (12 months)

- [ ] 10.2 Final copy review:
  - [ ] 10.2.1 All translations ≤15 words
  - [ ] 10.2.2 No emojis, no exclamation marks (UX-DR38)
  - [ ] 10.2.3 B1 CEFR ceiling (send to native PT speaker for review if unsure)

---

## Dev Notes

### Technical Architecture

1. **Two Entry Points:**
   - **Titular (`/configuracoes/direitos/acessos`):** Authenticated route in `(staff)` layout
   - **Encarregado (`/direitos/[token]/acessos`):** Public route with token validation

2. **Data Flow:**
   - Client → Server Action `getAuditLogForSubject()`
   - Server Action → Query `audit_logs` table with RLS filter
   - RLS ensures: titular sees only own logs, Encarregado sees child's logs (via token verification)
   - Returns: list of entries + actor cache (for display)

3. **Pagination:**
   - Client-side state: `currentPage` number
   - Server-side fetch: `LIMIT 50 OFFSET (page-1)*50`
   - No infinite scroll (better a11y via explicit navigation)

4. **Export Integration:**
   - Button calls Story 3.6 `requestDataExportForSelf()` or `requestDataExportByToken(token)`
   - Returns immediate download (≤5MB) or async email (>5MB)
   - Exported file includes **all subject data**, not just audit logs

5. **RLS Enforcement:**
   - DB table `audit_logs` has RLS policy (Story 1.12)
   - Supabase RLS enforces at query level (automatically filters rows)
   - Server Action does NOT need to check RLS manually — DB handles it

---

### Dependencies & Interactions

**Must Complete Before 3.12:**
- ✅ Story 1.12: `audit_logs` table + RLS policies
- ✅ Story 3.11: `auditedRead()` wrapper (populates audit_logs)
- ✅ Story 3.6: Export infrastructure (export button uses this)
- ✅ Story 1.8: Design system tokens (dark mode, colors, button variants)
- ✅ Story 1.9: Route groups (`(staff)`, `/direitos/` public route)

**Files to Create:**
- `src/lib/actions/audit-visibility.ts` (Server Action)
- `src/lib/i18n/audit-actions.ts` (translation map)
- `src/lib/format/date-time.ts` (PT-PT date formatting)
- `src/components/domain/AuditLogList.tsx` (main list component)
- `src/components/patterns/Pagination.tsx` (reusable pagination)
- `src/app/(staff)/configuracoes/direitos/acessos/page.tsx` (titular route)
- `src/app/direitos/[token]/acessos/page.tsx` (Encarregado route)
- Tests for each component + integration tests
- `docs/GDPR/subject-visibility.md` (documentation)

**Files to Modify:**
- `.eslintrc.json` (if custom rule from Story 3.11 applies)
- No changes to existing components (new composition)

---

### Testing Standards Summary

**Unit Tests:**
- Action translations (snapshot test of mapping)
- Date-time formatting (PT-PT locale)
- Pagination logic

**Integration Tests:**
- RLS isolation: real DB seeding, verify titular/Encarregado constraints
- Token validation: valid/invalid/expired token scenarios
- 12-month filter: old logs not returned

**Manual Tests (pre-review):**
- Titular route: view own logs, pagination works, export button visible
- Encarregado route: valid token shows child logs, invalid token shows error
- Empty case: new subject with no accesses
- Dark mode: colors render correctly
- Mobile: responsive layout, touch targets ≥44px
- Accessibility: Tab navigation, axe-core zero violations

---

## References

- **FR50:** "Sistema regista log auditável de cada acesso a dados de saúde por staff (quem, o quê, quando), retido por 12 meses." — [Source: epics.md](epics.md#L105)
- **FR51:** "Titular pode consultar quem acedeu aos seus dados de saúde nos últimos 12 meses." — [Source: epics.md](epics.md#L106)
- **NFR20:** "Logs de acesso a dados de saúde retêm-se por 12 meses, auditáveis pelo titular." — [Source: epics.md](epics.md#L145)
- **NFR36–NFR44:** Accessibility (WCAG 2.1 AA) — [Source: epics.md](epics.md#L165-L176)
- **UX-DR8:** `<EmptyState>` pattern — [Source: epics.md](epics.md#L409)
- **UX-DR30:** Button hierarchy — [Source: epics.md](epics.md#L440)
- **UX-DR36:** Date-time formatting pt-PT — [Source: epics.md](epics.md#L446)
- **UX-DR38:** Copy tone guidelines — [Source: epics.md](epics.md#L448)
- **Story 1.12:** "Audit Logs & Telemetry Foundation Tables" — Creates `audit_logs` table, RLS policies, pg_cron retention
- **Story 3.6:** "Right to Export — CSV Download" — Export infrastructure (Edge Function + Brevo email)
- **Story 3.11:** "Health Data Access Audit Logging — Auto-Wrapper for Staff Reads" — Populates `audit_logs` via `auditedRead()`

---

## Dependency Status

✅ **Story 1.12** (audit_logs table, pg_cron job, RLS policies) — DONE  
✅ **Story 3.6** (export infrastructure) — DONE  
✅ **Story 3.11** (auditedRead wrapper) — READY-FOR-DEV  
🔄 **Story 3.12** (subject visibility) — READY-FOR-DEV

---

## Epic 3 Progress

| Story | Status | Notes |
|-------|--------|-------|
| 3-1 | done | Privacy policy versioning |
| 3-2 | done | Parental consent schema |
| 3-3 | done | Email send + landing page |
| 3-4 | done | Reminders + staff alert |
| 3-5 | done | Subject rights hub routing |
| 3-6 | done | Right to export CSV |
| 3-7 | done | Right to erasure cascade |
| 3-8 | done | Right to rectification |
| 3-9 | done | Right to restrict processing |
| 3-10 | ready-for-dev | Right to withdraw consent |
| 3-11 | ready-for-dev | Health data audit logging (wrapper) |
| 3-12 | **ready-for-dev** | **Subject visibility (this story)** |

**Epic 3 is 12/12 stories ready or in-progress.**

---

## Dev Agent Record

### Checklist for Dev Agent

- [ ] Read all ACs and understand the two-route architecture (titular + Encarregado)
- [ ] Create Server Action `getAuditLogForSubject()` with RLS enforcement
- [ ] Create translation maps for actions and target_kinds (PT-PT)
- [ ] Implement date-time formatter (PT-PT locale via date-fns)
- [ ] Build Client Component `<AuditLogList>` with entry display, pagination, export button
- [ ] Build Pagination component `<Pagination>` (reusable pattern)
- [ ] Create titular route `/configuracoes/direitos/acessos/page.tsx`
- [ ] Create Encarregado route `/direitos/[token]/acessos/page.tsx`
- [ ] Write unit tests: translations, formatting, component render
- [ ] Write integration tests: RLS isolation, token validation, 12-month filter
- [ ] Test a11y: axe-core zero violations, dark mode, responsive layout
- [ ] Verify export button integration with Story 3.6
- [ ] Create documentation: `docs/GDPR/subject-visibility.md`
- [ ] Final copy review: all translations ≤15 words, B1 CEFR ceiling
- [ ] Mark story as `review` and run `code-review` for second opinion

---

## Story Status

**Status:** ready-for-dev  
**Last Updated:** 2026-05-22  
**Next Steps:** Run `dev-story` to begin implementation. After complete, run `code-review` for adversarial review.
