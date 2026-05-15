# Code Review Triage — Story 1.7 MFA Implementation

**Review Date:** 2026-05-15  
**Story:** 1-7-optional-mfa-for-treinador-analista  
**Review Mode:** Full (with spec)  
**Layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor  
**Total Raw Findings:** 30 (12 + 14 + 4)

---

## CONSOLIDATED & DEDUPLICATED FINDINGS

### CATEGORY: PATCH (Fixable, Unambiguous)

| ID | Source | Title | Location | Detail |
|----|--------|-------|----------|--------|
| 1 | blind+edge | Missing null-safety checks on AAL and factors data | `login/page.tsx:64-73` | `getAuthenticatorAssuranceLevel()` and `listFactors()` may return `{ data: null }`. Current code uses optional chaining but doesn't handle the case where `aalData` is null (silent success despite MFA requirement) or `factorsData?.totp` is undefined (TypeError on `.find()`). **Fix:** Check if aalData and factorsData are null before accessing nested properties. Show explicit error if either is null. |
| 2 | blind+edge | No validation of TOTP code length before submission | `login/page.tsx:104-114` | Form allows empty `mfaCode` string submission to `challengeAndVerify()`. Client-side onChange strips non-digits but doesn't enforce 6-digit minimum before form submit. **Fix:** Add client-side validation: `if (mfaCode.length !== 6)` before calling Supabase API. |
| 3 | blind+edge | Generic error handling masks critical API failures | `login/page.tsx:84-85, 117-118` | Both `handlePasswordSubmit()` and `handleMFASubmit()` catch all exceptions from `getAuthenticatorAssuranceLevel()`, `listFactors()`, `challengeAndVerify()` and show generic messages ("Email ou password incorretos", "Erro inesperado"). Network timeouts, CORS errors, Supabase downtime are indistinguishable from bad credentials. **Fix:** Separate catch blocks for each API call with specific error messages. Log actual error details server-side for debugging. |
| 4 | blind | Missing TOTP code auto-clear on successful verification | `login/page.tsx:116` | After `challengeAndVerify()` succeeds, `mfaCode` state is not cleared. If `redirectToHome()` throws and bounces back, the code lingers in state and is exposed to React DevTools. **Fix:** Clear `mfaCode` immediately before/after successful redirect: `setMfaCode("")` or use `useEffect` cleanup. |
| 5 | blind | No rate limiting on MFA verification attempts | `login/page.tsx:104-114` | `handleMFASubmit()` allows unlimited code submissions without throttling. 6-digit TOTP has ~1M combinations; brute force is feasible in seconds. **Fix:** Add client-side throttle (e.g., disable submit button for 2s after failure) and ensure Supabase enforces server-side rate limits. Document rate-limit behavior. |
| 6 | blind+edge | Incomplete state reset on back-navigation | `login/page.tsx:241-245` | "Voltar ao login" button resets stage/error/mfaCode/factorId but does NOT clear email/password fields. User can accidentally re-submit previous credentials if they fat-finger submit. **Fix:** Also call `setEmail("")` and `setPassword("")` in the back button's onClick handler. |
| 7 | edge | Stale factorId after session expiry | `login/page.tsx:96-100, 241-245` | If user navigates away mid-MFA and the session expires (Supabase token invalid), factorId remains set in state. Subsequent `handleMFASubmit()` with stale factor ID will reject with cryptic error. **Fix:** Validate factorId against current session AAL before attempting verify. Show clear "Session expired, sign in again" error if AAL has dropped. |
| 8 | blind | Plaintext TOTP code held in state without forced clear | `login/page.tsx:26` | `mfaCode` is only cleared on error (line 111), not on success. Sensitive code lingers in React state. **Fix:** Use `useEffect()` or explicit cleanup to clear code after submit (success or timeout). Consider using `useRef` for sensitive data instead of useState. |
| 9 | blind+edge | Missing error handling for redirectToHome failures | `login/page.tsx:39, 85, 116` | `redirectToHome()` calls `getCurrentUserWithRole()` and `router.push()`. If either throws, the exception propagates to caller's catch block, which masks it as password error or generic error. If `router.push()` fails in MFA stage, isLoading is never reset, leaving UI in loading state. **Fix:** Wrap `redirectToHome()` calls in explicit try-catch. Distinguish navigation errors from auth errors. Always ensure isLoading is reset in error paths. |
| 10 | blind | No timeout on MFA challenge stage | `login/page.tsx:18` | Once `stage === "mfa"` is set, there's no expiry timer. User can leave the form open for hours and submit a TOTP code that may no longer be valid (time-based OTP). **Fix:** Implement timeout (e.g., 5 min) on MFA stage. Show "Code expired, sign in again" if exceeded. Reset to password stage and clear mfaCode. |
| 11 | blind | Session fixation: factorId persists across back-navigation | `login/page.tsx:241-245` | User clicks back, resets state, signs in as different account, but original factorId remains. New account's verify attempt may interact with old factorId. **Fix:** Ensure setFactorId(null) is called on back button (already done at line 245). Add session ID validation before use. |
| 12 | auditor | Role visibility check uses wrong role value | `login/page.tsx:40` (and configuracoes/seguranca/page.tsx) | Code checks `role !== "player"` but database may store role as `"jogador"` (Portuguese). Test suite validates logic at string level but doesn't validate against actual seed data role names from Story 1.3. **Fix:** Verify role enum value matches database schema. Use consistent English or Portuguese role names. Check Story 1.3 seed data and update to match (or use enum constants). |
| 13 | blind | Empty TOTP factors array not handled | `login/page.tsx:70-73` | Code finds first verified TOTP factor but doesn't error if `factorsData?.totp` is undefined or empty. Logic silently logs user in despite server requiring AAL2, bypassing MFA entirely. **Fix:** Explicitly check `if (!factorsData?.totp || factorsData.totp.length === 0)` and show error: "MFA required but no factors enrolled. Contact admin." |
| 14 | edge | Race condition: AAL requirement between checks | `login/page.tsx:64-73` | Between `getAuthenticatorAssuranceLevel()` call (line 64) and `listFactors()` call (line 70), server's MFA requirement could change (concurrent unenroll). User finds no verified factor and silently logs in despite MFA requirement. **Fix:** Perform checks atomically or re-verify AAL after listing factors. If AAL mismatch detected, show "MFA requirement changed, sign in again." |

---

### CATEGORY: DECISION_NEEDED (Requires Human Input)

| ID | Source | Title | Location | Question |
|----|--------|-------|----------|----------|
| D1 | blind | Missing `challenge()` call before `challengeAndVerify()` | `login/page.tsx:104-107` | Spec appendix (lines 164-174) mentions separate `challenge()` → `verifyOtp()` flow. Current code calls `challengeAndVerify()` directly. **Question:** Does Supabase' `challengeAndVerify()` combine both steps, or should they be separate? Check Supabase v2.105.4 docs. |
| D2 | auditor | AC #5 Email notification on MFA disable not verified | `actions.ts` (disableMFAAction) | AC #5 requires email sent on MFA disable. Code calls `unenroll()` but doesn't verify/test email delivery. **Question:** Does Supabase Auth's `mfa.unenroll()` auto-send the notification, or must an Edge Function be created? Confirm with Supabase docs or test in Supabase project. |

---

### CATEGORY: DEFER (Pre-existing, Out of Scope)

| ID | Source | Title | Reason |
|----|--------|-------|--------|
| DF1 | auditor | AC #7 Token refresh AAL preservation not tested | AC #7 depends on Supabase Auth's automatic JWT claim preservation after token refresh. Tests validate `getAuthenticatorAssuranceLevel()` but don't test middleware refresh. This is a Story 1.6 concern (multi-tenant RLS), not 1.7. Defer testing to 1.6 integration tests. |
| DF2 | blind | Proxy.ts MFA enforcement stub unreachable (Growth phase) | MFA enforcement documented but not implemented (Growth phase, AC #6). By design. No action needed for MVP. |

---

### CATEGORY: DISMISS (False Positive / Handled Elsewhere)

| ID | Source | Title | Reason |
|----|--------|-------|--------|
| DM1 | edge | Dual `createClient()` calls (password stage and MFA stage) | Unlikely in practice. Both calls use same environment and IndexedDB cache. Session is consistent within same browser tab. Low risk. |
| DM2 | auditor | AC #6 Enforcement incomplete (Growth phase) | By design. AC #6 is Growth phase. MVP scope leaves enforcement optional. Not a violation. |

---

## SUMMARY

- **Total Findings:** 30 raw → 20 consolidated (after dedup)
- **Patches:** 14 (fixable without decision)
- **Decision Needed:** 2 (requires confirmation)
- **Defer:** 2 (pre-existing, out of scope)
- **Dismiss:** 2 (false positive)
- **Layers:** All 3 completed (no failures)
- **Review Severity:** 🔴 **High** — 14 actionable patches, 2 design clarifications needed

---

## NEXT STEPS

1. **Clarify Decisions D1 & D2** with developer or Supabase docs
2. **Implement Patches 1-14** (estimated 2-3 hours)
3. **Re-test** after patches (unit + integration)
4. **Re-run review** if changes are significant
