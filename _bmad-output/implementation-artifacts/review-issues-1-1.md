# Code Review Issues — Story 1.1

**Generated:** 2026-05-08  
**Review Type:** Adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor)  
**Status:** Pending Resolution  

---

## DECISION REQUIRED

### [DECISION-01] Next.js 16.2.6 + Node 22 LTS Compatibility Stance

**Severity:** HIGH  
**Source:** blind-hunter  
**Summary:** Next.js 16.2.6 compatibility with Node 22 LTS is unverified; historical incompatibilities between Node versions and Next.js exist.

**Details:**
- `package.json` specifies `"engines": { "node": ">=22 <23" }` and `"next": "16.2.6"`
- Version pair has not been explicitly validated for production compatibility
- Knowledge cutoff predates Next.js 16.2.6 release; compatibility is uncertain

**Decision Options:**
1. **Accept & Test in CI** — Proceed with scaffold; add explicit integration tests in Story 1.13 (CI/CD) to verify Node 22 compatibility
2. **Pin to Known-Stable Version** — Downgrade to last Next.js version explicitly tested with Node 22 (e.g., 16.0.x)
3. **Add Pre-Merge Integration Testing** — Create a test that verifies critical features (dev server, build, lint, test) work on Node 22 before merge

**Recommendation:** Option 1 (Accept & test in CI) is lowest-friction if team is confident with version tracking. Option 3 adds safety.

**Decision Made:** ✅ **Option 1 — Accept & test in CI** (2026-05-08)  
**Rationale:** Current version pair (Next.js 16.2.6 + Node 22.11.0) is acceptable; integration testing deferred to Story 1.13 (CI/CD setup)  
**Action:** Add verification tests in Story 1.13 to confirm critical paths (dev server, build, lint, test runner) work correctly on Node 22  
**Blocking:** No

---

## PATCHES — HIGH PRIORITY

### [PATCH-01] Missing .env.example Template

**Severity:** HIGH  
**Source:** blind+edge  
**Summary:** .gitignore configured to exclude `.env*` except `.env.example`, but template file is missing. Developers cannot bootstrap Supabase environment variables.

**Details:**
- `.gitignore` lines 34–35: `.env*` and `!.env.example` configured
- No `.env.example` file exists in repository
- Supabase integration (@supabase/ssr, @supabase/supabase-js) requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Developers creating `.env.local` manually may not include all required vars

**Acceptance Criteria (Resolution):**
- [ ] Create `sparta/.env.example` with template vars:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  # Add other required vars as discovered in Story 1.2
  ```
- [ ] Document in README.md: "Copy `.env.example` to `.env.local` and fill in your Supabase credentials"
- [ ] (Optional) Add pre-dev check that validates required env vars exist and exits with clear error message

**Related Story:** 1.2 (Supabase Project Setup) — defer content specifics to 1.2, create template now

**Assignee:** dev-story or Story 1.2  
**Blocking:** No (but helpful for dev setup)

---

### [PATCH-02] Empty next.config.ts with --webpack Flag Override

**Severity:** HIGH  
**Source:** blind-hunter  
**Summary:** `package.json` forces `--webpack` flag in dev script, but `next.config.ts` is empty with no webpack configuration. This mismatch may cause silent failures or behavior inconsistencies.

**Details:**
- `package.json` line 9: `"dev": "next dev --webpack"`
- `next.config.ts` lines 3–5: Empty config object with no webpack overrides or explanatory comments
- Rationale: Serwist (PWA service worker) is incompatible with Turbopack (Next.js 16 default)
- Risk: Forcing Webpack without config may cause silent failures, performance degradation, or unexpected bundling behavior

**Acceptance Criteria (Resolution):**
- [ ] Update `next.config.ts` to document the --webpack requirement:
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    // Webpack (not Turbopack) is required for Serwist PWA compatibility.
    // See: architecture.md#L180 and Story 1.11 (PWA setup).
    // The --webpack flag in package.json dev script enforces this.
  };

  export default nextConfig;
  ```
- [ ] Or: Add minimal webpack config if needed (verify with `npm run dev`)

**Related Story:** 1.11 (Service Worker / Serwist Configuration)  
**Assignee:** dev-story  
**Blocking:** No (but clarifies intent for future maintainers)

---

### [PATCH-03] TypeScript Path Alias Consistency Across Build Tools

**Severity:** HIGH  
**Source:** edge-case-hunter  
**Summary:** TypeScript, vitest, and ESLint define path aliases differently. If vitest runs from repo root (monorepo scenario), the `@/*` alias breaks. No guard against import resolution drift.

**Details:**
- `tsconfig.json` line 23: `"@/*": ["./src/*"]` — Relative to SPARTAoot
- `vitest.config.ts` line 16: `alias: { "@": path.resolve(__dirname, "./src") }` — Uses __dirname (CWD-dependent)
- `components.json`: Aliases point to `@/components`, `@/lib`, etc. (shadcn convention)
- `eslint.config.mjs`: No explicit path alias definition; relies on inheritance
- Risk: TypeScript build succeeds but vitest tests fail (or vice versa) if CWD differs

**Acceptance Criteria (Resolution):**
- [ ] Update `vitest.config.ts` to use absolute path with fallback:
  ```typescript
  import path from "node:path";
  
  export default defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  });
  ```
  (Already correct — verify __dirname resolves to sparta/ directory)

- [ ] Add test `__tests__/imports.test.ts` that verifies all @/* aliases resolve:
  ```typescript
  import { cn } from "@/lib/utils"; // Should resolve
  import "@/components/ui/button"; // Should resolve
  // ... test all key paths
  ```

- [ ] Document in `sparta/CLAUDE.md`:
  ```
  ## TypeScript Path Aliases
  - Tests must be run from `sparta/` directory for vitest alias resolution
  - All @/* paths resolve to src/ subdirectory
  - Verify with: npm run test --run
  ```

**Assignee:** dev-story  
**Blocking:** No (but prevents future import failures)

---

## PATCHES — MEDIUM PRIORITY

### [PATCH-04] Node 22 in .nvmrc vs. engines Field Mismatch

**Severity:** MEDIUM  
**Source:** edge-case-hunter  
**Summary:** `.nvmrc` specifies "22" (any 22.x version), but `package.json` engines enforces ">=22 <23" (strict). No specific version pinned; CI/CD may default to older Node if .nvmrc is not enforced.

**Details:**
- `.nvmrc` contains: `22`
- `package.json` engines: `"node": ">=22 <23"`
- Risk: CI/CD image defaults to Node 20 or uses different 22.x patch; builds behave differently locally vs. CI
- Next.js and webpack plugins may have subtle differences across Node 22.x versions

**Acceptance Criteria (Resolution):**
- [ ] Pin `.nvmrc` to specific LTS version:
  ```
  22.11.0
  ```
  (Replace with latest stable 22.x LTS at time of merge)

- [ ] Document in CI config (Story 1.13):
  ```yaml
  # Enforce Node version from .nvmrc
  - uses: actions/setup-node@v4
    with:
      node-version-file: 'sparta/.nvmrc'
  ```

- [ ] Verify locally: `nvm use` (or `fnm use`) should load .nvmrc version

**Related Story:** 1.13 (CI/CD Setup)  
**Assignee:** dev-story or Story 1.13  
**Blocking:** No (but recommended for CI consistency)

---

### [PATCH-05] Recharts Installed But Unused

**Severity:** MEDIUM  
**Source:** blind+edge  
**Summary:** `recharts@3.8.1` is installed as a dependency but has zero imports in the codebase. Violates "no speculative dependencies" principle. May bloat bundle if tree-shaking fails (~50–100 KB minified).

**Details:**
- `package.json` line 34: `"recharts": "^3.8.1"`
- No imports in `src/**`
- Spec note: Deferred to Phase 2; installed per AR2 but not used in Story 1.1
- Risk: Bundle bloat, false sense of availability, unmaintained dependency weight

**Acceptance Criteria (Resolution):**
- [ ] Remove from `package.json`:
  ```bash
  npm uninstall recharts
  ```

- [ ] Document decision in `sparta/docs/architecture/violations.md`:
  ```
  | Date | Story | Decision | Rationale | Status |
  | --- | --- | --- | --- | --- |
  | 2026-05-08 | 1.1 | Recharts deferred to Phase 2 | Avoid bundle bloat for unused deps; re-add in story that first uses it | removed |
  ```

- [ ] When Phase 2 story uses recharts: Add explicit AC to verify bundle size impact

**Related Story:** Phase 2 (TBD)  
**Assignee:** dev-story  
**Blocking:** No (but keeps scaffold lean)

---

### [PATCH-06] Vitest Setup File Path Is Relative (CWD Risk)

**Severity:** MEDIUM  
**Source:** edge-case-hunter  
**Summary:** `vitest.config.ts` uses relative path `"./vitest.setup.ts"` for setupFiles. If vitest runs from repo root (monorepo), the path becomes invalid; tests fail silently or skip setup.

**Details:**
- `vitest.config.ts` line 10: `setupFiles: ["./vitest.setup.ts"]`
- Path is relative to CWD; breaks if vitest invoked from repo root
- `@testing-library/jest-dom` setup may not initialize, causing DOM matchers to fail
- CI/CD may run from root directory, skipping setup without error

**Acceptance Criteria (Resolution):**
- [ ] Update `vitest.config.ts` to use absolute path:
  ```typescript
  import path from "node:path";
  
  export default defineConfig({
    test: {
      setupFiles: [path.resolve(__dirname, "./vitest.setup.ts")],
    },
  });
  ```

- [ ] Add test `__tests__/setup.test.ts` verifying jest-dom is available:
  ```typescript
  it("jest-dom matchers are available", () => {
    const div = document.createElement("div");
    expect(div).toBeInTheDocument(); // toBeInTheDocument from jest-dom
  });
  ```

- [ ] Document in `sparta/CLAUDE.md`:
  ```
  ## Running Tests
  - Tests can be run from sparta/ directory: npm run test
  - Or from repo root: npm run -w sparta test
  - Vitest setup is configured with absolute paths for monorepo compatibility
  ```

**Assignee:** dev-story  
**Blocking:** No (but prevents test setup failures)

---

### [PATCH-07] ESLint jsx-a11y Plugin Redefinition Risk

**Severity:** MEDIUM  
**Source:** edge-case-hunter  
**Summary:** Comment in `eslint.config.mjs` asserts jsx-a11y is "already bundled in eslint-config-next," but this assumption is version-specific. If Next.js 17 drops the plugin, ESLint will crash with "Cannot redefine plugin jsx-a11y" error.

**Details:**
- `eslint.config.mjs` lines 5–6: Comment explains no manual jsx-a11y registration
- No version constraint documented
- eslint-config-next is maintained by Vercel; no guarantee jsx-a11y will remain bundled

**Acceptance Criteria (Resolution):**
- [ ] Update `eslint.config.mjs` with version constraint and verification:
  ```javascript
  // Note: `eslint-config-next/core-web-vitals` bundles `eslint-plugin-jsx-a11y`
  // Verified with eslint-config-next@16.2.6; verify on each Next.js upgrade.
  // If Next.js 17+ drops jsx-a11y, this config will fail. See Story 1.13 CI.
  ```

- [ ] Add CI check in Story 1.13:
  ```bash
  # Verify jsx-a11y rules are loaded
  npx eslint --debug 2>&1 | grep -q "jsx-a11y" || exit 1
  ```

**Related Story:** 1.13 (CI/CD Setup)  
**Assignee:** dev-story or Story 1.13  
**Blocking:** No (but prevents breaking changes)

---

### [PATCH-08] TypeScript noUncheckedIndexedAccess Without Pattern Guidance

**Severity:** MEDIUM  
**Source:** blind-hunter  
**Summary:** `noUncheckedIndexedAccess: true` is enabled in `tsconfig.json`, but no documented patterns or examples are provided. Developers will immediately hit TypeScript errors with no guidance on how to handle them correctly (e.g., optional chaining + nullish coalescing).

**Details:**
- `tsconfig.json` line 8: `"noUncheckedIndexedAccess": true`
- Enforces explicit index access checking; increases error surface area
- No documentation in codebase on how to satisfy this constraint
- Developers adding code will see errors like "Object is possibly 'undefined'" with no resolution path

**Acceptance Criteria (Resolution):**
- [ ] Add section to `sparta/AGENTS.md` or `sparta/CLAUDE.md`:
  ```markdown
  ## TypeScript: noUncheckedIndexedAccess

  The project uses TypeScript strict mode with `noUncheckedIndexedAccess: true` (NFR55).
  This means index access (array[i], object[key]) requires explicit type narrowing.

  ### Pattern: Optional Chaining + Nullish Coalescing
  ```typescript
  const arr = [1, 2, 3];
  const value = arr?.[0] ?? fallback; // Correct

  const obj = { a: 1 };
  const val = obj?.[key] ?? undefined; // Correct
  ```

  ### Anti-Pattern
  ```typescript
  const arr = [1, 2, 3];
  const value = arr[0]; // ❌ Error: might be undefined
  ```

  See: [TypeScript noUncheckedIndexedAccess docs](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)
  ```

- [ ] (Optional) Add ESLint rule or pre-commit hook to enforce pattern

**Assignee:** dev-story (or Story 1.9 when pattern enforcement is needed)  
**Blocking:** No (but improves developer experience)

---

### [PATCH-09] React 19 JSX + @vitejs/plugin-react Dual Processing Risk

**Severity:** MEDIUM  
**Source:** edge-case-hunter  
**Summary:** React 19 includes automatic JSX transform (no `React` import needed), but `@vitejs/plugin-react` is added as a dev dependency for vitest. Both may process JSX, causing inconsistent rendering between dev server and tests.

**Details:**
- `package.json` line 31: `"react": "19.2.4"` (automatic JSX)
- `package.json` line 48: `"@vitejs/plugin-react": "^6.0.1"` (vitest JSX handling)
- `tsconfig.json` line 15: `"jsx": "react-jsx"` (automatic transform)
- Risk: Vitest and Next.js dev server may produce different JSX output; component renders in tests but fails in dev (or vice versa)

**Acceptance Criteria (Resolution):**
- [ ] Add test `__tests__/jsx-compat.test.tsx` verifying JSX consistency:
  ```typescript
  import { render, screen } from "@testing-library/react";

  function TestComponent() {
    return <div>Hello World</div>;
  }

  it("renders JSX consistently", () => {
    render(<TestComponent />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
  ```

- [ ] Document in `sparta/AGENTS.md`:
  ```markdown
  ## React 19 JSX Transform

  - React 19 uses automatic JSX transform (no `React` import required in .tsx files)
  - Vitest uses @vitejs/plugin-react for JSX processing in jsdom environment
  - Both transformers must remain in sync

  ### Verification
  - Run tests: npm run test --run
  - Run dev: npm run dev
  - Verify both produce identical component output (no visual differences)
  ```

- [ ] (Optional) Add visual regression test or screenshot test in Story 1.13

**Assignee:** dev-story  
**Blocking:** No (but prevents dev/test divergence)

---

### [PATCH-10] passWithNoTests: true Allows Empty Test Suites in CI

**Severity:** MEDIUM  
**Source:** blind+edge  
**Summary:** `vitest.config.ts` has `passWithNoTests: true`, which allows the test runner to exit with code 0 even if zero tests are found. In CI/CD, this silently passes even if test setup is broken, masking test infrastructure failures.

**Details:**
- `vitest.config.ts` line 12: `passWithNoTests: true`
- Intended for development (fast iteration with no tests), but dangerous in CI
- CI will show green ✓ even if test configuration is fundamentally broken
- No baseline test suite exists to catch infrastructure issues

**Acceptance Criteria (Resolution):**
- [ ] Keep `passWithNoTests: true` in dev config for fast iteration

- [ ] Override to `false` in CI (Story 1.13):
  ```typescript
  // vitest.config.ts
  export default defineConfig({
    test: {
      passWithNoTests: process.env.CI === "true" ? false : true,
    },
  });
  ```

- [ ] Create baseline smoke test `__tests__/smoke.test.ts`:
  ```typescript
  it("TypeScript compiles without errors", () => {
    // This test verifies the test infrastructure itself works
    expect(true).toBe(true);
  });
  ```

- [ ] In Story 1.13, add CI check:
  ```bash
  npm run test --run  # Must find at least 1 test; fails if passWithNoTests = false and no tests found
  ```

**Related Story:** 1.13 (CI/CD Setup)  
**Assignee:** dev-story or Story 1.13  
**Blocking:** No (but prevents silent test infrastructure failures)

---

## DEFERRED ITEMS (Already Scoped to Future Stories)

These are **NOT** issues; they are expected deferrals documented in the spec:

- **Supabase SSR Middleware** → Story 1.6 ✓
- **Serwist PWA Configuration** → Story 1.11 ✓
- **Button Variants (6→3)** → Story 1.8 ✓
- **Token Vocabulary (Canonical)** → Story 1.8 ✓
- **Supabase Helpers** → Story 1.6 ✓
- **Migrations SQL** → Story 1.3 ✓

All documented in `docs/architecture/violations.md`.

---

## SUMMARY TABLE

| ID | Title | Severity | Type | Status |
|----|-------|----------|------|--------|
| DECISION-01 | Next.js 16.2.6 + Node 22 compatibility | HIGH | Decision | ⏳ Awaiting decision |
| PATCH-01 | Missing .env.example template | HIGH | Patch | ⏳ Awaiting implementation |
| PATCH-02 | Empty next.config.ts with --webpack | HIGH | Patch | ⏳ Awaiting implementation |
| PATCH-03 | Path alias consistency (TypeScript/vitest) | HIGH | Patch | ⏳ Awaiting implementation |
| PATCH-04 | Node .nvmrc version pinning | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-05 | Recharts unused dependency removal | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-06 | Vitest setup file absolute path | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-07 | ESLint jsx-a11y version constraint | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-08 | TypeScript noUncheckedIndexedAccess docs | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-09 | React 19 JSX + vitest plugin compat test | MEDIUM | Patch | ⏳ Awaiting implementation |
| PATCH-10 | passWithNoTests CI override | MEDIUM | Patch | ⏳ Awaiting implementation |

---

## NEXT STEPS

1. **Resolve DECISION-01** — Decide on Next.js 16.2.6 + Node 22 compatibility approach
2. **Address HIGH PATCH items** (1–3) before merge approval
3. **Address MEDIUM PATCH items** (4–10) as convenient (can be addressed in follow-up PR if time-constrained)
4. **Deferred items** remain scoped to Stories 1.6/1.8/1.11 as documented

---

**Generated by:** Haiku Code Review (bmad-code-review skill)  
**Date:** 2026-05-08  
**Model:** claude-haiku-4-5-20251001  
**Review Scope:** Full (diff + spec + context docs)  
**Status:** ✅ Acceptance Audit PASSED | ⏳ Code Review Issues Pending
