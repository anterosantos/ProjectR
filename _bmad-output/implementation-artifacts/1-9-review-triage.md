# Story 1.9 Code Review — Triage

**Review Mode:** full (with spec)  
**Failed Layers:** none  
**Total Findings:** 18 (after dedup)

---

## TRIAGED FINDINGS

### 1. ⚠️ PATCH: userRole validation missing (access control bypass)
- **Severity:** CRITICAL
- **Source:** blind+auditor
- **Location:** `sparta/src/proxy.ts:46-62`
- **Issue:** `userRole` may be `undefined`; if both `user_role` and `role` are missing/falsy, line 52 check `userRole in ROLE_ALLOWED_ROUTES` is false, user bypasses all role checks
- **Detail:** Metadata access is unsafe. Cast should be `Record<string, unknown>`, and userRole must be validated before use.
- **Fix:** Add explicit guard: `if (!userRole || !(userRole in ROLE_ALLOWED_ROUTES)) { redirect("/login"); }`
- **Test:** Verify JWT with missing role claim redirects, not passes through

---

### 2. ⚠️ PATCH: .single() throws without error handling
- **Severity:** CRITICAL
- **Source:** edge
- **Location:** `sparta/src/app/page.tsx:16-20` and `sparta/src/app/(staff)/layout.tsx:711-715`
- **Issue:** Supabase `.single()` throws `Error('Multiple rows returned')` if multiple profiles exist (data corruption) or `.single()` throws if zero rows returned
- **Detail:** No try-catch; error bubbles to Next.js error boundary, user sees 500 error
- **Fix:** Wrap in try-catch; if query fails, redirect to login with error boundary explanation, or provide fallback
- **Test:** Mock Supabase to return multiple rows; verify graceful error handling

---

### 3. ⚠️ PATCH: Duplicated role-redirect logic
- **Severity:** HIGH
- **Source:** blind+auditor
- **Location:** `sparta/src/proxy.ts:52-62` (enforcer) vs `sparta/src/app/page.tsx:25-31` (page-level)
- **Issue:** Role checking happens in proxy AND in page.tsx root; if proxy.ts is modified but page.tsx isn't, behavior diverges
- **Detail:** Two sources of truth violate DRY; maintainability risk
- **Fix:** Remove role check from page.tsx; rely only on proxy.ts. Page should assume authenticated and redirect by role via proxy
- **Test:** Verify page.tsx doesn't re-check role; proxy.ts is single source

---

### 4. ⚠️ PATCH: Analyst icon duplication (UX confusion)
- **Severity:** MEDIUM
- **Source:** blind
- **Location:** `sparta/src/components/patterns/BottomTabNav.tsx:37-40`
- **Issue:** "Sessões" and "Tendências" both use `BarChart3` icon; visually identical tabs reduce discoverability
- **Detail:** AC#3 doesn't specify icon requirement, but spec implies distinct visual identity
- **Fix:** Use distinct icon for "Tendências". Options: TrendingUp, BarChart4, LineChart, or Activity
- **Test:** Visual regression test to ensure icons are distinct

---

### 5. ⚠️ PATCH: Role fallback to "player" unsafe
- **Severity:** MEDIUM
- **Source:** blind
- **Location:** `sparta/src/components/patterns/BottomTabNav.tsx:47`
- **Issue:** `const tabs = TAB_CONFIG[role] ?? TAB_CONFIG["player"];` silently downgrades invalid role to "player"
- **Detail:** If role is "admin" or corrupted, component renders player tabs without warning; confusing UX
- **Fix:** Throw error or warn if role not in TAB_CONFIG: `if (!(role in TAB_CONFIG)) throw new Error(...)`
- **Test:** Pass invalid role prop; verify error is thrown or logged

---

### 6. ⚠️ PATCH: Fallback route to "/" (redirect loop risk)
- **Severity:** MEDIUM
- **Source:** blind
- **Location:** `sparta/src/proxy.ts:59`
- **Issue:** `...|| "/"` fallback redirects to root if role not in ROLE_DEFAULT_ROUTES; root then redirects to /login (potential loop)
- **Detail:** Confusing user journey; might create infinite redirects
- **Fix:** Change fallback from "/" to "/login" or throw error
- **Test:** Verify fallback route is /login, not /

---

### 7. ⚠️ PATCH: Missing /configuracoes page
- **Severity:** MEDIUM
- **Source:** blind+auditor
- **Location:** `ROLE_ALLOWED_ROUTES` references `/configuracoes` but no page created
- **Issue:** All roles have `/configuracoes` in allowed routes; users can navigate but get 404
- **Detail:** Broken user journey; spec doesn't explicitly exclude settings from 1.9 scope
- **Fix:** Create `src/app/(player)/configuracoes/page.tsx` and `src/app/(staff)/configuracoes/page.tsx` (placeholder)
- **Test:** Navigate to /configuracoes; verify page renders

---

### 8. 🟡 DECISION_NEEDED: StaffLayout meta hardcoded
- **Severity:** MEDIUM
- **Source:** auditor
- **Location:** `sparta/src/app/(staff)/layout.tsx:729`
- **Issue:** StickyHeader receives hardcoded `meta="Sáb 16:00"`; AC#2 says meta should show contextual info (e.g., day + time)
- **Detail:** Layout can't know current context (which route, what day it is). Should meta come from page props, context, or be computed?
- **Decision:** How should meta be computed? Options:
  - A) Pass from each page as prop via context
  - B) Compute in layout from request context (date, route)
  - C) Remove for MVP (hardcode "Sáb 16:00" as placeholder)
  - D) Generate dynamically from current day of week + session metadata
- **Recommendation:** Accept Option C (placeholder) for 1.9; add dynamic computation in future story

---

### 9. 🟡 DECISION_NEEDED: Sidebar empty (missing TODOs)
- **Severity:** MEDIUM
- **Source:** auditor
- **Location:** `sparta/src/components/patterns/StaffSidebar.tsx:1-20`
- **Issue:** Sidebar is empty placeholder; AC#3 says "will be fully implemented in future stories" but no TODO comments flag what's missing
- **Detail:** Future dev might not know what to add. Spec says sidebar should show same items as tabs (with drill-down readiness)
- **Decision:** Should sidebar have hardcoded placeholder nav items, or stay empty with a TODO comment?
- **Recommendation:** Add TODO comment referencing AC#3 and future story that will implement

---

### 10. ⚠️ PATCH: Type casting safety (userRole)
- **Severity:** MEDIUM
- **Source:** blind
- **Location:** `sparta/src/proxy.ts:45-50`
- **Issue:** `metadata` cast to `Record<string, string>` but userRole read is unsafe; values may not be strings
- **Detail:** If JWT has non-string role, type casting doesn't prevent runtime errors
- **Fix:** Cast to `Record<string, unknown>` and validate: `if (typeof userRole === 'string' && userRole in ROLE_ALLOWED_ROUTES)`
- **Test:** Mock user_metadata with non-string role; verify graceful handling

---

### 11. ⚠️ PATCH: No validation of searchParams (open redirect risk)
- **Severity:** MEDIUM
- **Source:** blind
- **Location:** `sparta/src/proxy.ts:37-40`
- **Issue:** `encodeURIComponent(pathname + searchParams.toString())` doesn't validate param safety; malicious param could bypass URL validation
- **Detail:** returnTo could be crafted to XSS or redirect to external site if not validated on /login
- **Fix:** Validate that returnTo pathname starts with "/" and doesn't reference external domains; or use a signed token instead of plaintext
- **Test:** Craft malicious returnTo; verify login page doesn't redirect externally

---

### 12. ⚠️ DEFER: Database query in layout (performance)
- **Severity:** LOW
- **Source:** blind
- **Location:** `sparta/src/app/(staff)/layout.tsx:711-720`
- **Issue:** `supabase.from("profiles").select()` called on every staff page load; blocking I/O in layout
- **Detail:** Not caused by 1.9; pre-existing pattern from 1.6 (multi-tenant RLS). Performance optimization is future work
- **Decision:** Defer to performance optimization story (1.13 or later)
- **Recommendation:** Flag as NFR optimization for later; acknowledge acceptable for MVP

---

### 13. ⚠️ PATCH: BottomTabNav tests incomplete
- **Severity:** LOW
- **Source:** blind
- **Location:** `sparta/src/components/patterns/BottomTabNav.test.tsx:939-942`
- **Issue:** Mock `usePathname` always returns "/hoje"; tests don't verify tab state for other routes
- **Detail:** Tests pass but logic might fail for /calendario, /sessoes, etc.
- **Fix:** Parametrize tests: `["hoje", "calendario", "sessoes"].forEach(route => test(`marks active tab for ${route}`) ...)`
- **Test:** Run parametrized tests for all roles/routes

---

### 14. ⚠️ PATCH: StaffLayout uses "Painel" title hardcoded
- **Severity:** LOW
- **Source:** blind
- **Location:** `sparta/src/app/(staff)/layout.tsx:729`
- **Issue:** StickyHeader title is hardcoded to "Painel"; different staff pages (prontidao, calendario) might need different titles
- **Detail:** AC#2 and AC#3 don't specify title format, but contextual title is better UX
- **Fix:** Pass title from child pages via context or layout slot; or remove title (let pages render their own headers)
- **Test:** Verify each staff page shows appropriate title

---

### 15. ✅ DISMISS: Route prefix matching edge case
- **Source:** edge
- **Detail:** `/plantelxyz` vs `/plantel` — prefix check is safe due to "/" requirement. No issue. — **DISMISSED**

---

### 16. ✅ DISMISS: Trailing slash handling
- **Source:** edge
- **Detail:** Next.js handles trailing slash normalization; no explicit guard needed. — **DISMISSED**

---

### 17. ✅ DISMISS: Concurrent query race condition
- **Source:** edge
- **Detail:** Request context is sequential; no true race. — **DISMISSED**

---

### 18. ✅ DISMISS: spec mismatch (proxy vs middleware terminology)
- **Source:** auditor
- **Detail:** Spec says "middleware" but Next.js 16 uses "proxy". Implementation correct, terminology outdated. Not actionable. — **DISMISSED**

---

## SUMMARY

| Category | Count |
|----------|-------|
| Critical Patches | 2 |
| High Patches | 1 |
| Medium Patches | 8 |
| Low Patches | 2 |
| Decisions Needed | 2 |
| Defer | 1 |
| Dismissed | 3 |
| **ACTIONABLE** | **16** |

**Status:** ⚠️ Requires patches before merge. Two critical issues must be fixed.

---

