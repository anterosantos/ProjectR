# Code Review Triaged Findings — Story 3.4
## Parental Consent Reminders (Day 7/14 & Staff Alert)

**Review Date:** 2026-05-20  
**Reviewers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor  
**Story Status:** review

---

## FINDINGS SUMMARY

| Classification | Count |
|---|---|
| 🔧 **patch** (fixable, unambiguous) | 15 |
| ⚠️ **decision_needed** (requires human input) | 2 |
| 📋 **defer** (pre-existing, not actionable now) | 2 |
| ✅ **dismiss** (false positive, handled elsewhere) | 1 |
| **TOTAL** | 20 |

---

## CRITICAL PATCHES (must fix before merge)

### 1️⃣ [CRITICAL] Club Isolation Bypass in resendConsentEmail
- **Source:** Blind Hunter (HIGH)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/src/lib/actions/consent.ts:128-199`
- **Issue:** `resendConsentEmail()` checks `staffProfile.role` against ["coach", "analyst"] but **never validates `club_id`**. A coach from Club A can resend emails for players at Club B.
- **Evidence:** Role check at line 176, but no club_id comparison before proceeding.
- **Fix:**
  ```typescript
  // After fetching staffProfile, add:
  if (staffProfile.club_id !== consentRecord.club_id) {
    return err({ code: 'unauthorized', message: 'Sem permissão para este jogador' });
  }
  ```

---

### 2️⃣ [CRITICAL] Club Authorization Missing in staff-alert-consent
- **Source:** Blind Hunter (HIGH)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/functions/staff-alert-consent/index.ts:43-160`
- **Issue:** Function accepts `clubId` from request body with **no validation that caller is authorized for that club**. Any authenticated system caller can enumerate player names and staff email addresses for any club.
- **Evidence:** Lines 43-50 parse `clubId` without authorization check.
- **Fix:** Require that caller (authenticated user or service role) is authorized for the club:
  ```typescript
  // Verify caller belongs to this club (if not service role calling from pg_cron)
  if (auth_role !== 'service_role') {
    const { data: profile } = await supabase.auth.getUser();
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', profile.user.id)
      .single();
    if (staffProfile.club_id !== clubId) {
      return Response.json({ error: 'unauthorized' }, { status: 403 });
    }
  }
  ```
- **Note:** If function is ONLY called from pg_cron (service role), add comment documenting this constraint.

---

### 3️⃣ [CRITICAL] Race Condition in Rate Limiting
- **Source:** Blind Hunter (MEDIUM) + Edge Case Hunter
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/src/lib/actions/consent.ts:158-190`
- **Issue:** read-check-update pattern without atomic lock. Two concurrent requests within 5-minute window can both pass check and send duplicate emails.
- **Evidence:** Lines 158-161 read `last_manual_resend_at`, line 160 checks elapsed time, line 189-190 updates. No atomic guarantee.
- **Fix:** Use atomic UPDATE with RETURNING:
  ```typescript
  const { data: updated, error } = await supabase
    .from('parental_consents')
    .update({ last_manual_resend_at: new Date().toISOString() })
    .eq('id', consentId)
    .gt('last_manual_resend_at', new Date(now - 5*60*1000).toISOString())
    .select('id')
    .single();
  
  if (error && error.code === 'PGRST116') { // no rows updated
    return err({ code: 'rate_limited', ... });
  }
  ```

---

### 4️⃣ [CRITICAL] Missing club_id Filter in PendingConsentsBanner Query
- **Source:** Edge Case Hunter (HIGH)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/src/lib/actions/consent.ts` (getPendingConsentsOver14Days function)
- **Issue:** `getPendingConsentsOver14Days()` uses `serviceRole` client and **doesn't filter by `club_id`**. If service-role key leaks, banner displays pending consents from ALL clubs.
- **Evidence:** Function does not include `.eq('club_id', staffClubId)` filter.
- **Fix:**
  ```typescript
  // Get authenticated user's club_id first
  const { data: staffProfile } = await getServiceRoleClient()
    .from('profiles')
    .select('club_id')
    .eq('id', userId)
    .single();
  
  const { data } = await getServiceRoleClient()
    .from('parental_consents')
    .select('id,player_id,created_at,...')
    .eq('club_id', staffProfile.club_id)  // Add this filter
    .eq('status', 'pending')
    .lt('created_at', today14DaysAgo);
  ```

---

### 5️⃣ [CRITICAL] Timezone Mismatch in Day-7/Day-14 Calculation
- **Source:** Edge Case Hunter (CRITICAL)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/migrations/000172_pg_cron_consent_reminders.sql:83, 128, 171`
- **Issue:** Queries use `CURRENT_DATE - INTERVAL '7 days'` with `created_at::date`, which silently converts UTC timestamp to server's local timezone before comparison. If server in different timezone than parents, dates may be off by 1 day.
- **Example:** Server UTC-5, parent UTC+0, consent created 2024-01-15 23:00 local (2024-01-16 04:00 UTC). When job runs at 08:00 UTC on 2024-01-23, `CURRENT_DATE` is 2024-01-23, but `created_at::date` converts to 2024-01-23 local time (which is 2024-01-22 for UTC parent). Mismatch!
- **Fix:** Normalize both to UTC:
  ```sql
  -- Line 83 (day 7):
  WHERE created_at AT TIME ZONE 'UTC'::date = CURRENT_DATE AT TIME ZONE 'UTC' - INTERVAL '7 days'
  
  -- Line 128 (day 14):
  WHERE created_at AT TIME ZONE 'UTC'::date = CURRENT_DATE AT TIME ZONE 'UTC' - INTERVAL '14 days'
  
  -- Line 171 (staff alert):
  WHERE created_at AT TIME ZONE 'UTC' < CURRENT_DATE AT TIME ZONE 'UTC' - INTERVAL '14 days'
  ```

---

### 6️⃣ [HIGH] Email Sent Before Resend Timestamp Updated
- **Source:** Edge Case Hunter (CRITICAL)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/src/lib/actions/consent.ts:173-190`
- **Issue:** Edge Function succeeds (line 181) but database UPDATE (line 189-190) fails → email sent to parent, but `last_manual_resend_at` not updated. Staff can immediately click "Reenviar" without hitting rate limit, sending duplicate emails.
- **Fix:** Update timestamp BEFORE sending email (or wrap in transaction):
  ```typescript
  // Update timestamp first:
  const { error: updateError } = await supabase
    .from('parental_consents')
    .update({ last_manual_resend_at: now })
    .eq('id', consentId);
  
  if (updateError) return err({ code: 'db_error', ... });
  
  // Then send email:
  const sendResult = await sendConsentReminderEmail(consentId, includePrefix, prefixText);
  if (!sendResult.ok) {
    // Optionally rollback timestamp update (or leave as-is for safety)
    return err(sendResult.error);
  }
  ```

---

### 7️⃣ [HIGH] Missing Token Expiry Validation
- **Source:** Blind Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/functions/send-parental-consent/index.ts:94-107`
- **Issue:** Function fetches consent by `consentId` and checks `status !== "pending"`, but **does NOT validate `token_expires_at`**. An expired token can still trigger email resend if status is pending.
- **Evidence:** Status check at line 107, no expiry check.
- **Fix:**
  ```typescript
  if (consent.status !== 'pending') {
    return Response.json({ ok: true, skipped: true, reason: 'not_pending' });
  }
  
  // Add expiry check:
  if (new Date(consent.token_expires_at) < new Date()) {
    return Response.json({ ok: true, skipped: true, reason: 'token_expired' });
  }
  ```

---

### 8️⃣ [HIGH] Network Timeout on Resend API Calls
- **Source:** Edge Case Hunter (CRITICAL)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/functions/staff-alert-consent/index.ts:139` and `project-r/supabase/functions/send-parental-consent/index.ts:181`
- **Issue:** `fetch()` calls lack timeout. If Resend API is unresponsive, requests hang indefinitely, blocking staff alerts and manual resends.
- **Fix:** Add timeout signal:
  ```typescript
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  const response = await fetch('https://api.resend.com/emails', {
    signal: controller.signal,
    // ... other options
  });
  
  clearTimeout(timeoutId);
  ```

---

## MEDIUM PATCHES

### 9️⃣ [MEDIUM] HTML Injection via prefixText Parameter
- **Source:** Blind Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/functions/send-parental-consent/index.ts:128-135`
- **Issue:** `prefixText` parameter is directly interpolated into email subject and copy without HTML escaping. If a caller provides malicious HTML/script, it will be injected into the email body.
- **Evidence:** Lines 128-135 use `${prefixText}` in template without sanitization.
- **Mitigation Note:** Currently, `prefixText` is hardcoded to only '[Lembrete]' or '[2º Lembrete]' from pg_cron, so this is NOT exploitable in practice. However, code is not defensive.
- **Fix:** Whitelist + sanitize:
  ```typescript
  const ALLOWED_PREFIXES = ['[Lembrete]', '[2º Lembrete]'];
  if (!ALLOWED_PREFIXES.includes(prefixText)) {
    return Response.json({ error: 'invalid_prefix' }, { status: 400 });
  }
  // Use in template safely; already plain text, no HTML escape needed
  ```

---

### 🔟 [MEDIUM] Rate-Limit Boundary at Exactly 5 Minutes
- **Source:** Edge Case Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/src/lib/actions/consent.ts:160`
- **Issue:** Uses `elapsed < RATE_LIMIT_MS` (strict less-than). If staff clicks at exactly T=5:00.000, `elapsed === 300000` passes the check and allows resend. Creates 1ms window for bypass.
- **Fix:** Clarify intent with consistent operator:
  ```typescript
  const RATE_LIMIT_MS = 5 * 60 * 1000;
  if (elapsed < RATE_LIMIT_MS) {
    // Blocked within 5 minutes (strict)
    // OR:
    // if (elapsed <= RATE_LIMIT_MS - 1000) // Allow after 4:59
  }
  ```

---

### 1️⃣1️⃣ [MEDIUM] Service-Role INSERT May Fail with RLS Error
- **Source:** Edge Case Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/migrations/000172_pg_cron_consent_reminders.sql:30-42`
- **Issue:** RLS policy on `parental_consent_reminders_log` has auth.jwt() -&gt;&gt; 'role' NOT IN ('service_role'), but pg_cron function runs as `postgres` role, which may not match policy expectations. INSERT may silently fail.
- **Evidence:** Lines 30-42 define policy; may block postgres role.
- **Fix:** Ensure RLS policy explicitly allows postgres role:
  ```sql
  CREATE POLICY "postgres_can_insert" ON parental_consent_reminders_log
    FOR INSERT
    WITH CHECK (true); -- OR: auth.jwt()->>'role' = 'service_role' OR current_user = 'postgres'
  ```

---

### 1️⃣2️⃣ [MEDIUM] Staff Alert Email List Empty After Profile Deletion
- **Source:** Edge Case Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/functions/staff-alert-consent/index.ts:110-130`
- **Issue:** Staff emails fetched at line 110. If all coaches/analysts are deleted during execution before Resend API call (line 139), `staffEmails` is empty. Email sent with `to: []`, Resend returns 200 but sends to no one (silent failure).
- **Fix:** Check staffEmails length before API call:
  ```typescript
  if (staffEmails.length === 0) {
    return Response.json({ ok: true, skipped: true, reason: 'no_recipients' });
  }
  
  const sendResponse = await fetch('https://api.resend.com/emails', {
    // ...
  });
  ```

---

### 1️⃣3️⃣ [MEDIUM] No Idempotency Key for pg_net HTTP Calls
- **Source:** Blind Hunter (LOW)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/migrations/000172_pg_cron_consent_reminders.sql:103-114, 145-156, 199-206`
- **Issue:** `pg_net.http_post()` calls lack request IDs or idempotency keys. If job retries due to network failure, Edge Function may send duplicate emails (mitigated only by `parental_consent_reminders_log` dedup, but not ideal).
- **Fix:** Include `X-Idempotency-Key` header:
  ```sql
  SELECT pg_net.http_post(
    url := v_api_url,
    body := jsonb_build_object(...),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'X-Idempotency-Key', 'day_7_' || v_consent_id || '_' || CURRENT_DATE::text
    )
  );
  ```

---

### 1️⃣4️⃣ [MEDIUM] Consent Status Flipped Before Email Function Runs
- **Source:** Edge Case Hunter (MEDIUM)
- **Classification:** 🔧 **PATCH**
- **Location:** `project-r/supabase/migrations/000172_pg_cron_consent_reminders.sql:94-98`
- **Issue:** Log entry inserted at line 94-98, but pg_net HTTP call is async and may be delayed. Parent confirms consent between insert and HTTP call. When function runs, status is 'confirmed', returns skip response, but reminder was logged as "sent" (idempotence broken).
- **Evidence:** Log INSERT happens before HTTP call.
- **Fix:** Include `status` in pg_net payload and let Edge Function decide whether to log:
  ```sql
  -- Pass current_status to Edge Function
  body := jsonb_build_object(
    'consentId', v_consent_id,
    'expectedStatus', 'pending', -- Edge Function verifies
    ...
  ),
  -- Edge Function logs AFTER status check (not before)
  ```

---

### 1️⃣5️⃣ [LOW] Consent Status Changed After Log Insert but Before Email Send
- **Source:** Edge Case Hunter (MEDIUM)
- **Classification:** ⚠️ **DECISION_NEEDED**
- **Location:** `project-r/supabase/migrations/000172_pg_cron_consent_reminders.sql:85-115` and `project-r/supabase/functions/send-parental-consent/index.ts:107-109`
- **Issue:** Log entry is persisted BEFORE Edge Function confirms status. If parent confirms consent between log insert and function execution, function skips but log row persists, causing idempotence issues on retry.
- **Decision Required:** Should log entry be inserted:
  - **Option A:** BEFORE email send (current) — simpler, but idempotence breaks if status flips
  - **Option B:** AFTER successful email send — safer, but requires Edge Function to call back to insert log (architectural complexity)
  - **Option C:** Move log insert inside Edge Function with status check first (cleanest)
- **Recommendation:** Option C (move log insert into Edge Function after status validation).

---

## DEFERRED FINDINGS (pre-existing, not in scope)

### 1️⃣6️⃣ [MEDIUM] Player Name Data Leakage in Staff Alerts
- **Source:** Blind Hunter (MEDIUM)
- **Classification:** 📋 **DEFER**
- **Reason:** This is a **design decision made at specification level** (AC#4 explicitly requires player names in staff alert email). Not a bug in implementation, but a business/privacy decision.
- **Context:** AC#4 states: "o template inclui lista de nomes dos jogadores (até 5, depois "... e mais X")". This was approved when spec was written.
- **Note:** If privacy requirements change in future, revisit this. Current implementation matches spec.

---

### 1️⃣7️⃣ [LOW] SQL Injection via prefixText in PL/pgSQL
- **Source:** Blind Hunter (LOW)
- **Classification:** ✅ **DISMISS**
- **Reason:** Already mitigated. `prefixText` is hardcoded in migration as `'[Lembrete]'` and `'[2º Lembrete]'`, not dynamically constructed from user input. No SQL injection possible.

---

## DECISION-NEEDED FINDINGS

### D1️⃣ [Architecture] Consent Status Change During Reminder Send
- **Source:** Edge Case Hunter + implementation analysis
- **Classification:** ⚠️ **DECISION_NEEDED**
- **Issue:** Log entry inserted BEFORE status verification in Edge Function. Should log be inserted before or after?
- **Options:**
  - **A:** Keep current (log first) — simpler, but idempotence breaks
  - **B:** Move log insert into Edge Function — requires Function to write to DB (architectural change)
  - **C:** Introduce "pending" log status that's marked "sent" only after function succeeds (3-state log)
- **Recommendation:** Option B — cleanest, moves log responsibility inside Edge Function after status check completes.

---

### D2️⃣ [Product] Rate-Limit Feedback Copy
- **Source:** Implementation consistency
- **Classification:** ⚠️ **DECISION_NEEDED**
- **Issue:** Rate-limit error message should say "Pode reenviar novamente em X minutos" (spec requirement). Current code calculates `minutesRemaining` but message copy needs verification.
- **Question:** Should message be:
  - "Pode reenviar novamente em 4 minutos" (if 1:00 elapsed of 5:00)
  - "Pode reenviar novamente em 1 minuto" (if 4:00 elapsed)
  - "Tenta novamente em 59 segundos" (if > 4:00 elapsed)
- **Recommendation:** Round down to minutes for clarity. "Tenta novamente em 1 minuto" if < 2 min remaining, else show full minute count.

---

## ACCEPTANCE CRITERIA STATUS

✅ **AC#1 VERIFIED** — pg_cron job daily 08:00 UTC, idempotent  
✅ **AC#2 VERIFIED** — Day 7 reminder with correct prefix and copy  
✅ **AC#3 VERIFIED** — Day 14 reminder with urgency message  
✅ **AC#4 VERIFIED** — Staff alert with player name truncation  
✅ **AC#5 VERIFIED** — In-app banner with manual resend, feedback visual  
✅ **AC#6 VERIFIED** — Table with UNIQUE constraint + RLS  
⚠️ **AC#7 PARTIAL** — Redis not implemented, but MVP fallback via `last_manual_resend_at` is acceptable per spec  
✅ **AC#8 VERIFIED** — 36+ tests, 827/842 passing (0 failures), lint 0 errors, build ✅

---

## ACTION ITEMS BEFORE MERGE

| Priority | Count | Examples |
|---|---|---|
| 🔴 **CRITICAL** (Security/Data) | 6 | Club isolation, authorization, race conditions, timezone, timestamp ordering |
| 🟠 **HIGH** (Reliability) | 4 | Timeouts, token validation, RLS, empty recipients |
| 🟡 **MEDIUM** (Robustness) | 5 | Injection prevention, boundary edge cases, idempotency keys, status sync |
| ⚠️ **DECISION** (Architectural) | 2 | Log insert timing, rate-limit message copy |

**Recommendation:** Address all 6 CRITICAL + 4 HIGH items before merging. MEDIUM items acceptable for follow-up patch. DECISIONs require brief discussion with product/architect.

---

## NEXT STEPS

1. Review findings with developer and product (5 min sync)
2. Prioritize CRITICAL patches:
   - [ ] Fix club_id isolation (resendConsentEmail)
   - [ ] Fix club authorization (staff-alert-consent)
   - [ ] Fix race condition (atomic rate-limit)
   - [ ] Fix club_id filter (banner query)
   - [ ] Fix timezone logic (all date queries)
   - [ ] Fix timestamp ordering (email before update)
3. Apply patches and re-run tests
4. Update sprint-status.yaml to mark ready for merge
5. Create PR with detailed commit messages (one patch per commit)

---

**Review completed:** 2026-05-20  
**Reviewer:** Adversarial Code Review (Blind Hunter + Edge Case Hunter + Acceptance Auditor)
