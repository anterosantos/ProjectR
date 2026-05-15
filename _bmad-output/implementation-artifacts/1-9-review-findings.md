# Story 1.9 Code Review — Findings Report

**Review Date:** 2026-05-15  
**Reviewer:** Code Review Workflow (3-layer adversarial)  
**Diff Baseline:** commit 7b26503 → 00d31ea  

---

## LAYER 1: BLIND HUNTER — Cynical Code Review

**Methodology:** Pure code analysis of diff without context. Assume problems exist.

### Findings

1. **BottomTabNav.tsx:47 — Unsafe fallback role**
   - **Issue:** `const tabs = TAB_CONFIG[role] ?? TAB_CONFIG["player"];` silently downgrade any invalid role to "player"
   - **Impact:** If role prop is passed incorrectly (e.g., "admin"), user sees player tabs without error
   - **Risk:** User experience degradation, confusing UX when props are misconfigured
   - **Fix:** Throw error or validate role strictly

2. **BottomTabNav.tsx:37-40 — Duplicate icon (visual confusion)**
   - **Issue:** "Sessões" and "Tendências" both use `BarChart3` icon for analyst role
   - **Impact:** Visually identical tabs reduce discoverability; difficult for users to distinguish
   - **Risk:** UX issue; users may click wrong tab expecting different functionality
   - **Fix:** Use distinct icon for "Tendências" (e.g., TrendingUp or BarChart4)

3. **proxy.ts:45-50 — Type casting looseness**
   - **Issue:** `metadata` cast to `Record<string, string>` but values might not be strings; then reads `user_role` or `role` with potential undefined access
   - **Impact:** Type mismatch; if metadata structure differs, reads fail silently
   - **Risk:** Role-based access might be bypassed if metadata is unexpectedly structured
   - **Fix:** Cast to `Record<string, unknown>` and validate structure explicitly

4. **page.tsx vs proxy.ts — Duplicated role-based redirect logic**
   - **Issue:** Home page (page.tsx) queries profile and redirects by role; proxy.ts also enforces role routing
   - **Impact:** Two sources of truth for role routing; sync issues if logic diverges
   - **Risk:** Inconsistent behavior; one might allow access the other blocks
   - **Fix:** Move all routing logic to proxy.ts; page.tsx should only handle authenticated landing (or delegate)

5. **proxy.ts:59 — Fallback to "/" instead of default role route**
   - **Issue:** `const defaultRoute = ROLE_DEFAULT_ROUTES[userRole...] || "/";` falls back to "/" if role not in map
   - **Impact:** Unauthed user lands on root, which redirects to /login again (loop risk)
   - **Risk:** User experience degradation; potential redirect loop
   - **Fix:** Fallback to "/login" or explicit error instead of "/"

6. **Missing /configuracoes route handling**
   - **Issue:** `/configuracoes` (settings) is in ROLE_ALLOWED_ROUTES for all roles, but no settings page created
   - **Impact:** Users can navigate to /configuracoes but it 404s
   - **Risk:** Broken user journey
   - **Fix:** Create /configuracoes page or remove from allowed routes

7. **No validation of searchParams in proxy.ts:37**
   - **Issue:** `encodeURIComponent(pathname + searchParams.toString())` concatenates strings directly without validation
   - **Impact:** If searchParams contain malicious characters, they're passed to returnTo
   - **Risk:** XSS or open redirect via crafted returnTo param
   - **Fix:** Sanitize or validate searchParams before concatenating

8. **StaffLayout — database query in render path (performance)**
   - **Issue:** `src/app/(staff)/layout.tsx` calls `supabase.from("profiles").select().single()` on every render
   - **Impact:** Blocking database call in layout; N+1 queries if layout renders multiple times per request
   - **Risk:** Performance degradation; latency on every staff page load
   - **Fix:** Cache profile in session/JWT or use Supabase row-level security instead

9. **BottomTabNav test mock — single pathname**
   - **Issue:** BottomTabNav.test.tsx mocks `usePathname` to always return "/hoje", doesn't test other routes
   - **Impact:** Tests don't verify tab switching or active state for non-"/hoje" routes
   - **Risk:** currentTab logic might be broken for other routes but tests pass
   - **Fix:** Parametrize tests to check multiple pathname scenarios

10. **Missing null-safety in user metadata access**
    - **Issue:** `(metadata?.user_role || metadata?.role)` doesn't handle case where both are undefined or null
    - **Impact:** `userRole` becomes `undefined`; `userRole in ROLE_ALLOWED_ROUTES` would be false, user bypasses role check
    - **Risk:** Access control bypass; unauthenticated or improperly-scoped user might reach protected routes
    - **Fix:** Validate userRole is truthy before checking ROLE_ALLOWED_ROUTES

---

## LAYER 2: EDGE CASE HUNTER — Path Analysis

**Methodology:** Exhaustive path tracing for unhandled boundary conditions.

### Findings

1. **proxy.ts:52-56 — Route prefix matching ambiguity**
   - **Path:** User at `/plantelxyz` tries to access (typo in URL)
   - **Condition:** Route check: `pathname.startsWith(route + "/")`  evaluates `/plantelxyz`.startsWith(`/plantel` + `/`) = false ✓
   - **Guard:** Exact prefix match with "/" prevents false positives — HANDLED

2. **proxy.ts:54 — Null check missing for allowedRoutes**
   - **Path:** If ROLE_ALLOWED_ROUTES[userRole] is undefined (malformed constant)
   - **Condition:** `allowedRoutes?.some(...)` would be undefined
   - **Guard:** Optional chaining handles this — HANDLED

3. **page.tsx:20 — .single() throws on multiple profiles**
   - **Path:** User has duplicate rows in profiles table (data corruption)
   - **Condition:** `supabase...single()` throws `Error('Multiple rows returned')`
   - **Guard:** No try-catch; error bubbles to Next.js error boundary
   - **Consequence:** 500 error shown to user, no graceful fallback — **UNHANDLED**

4. **BottomTabNav:49-53 — Route with trailing slash**
   - **Path:** User at `/hoje/` (trailing slash) vs tab href `/hoje`
   - **Condition:** `/(pathPrefix)` = `/hoje`, href = `/hoje` — match ✓ — HANDLED

5. **StaffLayout:711-720 — role === "player" inside staff group**
   - **Path:** Player somehow reaches /staff route (via direct URL)
   - **Condition:** `if (!role || role === "player") redirect("/hoje")` catches this
   - **Guard:** HANDLED

6. **proxy.ts:38-40 — searchParams.toString() returns empty string**
   - **Path:** Request to `/prontidao` with no query params
   - **Condition:** `pathname + searchParams.toString()` = `/prontidao` + `` = `/prontidao` ✓
   - **Guard:** HANDLED

7. **page.tsx & StaffLayout — concurrent queries**
   - **Path:** User fast-navigates between pages during profile fetch
   - **Condition:** Race condition between `getUser()` and `select('role')` calls
   - **Guard:** No race condition handling; two sequential queries — likely HANDLED by Next.js request context

8. **Missing route: /hoje/[id]  and /sessoes/[id] (spec requirement AC#5)**
   - **Path:** Deep link to player detail: `/hoje/uuid`
   - **Condition:** Route not in ROLE_ALLOWED_ROUTES; proxy would allow `/hoje` but not `/hoje/[id]` subtree
   - **Guard:** Spec says `[id]` routes should be allowed; current check with `startsWith()` would HANDLE this ✓

---

## LAYER 3: ACCEPTANCE AUDITOR — Spec Compliance

**Methodology:** Cross-reference diff against 8 acceptance criteria.

### AC #1: Route groups and layout structure ✅
- ✓ Route groups `(player)` and `(staff)` created
- ✓ Separate `layout.tsx` files exist
- ✓ Shared header/nav shells in layouts

### AC #2: Coach navigation — mobile ✅
- ✓ Tabs render: "Prontidão · Calendário · Plantel · Eu"
- ✓ Hrefs correct: `/prontidao`, `/calendario`, `/plantel`, `/configuracoes`
- ⚠ Sticky header hardcoded to `meta="Sáb 16:00"` — should be dynamic per page

### AC #3: Analyst navigation — mobile + desktop ✅
- ✓ Mobile tabs: "Sessões · Plantel · Tendências · Eu"
- ✓ Hrefs correct
- ✓ Desktop sidebar placeholder created (lg:block, w-64)
- ⚠ Sidebar is empty; spec says "will be fully implemented in future stories" but no TODOs mark what's missing

### AC #4: Player navigation ✅
- ✓ Exactly 3 tabs: "Hoje · Histórico · Eu"
- ✓ Hrefs: `/hoje`, `/historico`, `/configuracoes`

### AC #5: URL conventions ✅
- ✓ All routes Portuguese
- ✓ No person names in slugs (all `[id]`)
- ⚠ UUID v7 format not enforced in route definitions; just placeholder [id]

### AC #6: Role-based access enforcement ✅
- ✓ Proxy enforces role routing
- ✓ Player → /sessoes redirects to /hoje
- ✓ returnTo preserved in query param
- ⚠ Spec says "middleware" but implementation uses proxy.ts (Next.js 16 change not noted in spec)

### AC #7: Native back gesture support ✅
- ✓ Uses `<Link>` component; preserves browser history
- ✓ No custom back button preventing native gesture

### AC #8: Sticky header pattern ✅
- ✓ Semantic `<header>` with `role="banner"`
- ✓ Sticky positioning with `z-sticky` token
- ⚠ Meta is hardcoded in StaffLayout; should be dynamic from page context

---

## SEVERITY SUMMARY

| Layer | Critical | High | Medium | Low |
|-------|----------|------|--------|-----|
| Blind Hunter | 2 | 3 | 4 | 1 |
| Edge Case Hunter | 1 | 0 | 0 | 7 |
| Acceptance Auditor | 0 | 0 | 3 | 5 |

### Critical Issues (Must Fix Before Merge)
1. **Access control bypass** — userRole validation missing (proxy.ts)
2. **Profile query crash** — `.single()` without error handling (page.tsx)

### High Issues (Recommend Fix)
1. Duplicate role-redirect logic (page.tsx vs proxy.ts)
2. Icon visual confusion (BottomTabNav: analyst tabs)
3. Fallback route logic (proxy.ts line 59)

---

## RECOMMENDED PATCHES

[Details in follow-up triage step]
