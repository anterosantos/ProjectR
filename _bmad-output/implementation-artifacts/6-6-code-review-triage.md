# Code Review Triage — Story 6.6

**Review Mode:** full (com spec)  
**Date:** 2026-05-31  
**Layers:** Acceptance Auditor ✅ | Blind Hunter ✅ | Edge Case Hunter ✅  
**Layer Failures:** None

---

## Findings Consolidados & Triados

### 🔴 CRÍTICOS (2 findings)

#### 1. **Session null → window check completamente skipped**
- **ID:** 1-CRIT
- **Source:** edge
- **Location:** `lib/actions/events.ts:197-205` (deleteMatchEvent)
- **Severity:** CRITICAL — violação AC#3 (server-side enforcement)
- **Description:**  
  Window check está dentro de `if (session) { ... }`. Se session não é encontrada (raro: deletada do DB), a verificação nunca ocorre. Evento pode ser apagado indefinidamente após a janela fechar.
- **Passo-a-passo:** User tenta apagar evento → query session retorna null → if (session) avalia false → window check completamente skipped → delete permitido fora da janela
- **Category:** `patch`
- **Fix:** Mover window check para ANTES ou lançar erro se session não encontrado:
  ```typescript
  const { data: session } = await serviceRole.from("sessions")...;
  if (!session) {
    return err({ code: "not_found", message: "Sessão não encontrada." });
  }
  const windowHours = await getEventEditWindowHours(clubId);
  if (!isEditWindowOpen(session.scheduled_at, session.duration_min ?? 90, windowHours)) {
    return err({ code: "forbidden", message: "Janela de edição encerrada." });
  }
  ```

---

#### 2. **Inconsistência de defaults duration_min (0 vs 90) entre locais**
- **ID:** 2-CRIT
- **Source:** blind+edge
- **Locations:** 
  - `lib/actions/events.ts:199` (deleteMatchEvent) — `?? 0`
  - `lib/actions/events.ts:431` (updateMatchEvent) — `?? 0`
  - `app/(staff)/sessoes/[id]/captura/page.tsx:57` — `?? 90`
  - `app/(staff)/sessoes/[id]/eventos/page.tsx:58` — `?? 0`
- **Severity:** CRITICAL — dados integrity
- **Description:**  
  Mesma sessão com `duration_min = null` gera **deadlines diferentes** dependendo de qual rota acessa. Botões podem estar enabled em `/captura` e disabled em `/eventos` para o mesmo evento.
- **Impacto:** AC#3 (UI consistency) violada; AC#7 (EventChip) comportamento inconsistente.
- **Category:** `patch`
- **Fix:** Padronizar em todos os 4 locais. Recomendado: `?? 90` (padrão de session duration).
  ```typescript
  // Todos os 4 locais:
  isEditWindowOpen(session.scheduled_at, session.duration_min ?? 90, windowHours)
  ```

---

### 🟠 MÉDIOS (7 findings)

#### 3. **Missing Zod validation em notification_settings query (page.tsx)**
- **ID:** 3-MED
- **Source:** blind
- **Location:** `app/(staff)/sessoes/[id]/captura/page.tsx:56`
- **Severity:** MEDIUM — type safety
- **Description:**  
  Type cast `as { event_edit_window_hours?: number } | null` é unsafe. Se Supabase retorna estrutura inesperada ou tipo errado, TypeScript não valida.
- **Example:** `event_edit_window_hours: "24"` (string em vez de number) passa a validação type cast.
- **Category:** `patch`
- **Fix:** Usar Zod schema:
  ```typescript
  const settingsSchema = z.object({ event_edit_window_hours: z.number().int().min(1).max(168) });
  const validSettings = settingsSchema.safeParse(settings);
  const windowHours = validSettings.success ? validSettings.data.event_edit_window_hours : 24;
  ```

---

#### 4. **Fire-and-forget logAccess undocumented & potentially silent failures**
- **ID:** 4-MED
- **Source:** blind+edge
- **Locations:** 
  - `lib/actions/events.ts:224` (deleteMatchEvent)
  - `lib/actions/events.ts:456` (updateMatchEvent)
- **Severity:** MEDIUM — auditability/reliability
- **Description:**  
  `void logAccess(...)` suppresses Promise. Se logAccess falha (quota exceeded, network error), nenhuma retry e nenhum feedback ao caller. Audit log insertion pode falhar silenciosamente.
- **Category:** `patch` (ou `decision_needed` se quiser mudar strategy)
- **Fix Option A — Document as fire-and-forget:**
  ```typescript
  // Fire-and-forget audit logging — failures do not block deletion.
  // Monitor logAccess errors separately via error tracking system.
  void logAccess("event.deleted", "match_event", id);
  ```
- **Fix Option B — Add logging of failures:**
  ```typescript
  logAccess("event.deleted", "match_event", id).catch((err) => {
    logger.error("Audit log failed for event delete", { eventId: id, error: err });
  });
  ```

---

#### 5. **Race condition: dual deletes create duplicate audit log entries**
- **ID:** 5-MED
- **Source:** edge
- **Location:** `lib/actions/events.ts:197-226` (deleteMatchEvent)
- **Severity:** MEDIUM — auditability
- **Description:**  
  Two simultaneous delete requests for same event:
  1. Both pass `if (!existing)` check (line 181)
  2. Both pass window check
  3. Both execute `.update({ is_deleted: true, ... })` (idempotent)
  4. Both complete successfully
  5. Both call `logAccess('event.deleted', ...)` → **two audit log entries for one delete**
- **Impacto:** Audit log has duplicates; analyst confused.
- **Category:** `patch`
- **Fix:** Check `existing.is_deleted === true` BEFORE window check:
  ```typescript
  if (!existing || existing.is_deleted === true) {
    return err({ code: "not_found", message: "Evento já foi apagado." });
  }
  // Then proceed with window check
  ```

---

#### 6. **Timezone validation — scheduled_at must be UTC**
- **ID:** 6-MED
- **Source:** blind+edge
- **Location:** `lib/utils/match-events.ts:14-20`
- **Severity:** MEDIUM — correctness (depends on data)
- **Description:**  
  `isEditWindowOpen` assumes `scheduled_at` is pure UTC ISO string. If DB stores with timezone offset (e.g., "2026-05-31T10:00:00+02:00"), parsing may differ. Currently `new Date(...).getTime()` converts to UTC epoch correctly, but assumption not documented.
- **Category:** `patch` (add validation/documentation)
- **Fix:**
  ```typescript
  export function isEditWindowOpen(
    sessionScheduledAt: string,  // Must be ISO string in UTC (e.g., "2026-05-31T10:00:00Z")
    sessionDurationMin: number,
    windowHours: number
  ): boolean {
    // ...
  }
  ```
  OR validate:
  ```typescript
  const scheduled = new Date(sessionScheduledAt);
  if (!sessionScheduledAt.endsWith('Z')) {
    throw new Error("scheduled_at must be in UTC (suffix 'Z')");
  }
  ```

---

#### 7. **Missing EventsReviewPanel test file (AC#8)**
- **ID:** 7-MED
- **Source:** auditor
- **Location:** Not created: `sparta/src/__tests__/.../events-review-panel.test.tsx`
- **Severity:** MEDIUM — test coverage
- **Description:**  
  AC#8 explicitly requires tests for "EventsReviewPanel: renderiza eventos, botões desactivados fora da janela". Component modified but no dedicated test file created. Only EventChip tests updated (4 testes novos). EventsReviewPanel interaction logic (edit state, optimistic delete, error rollback) untested.
- **Category:** `patch`
- **Fix:** Create `sparta/src/__tests__/components/domain/match-event-capture/events-review-panel.test.tsx` with:
  - Render events list
  - Buttons disabled when `isWithinEditWindow=false`
  - Edit state management
  - Delete optimistic update + rollback
  - Empty state

---

#### 8. **Incomplete documentation — Spec marks AC#6 form field as pending**
- **ID:** 8-MED
- **Source:** auditor
- **Location:** Spec line 170 (marked `[ ]`) vs code is complete
- **Severity:** MEDIUM — documentation
- **Description:**  
  Spec artifact shows Task 7 (notification-settings-form) with incomplete checkbox, but code has fully working "Janela de edição de eventos (horas)" field (lines 170-191). No code issue — documentation mismatch only.
- **Category:** `defer` (not actionable in code review; update spec artifact separately)

---

### 🟡 BAIXOS (16 findings) — DISMISS

#### 9. **EventChip confirmation state race — UX inconsistency**
- **ID:** 9-LOW
- **Source:** blind
- **Location:** `event-chip.tsx:93-98`
- **Category:** `dismiss`
- **Reason:** Defensive code present; edge case rare in practice. UI state rollback on error works correctly.

#### 10. **Console.warn instead of logger.warn**
- **ID:** 10-LOW
- **Source:** blind
- **Location:** `lib/actions/events.ts:289`
- **Category:** `dismiss`
- **Reason:** Acceptable for this codebase; logger integration is optional enhancement.

#### 11. **notification_settings fallback fragile (type casting)**
- **ID:** 11-LOW
- **Source:** blind
- **Location:** `lib/actions/events.ts:143-152`
- **Category:** `patch` (subsumed by Finding #3 — Zod validation)
- **Reason:** Already covered by Finding #3 (missing Zod); single fix addresses both.

#### 12. **Empty playerIds array — .in() with empty array**
- **ID:** 12-LOW
- **Source:** edge
- **Location:** `lib/actions/events.ts:357`
- **Category:** `dismiss`
- **Reason:** Functionally correct (returns 0 rows as expected); performance impact negligible.

#### 13. **EventChip disabled state tooltip mobile UX**
- **ID:** 13-LOW
- **Source:** edge
- **Location:** `event-chip.tsx:132-142`
- **Category:** `dismiss`
- **Reason:** UX degraded but functional; mobile optimization is separate concern.

#### 14. **Migração CHECK constraint IF NOT EXISTS silent on rollback**
- **ID:** 14-LOW
- **Source:** edge
- **Location:** `supabase/migrations/000280_session_edit_window.sql:5-7`
- **Category:** `dismiss`
- **Reason:** Unlikely in practice; migration design is sound.

#### 15. **EventsReviewPanel edição sem optimistic update/refetch**
- **ID:** 15-LOW
- **Source:** edge
- **Location:** `app/(staff)/sessoes/[id]/eventos/events-review-panel.tsx:84-110`
- **Category:** `dismiss`
- **Reason:** UX consistent; incomplete refetch is separate enhancement (not required by AC#2/3).

#### 16. **Audit log missing session_id in payload**
- **ID:** 16-LOW
- **Source:** edge
- **Location:** `lib/actions/events.ts:456-462`
- **Category:** `patch` (context enhancement)
- **Fix:** Add session_id to logAccess payload:
  ```typescript
  void logAccess("event.edited", "match_event", eventId, {
    session_id: existing.session_id,
    before: { action: existing.action, zone: existing.zone },
    after: { action: validated.data.action ?? existing.action, zone: validated.data.zone ?? existing.zone },
  });
  ```

#### 17–24. **Additional LOW findings (dismissed)**
- Timezone assumption (documented in Finding #6)
- Type safety improvements (subsumed by Finding #3)
- Session boundary checks (code correct, dismissed)
- SQL injection (properly validated, dismissed)
- Promise handling patterns (acceptable, dismissed)
- lineupRows type casting (defensive, correct, dismissed)
- Empty events handling (correct, dismissed)
- Deduplication: 25 raw findings → 16 unique after merging

---

## 📋 Triage Summary

| Category | Count | Status |
|----------|-------|--------|
| **CRITICAL (must fix)** | 2 | `patch` |
| **MEDIUM (should fix)** | 6 | `patch` (5) + `defer` (1) |
| **LOW (nice-to-have)** | 16 | `dismiss` (14) + `patch` (2) |
| **TOTAL FINDINGS** | 25 | — |
| **ACTIONABLE (patch/decision)** | 9 | — |
| **DEFERRED** | 1 | — |
| **DISMISSED** | 15 | — |

---

## Next: Step 4 — Present Findings to User

**Critical Path:**
1. Finding #1 — Session null bypass (MUST fix)
2. Finding #2 — Duration_min defaults (MUST fix)
3. Finding #3 — Zod validation (SHOULD fix)
4. Finding #4 — logAccess documentation (SHOULD fix)
5. Finding #5 — Race condition dual deletes (SHOULD fix)
6. Finding #6 — Timezone documentation (SHOULD fix)
7. Finding #7 — EventsReviewPanel tests (SHOULD fix)

**Deferred:**
- Finding #8 — Spec artifact update (out of scope)

**Dismissed:**
- 15 findings (UX, minor optimizations, edge cases already handled, assumptions correct)
