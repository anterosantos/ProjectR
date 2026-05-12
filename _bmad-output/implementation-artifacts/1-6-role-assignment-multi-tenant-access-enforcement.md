# Story 1.6: Role Assignment & Multi-Tenant Access Enforcement

**Status:** ready-for-dev

**Story ID:** 1.6  
**Epic:** Epic 1 - Fundação Técnica, Identidade & Acesso Multi-Clube  
**Created:** 2026-05-12

---

## Story

As the system,
I want to enforce one-and-only-one role per profile and strict club-level isolation,
So that no user can access data from another club and role permissions are unambiguous.

---

## Acceptance Criteria

### AC #1: Cross-tenant isolation via RLS

**Given** any two clubs A and B with seeded fixtures (profiles, players, sessions)
**When** a user from club A queries any RLS-protected table via `supabase-js` client
**Then** no rows from club B are returned
**And** the RLS policy `club_id = auth.club_id()` is enforced at query time (FR3, validated by integration test)

### AC #2: RLS "with check" on writes prevents cross-tenant insert

**Given** a write attempt (INSERT/UPDATE)
**When** a user tries to insert a row with `club_id` different from their `auth.club_id()`
**Then** the insert is rejected by RLS `with check` (rejects silently via Supabase, no row inserted)
**And** the error message is generic: "new row violates row-level security policy" (AR10)

### AC #3: Supabase client helpers follow conventions

**Given** the helpers architecture (AR15)
**When** reviewing `lib/supabase/{client,server,middleware,service-role}.ts`
**Then** each file exports a typed Supabase client:
- `client.ts`: authenticated browser client (uses auth session)
- `server.ts`: server-side authenticated client (Node.js Server Action / API route)
- `middleware.ts`: middleware-scoped client (next.js middleware for session refresh)
- `service-role.ts`: service-role bypass client (no RLS; fire-and-forget ops, cron jobs, Edge Functions)
**And** all clients are provider-agnostic (no `@vercel/*` imports, zero imports of Vercel-specific APIs) (NFR58)

### AC #4: Service-role client has restricted import scope

**Given** the service-role bypass requirement (AR13)
**When** any code outside `lib/supabase/service-role.ts` attempts to import service-role client
**Then** ESLint rule `no-service-role-outside-restricted-paths` blocks the import at build time
**And** only whitelisted paths (Edge Functions, cron jobs, authorized Server Actions) are allowed

### AC #5: Middleware refreshes session and blocks unauthenticated access

**Given** the Next.js middleware (AR14)
**When** a protected route is requested (any route under `app/(staff)/` or `app/(player)/`)
**Then** the middleware calls `supabaseClient.auth.refreshSession()` to keep tokens fresh
**And** if session is invalid/missing, the middleware redirects to `/login`
**And** the response status is 307 (temporary redirect), not 401

### AC #6: Profiles enforce single-role CHECK constraint

**Given** a profile exists
**When** queried
**Then** exactly one `role` value in `('coach', 'analyst', 'player')` is present per `auth.uid()` (FR2)
**And** a CHECK constraint in the `profiles` table enforces this: `CHECK (role IN ('coach','analyst','player'))`
**And** no profile can have NULL role

### AC #7: Multi-tenant RLS integration testing

**Given** test coverage (NFR54)
**When** integration tests run with seeded multi-tenant fixtures (2 clubs × 3 roles × 2 users each)
**Then** all cross-tenant access attempts fail (SELECT, INSERT, UPDATE, DELETE all rejected or return empty)
**And** all same-tenant access attempts succeed
**And** ≥80% coverage of RLS policy paths (read with matching club, read with mismatched club, write with check, cross-role scenarios)

---

## Development Context

### Understanding Story 1.6 in the Sprint

This story follows stories 1.1–1.5 and establishes the **multi-tenant security foundation** that all future stories depend on.

**Previous story context (1.5):**
- Story 1.5 (auth flow) is currently in `review` status. Login/logout work, recovery flows confirmed.
- The JWT custom claims hook (Story 1.4) is already deployed; `auth.club_id()` and `auth.user_role()` SQL helpers exist.
- Next.js middleware skeleton exists to refresh auth, but **does not yet verify multi-tenant isolation or redirect unauthenticated users**.

**What 1.6 adds:**
- Validates and tests that RLS policies are **working end-to-end** with real data.
- Confirms Next.js middleware enforces **authentication gateway** and **session refresh**.
- Establishes the **client helper architecture** (`lib/supabase/client.ts`, `server.ts`, etc.) that all subsequent Server Actions will use.
- Locks in the **service-role import restriction** via ESLint to prevent future bypasses of RLS.

**What 1.6 does NOT do (but depends on):**
- Does not implement app-side authorization logic (e.g., role-based feature hiding) — that's UI/UX in later stories.
- Does not test specific business logic (fatigue, match events, readiness) — those stories will add their own RLS policies and tests.
- Assumes Stories 1.2–1.4 (Supabase project, migrations, auth hook) are complete and working.

### Architecture Requirements Specific to 1.6

From `AR9` (club_id everywhere):
- Every table with multi-tenant data has a `club_id uuid` column.
- Every such table has an index `idx_<table>_club_id` on `(club_id)` for query performance.
- Example: `profiles(id, auth_uid, club_id, role)` with `idx_profiles_club_id`.

From `AR10` (RLS "with check"):
- All write policies include `WITH CHECK (club_id = auth.club_id())` to prevent cross-tenant inserts.
- Example: `CREATE POLICY "staff write own club" ON profiles FOR INSERT WITH CHECK (auth.user_role() IN ('coach','analyst') AND club_id = auth.club_id());`

From `AR15` (client helpers provider-agnostic):
- `lib/supabase/*.ts` files do not import from `@vercel/og`, `@vercel/kv`, `next/cache`, or any other Vercel-specific module.
- Only `next/headers` and `next/navigation` are allowed (standard Next.js APIs).
- All Supabase interactions use `@supabase/supabase-js` and `@supabase/ssr` only.

### Migrations Already Applied (Prerequisites)

**From Story 1.3:**
- `profiles` table exists with `id (uuid, PK = auth.uid()), club_id (uuid, FK), role (text CHECK), full_name, created_at, updated_at`.
- `clubs` table exists with `id, name, country, created_at`.
- RLS is enabled on both tables.
- `auth.club_id()` and `auth.user_role()` SQL helpers exist.

**From Story 1.4:**
- Supabase Auth Hook is deployed and injects `club_id` and `role` into every JWT.

**What we need in 1.6:**
- Verify the migrations are complete and the RLS policies created in Story 1.3 are correct.
- Create the Next.js client helpers and middleware.
- Add ESLint rule to restrict service-role imports.
- Write integration tests covering all 7 ACs.

### Known Patterns from Previous Stories

From Story 1.1:
- `package.json` declares Node 22 LTS.
- TypeScript strict mode is enabled (`"strict": true`).
- `tsconfig.json` has `"noUncheckedIndexedAccess": true`.

From Story 1.5:
- Form validation uses Zod.
- Alerts use `<Alert>` component from shadcn/ui.
- Inline error messages are displayed via `<Alert>` in `signal/alert` text (red).
- Middleware is in `src/app/middleware.ts` or `middleware.ts` (root of `src/` for Next.js 15+).

### Common Mistakes to Avoid

1. **Service-role client in browser bundle**: The `SUPABASE_SERVICE_ROLE_KEY` must **never** appear in client code. If you see it leaking to browser, the build must fail. ESLint rule enforces this.

2. **Missing RLS "with check" on updates**: Many developers add SELECT policies but forget `WITH CHECK` on UPDATE/INSERT. This allows a coach to write data with another club's ID, bypassing isolation.

3. **Middleware not refreshing session**: The middleware must call `supabaseClient.auth.refreshSession()` **before** checking authentication state. If you skip this, expired tokens won't be renewed and users get logged out unexpectedly.

4. **Unauthenticated users seeing app chrome**: The middleware should redirect to `/login` **before** rendering any app content. If you move the redirect into the page component, you'll briefly render the full app, then redirect (jarring UX).

5. **Forgetting to seed multi-tenant test data**: Cross-tenant RLS tests only work if the test suite has 2+ clubs with different users. Using 1 club defeats the purpose.

6. **Not testing edge cases**: Test the boundaries: a user from club A trying to update their own row but change `club_id` to club B, a user trying to SELECT from club B's table directly, a user with NULL role, etc.

---

## Tasks / Subtasks

### Task 1 — Verify migration prerequisites and RLS policies

**Purpose:** Confirm that Stories 1.2–1.4 migrations and RLS are in place before building client code.

**Checklist:**
- [ ] Connect to Supabase project via local `supabase start` and list all tables: `\dt` in `psql`.
- [ ] Verify `profiles` table exists with columns: `id (uuid PK), club_id (uuid FK), role (text CHECK), full_name, created_at, updated_at`.
- [ ] Verify `clubs` table exists.
- [ ] Run `SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='profiles';` and confirm ≥2 policies exist (likely "club isolation read" and at least one write policy).
- [ ] Test the SQL helpers directly: `SELECT auth.club_id();` and `SELECT auth.user_role();` in a test JWT context (use Supabase dashboard JWT token).
- [ ] If any migration is missing or RLS policy is malformed, **halt** and report the gap. This story assumes Story 1.3 is complete.

**Files to check:**
- `supabase/migrations/000030_auth_helpers.sql` — should contain `auth.club_id()` and `auth.user_role()` functions.
- `supabase/migrations/000040_profiles_rls.sql` — should contain RLS policies.

### Task 2 — Create `lib/supabase/client.ts` (browser client)

**Purpose:** Export a Supabase client for use in browser code (React components, Client Components).

**File location:** `project-r/src/lib/supabase/client.ts`

**Requirements:**
- [ ] Import `createBrowserClient` from `@supabase/ssr`.
- [ ] Create and export a typed Supabase client that uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public env vars, safe in browser).
- [ ] The client should support `.auth.getSession()` and `.auth.onAuthStateChange()` for React hooks.
- [ ] Include JSDoc comment explaining this is for browser/Client Component use only.
- [ ] Example structure:
  ```typescript
  import { createBrowserClient } from '@supabase/ssr';
  import { Database } from '@/types/supabase';

  export function createClient() {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  export const supabase = createClient();
  ```

**Verification:**
- [ ] TypeScript compiles with no errors.
- [ ] Importing the client in a `.tsx` file works.
- [ ] The client has methods like `.from('table').select()`, `.auth.getSession()`.

### Task 3 — Create `lib/supabase/server.ts` (server client for Server Actions)

**Purpose:** Export a Supabase client for use in Server Actions and server-side code.

**File location:** `project-r/src/lib/supabase/server.ts`

**Requirements:**
- [ ] Import `createServerClient` from `@supabase/ssr`.
- [ ] Use `cookies()` from `next/headers` to read the session cookie set by Supabase Auth.
- [ ] The client should automatically inject the user's JWT into requests.
- [ ] Return a function that creates a fresh client on each Server Action call (not a singleton).
- [ ] Include JSDoc comment explaining this is for Server Components and Server Actions only.
- [ ] Example structure:
  ```typescript
  import { createServerClient } from '@supabase/ssr';
  import { cookies } from 'next/headers';
  import { Database } from '@/types/supabase';

  export function createServerClient() {
    const cookieStore = cookies();
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { /* read from cookieStore */ },
          setAll() { /* write to cookieStore */ },
        },
      }
    );
  }
  ```

**Verification:**
- [ ] TypeScript compiles.
- [ ] A Server Action can call `createServerClient().from('profiles').select()`.
- [ ] The session/JWT is automatically included.

### Task 4 — Create `lib/supabase/middleware.ts` (session refresh in Next.js middleware)

**Purpose:** Refresh Supabase session and redirect unauthenticated users in the middleware layer.

**File location:** `project-r/src/lib/supabase/middleware.ts`

**Requirements:**
- [ ] Import `createServerClient` from `@supabase/ssr`.
- [ ] Export a function `updateSession(request: NextRequest)` that:
  - [ ] Creates a Supabase client scoped to the middleware request/response.
  - [ ] Calls `supabaseClient.auth.refreshSession()` to keep tokens fresh.
  - [ ] Checks if the user is authenticated.
  - [ ] Returns a response (modified with refreshed auth headers if needed).
- [ ] Example structure:
  ```typescript
  export async function updateSession(request: NextRequest) {
    // Create server client with middleware-scoped cookies
    const supabase = createServerClient(/* ... */);
    
    // Refresh session to keep tokens fresh
    const { data: { user } } = await supabase.auth.getUser();
    
    const response = NextResponse.next({
      request: { headers: request.headers },
    });
    
    // Write refreshed auth headers back to response
    // (Supabase ssr handles this automatically)
    
    return response;
  }
  ```

**Verification:**
- [ ] TypeScript compiles.
- [ ] The middleware function can be imported and invoked from `middleware.ts`.

### Task 5 — Create `middleware.ts` (Next.js middleware entry point)

**Purpose:** Wire up the session refresh and authentication checks globally.

**File location:** `project-r/middleware.ts` (root of `src/` for Next.js 15+, or adjust per your setup)

**Requirements:**
- [ ] Import the `updateSession` function from `lib/supabase/middleware.ts`.
- [ ] Create and export a Next.js `middleware` function that calls `updateSession(request)`.
- [ ] Configure the middleware to run on all routes except:
  - [ ] `/login`, `/recuperar-password`, `/consentimento/*` (auth entry points)
  - [ ] `/api/*` (webhooks, health checks — may have their own auth)
  - [ ] `/_next/*`, `/favicon.ico`, etc. (static assets)
- [ ] Example matcher:
  ```typescript
  export const config = {
    matcher: [
      // Match all routes except static files and auth entry points
      '/((?!login|recuperar-password|consentimento|_next|favicon).*)',
    ],
  };
  ```
- [ ] If the user is not authenticated (after refresh attempt), redirect to `/login`.
  ```typescript
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  ```

**Verification:**
- [ ] Accessing `/prontidao` while unauthenticated redirects to `/login` (status 307).
- [ ] Accessing `/login` while unauthenticated is allowed.
- [ ] Accessing a protected route with a valid session works.

### Task 6 — Create `lib/supabase/service-role.ts` (bypass client for internal jobs)

**Purpose:** Export a service-role client for Edge Functions, cron jobs, and authorized server-side operations.

**File location:** `project-r/src/lib/supabase/service-role.ts`

**Requirements:**
- [ ] Import `createClient` from `@supabase/supabase-js` (the low-level client).
- [ ] Use `SUPABASE_SERVICE_ROLE_KEY` from server env vars **only** (never expose to browser).
- [ ] Create a client that bypasses RLS (useful for admin operations, batch jobs, migrations).
- [ ] Include a prominent JSDoc warning:
  ```typescript
  /**
   * ⚠️ RESTRICTED SERVICE-ROLE CLIENT
   *
   * This client bypasses Row-Level Security (RLS) and can access all data.
   * Only use in:
   * - Edge Functions (Supabase)
   * - Cron jobs (pg_cron)
   * - Authorized Server Actions (must verify auth.club_id() is correct)
   *
   * NEVER use in browser code or for user-initiated mutations without RLS layer above.
   * ESLint rule blocks imports outside whitelisted paths.
   */
  ```
- [ ] Export as a named export `serviceRoleClient` or default export.
- [ ] Do **not** export this from `lib/supabase/index.ts` (force explicit import path to be visible in code review).

**Verification:**
- [ ] Service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` env var (available in server environment).
- [ ] The client can be imported only from explicit `lib/supabase/service-role.ts` path.
- [ ] Importing it from a Client Component (in `app/` route) causes a build error (verified in next task).

### Task 7 — Add ESLint rule to restrict service-role imports

**Purpose:** Prevent accidental use of service-role client in browser code.

**File location:** `project-r/.eslintrc.json` (or equivalent config file)

**Requirements:**
- [ ] Add an import restriction rule:
  ```json
  {
    "rules": {
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            {
              "name": "path/to/lib/supabase/service-role",
              "importNames": ["*"],
              "message": "❌ Service-role client cannot be imported outside whitelisted paths (Edge Functions, cron jobs). Use lib/supabase/client.ts or lib/supabase/server.ts instead."
            }
          ],
          "patterns": [
            {
              "group": ["**/lib/supabase/service-role"],
              "except": [
                "**/supabase/functions/**",
                "**/lib/actions/**",
                "**/lib/supabase/service-role.ts"
              ],
              "message": "❌ Service-role client restricted. Allowed only in supabase/functions/ and lib/actions/ with explicit auth checks."
            }
          ]
        }
      ]
    }
  }
  ```
- [ ] Verify the rule is in place and referenced in the ESLint config.

**Verification:**
- [ ] `npm run lint` succeeds if no service-role imports exist outside whitelisted paths.
- [ ] Intentionally import service-role in a Client Component and verify lint fails with the custom message.

### Task 8 — Create `lib/supabase/index.ts` (convenience re-exports)

**Purpose:** Provide a single import path for common Supabase utilities.

**File location:** `project-r/src/lib/supabase/index.ts`

**Requirements:**
- [ ] Export browser client:
  ```typescript
  export { createClient, supabase } from './client';
  ```
- [ ] Export server client:
  ```typescript
  export { createServerClient } from './server';
  ```
- [ ] Export middleware helpers:
  ```typescript
  export { updateSession } from './middleware';
  ```
- [ ] **Do NOT export service-role** (force explicit import to make code reviews visible).

**Verification:**
- [ ] Importing `{ createClient } from '@/lib/supabase'` works.
- [ ] Importing service-role from this barrel export fails (ESLint catches it).

### Task 9 — Seed multi-tenant test data

**Purpose:** Create fixtures with 2 clubs, 3 roles, 2 users per role for RLS testing.

**File location:** `project-r/supabase/seed.sql` (or `supabase/migrations/<date>_seed_multitenant.sql` if used once)

**Requirements:**
- [ ] Create 2 test clubs: "Club A" and "Club B".
- [ ] For each club, create 3 users via Supabase Auth (using service role) or mock in tests:
  - [ ] coach-a@test.test / password (role=coach, club_id=club_a)
  - [ ] analyst-a@test.test / password (role=analyst, club_id=club_a)
  - [ ] player-a@test.test / password (role=player, club_id=club_a)
  - [ ] coach-b@test.test / password (role=coach, club_id=club_b)
  - [ ] analyst-b@test.test / password (role=analyst, club_id=club_b)
  - [ ] player-b@test.test / password (role=player, club_id=club_b)
- [ ] Insert corresponding `profiles` rows for each user.
- [ ] Create a few dummy rows in other tables (e.g., `players`, `sessions`) scoped by `club_id` so RLS has data to filter.

**Verification:**
- [ ] Running `supabase db reset --no-seed` then `supabase seed` populates the test data.
- [ ] Querying `profiles` directly shows 6 users across 2 clubs.

### Task 10 — Write integration tests for cross-tenant RLS isolation

**Purpose:** Verify AC #1 and AC #2 — RLS blocks cross-tenant access and enforces "with check".

**File location:** `project-r/__tests__/supabase-multitenant.test.ts`

**Test suite: "Multi-tenant RLS isolation"**

**Test case 1: SELECT cross-tenant rows returns empty**
```
Given user from club A (coach-a@test.test)
When they query SELECT * FROM profiles WHERE club_id = club_b.id
Then the result is an empty array (RLS silently filters)
```

**Test case 2: INSERT with mismatched club_id is rejected**
```
Given user from club A
When they attempt INSERT INTO profiles (..., club_id=club_b.id, ...)
Then the insert fails with error "new row violates row-level security policy"
And no row is created
```

**Test case 3: UPDATE on own row is allowed**
```
Given user from club A
When they update their own profile (same club_id, same user)
Then the update succeeds
And their row is modified
```

**Test case 4: UPDATE to change club_id fails**
```
Given user from club A with profile.club_id = club_a.id
When they attempt UPDATE profiles SET club_id = club_b.id WHERE id = self
Then the update fails (RLS with check rejects)
```

**Test case 5: READ own club data is allowed**
```
Given user from club A
When they query SELECT * FROM profiles WHERE club_id = club_a.id
Then they get their own profile and other club A users
And they do NOT get club B profiles
```

**Test case 6: Role constraint is enforced**
```
Given an attempt to INSERT profile with role = 'invalid'
When inserted
Then the insert fails with CHECK constraint violation
And only profiles with role IN ('coach','analyst','player') are allowed
```

**Requirements:**
- [ ] Use `supabase` test client or mock auth with JWT.
- [ ] For each test, create isolated auth context (mock JWT claim or real Supabase client authenticated as specific user).
- [ ] Verify the result (empty array, error message, row count) matches expectation.
- [ ] Coverage: ≥80% of RLS policy paths (read with matching club, read with mismatched club, write with check, etc.).

**Verification:**
- [ ] `npm run test -- supabase-multitenant.test.ts` passes all 6 cases.
- [ ] Adding a `toHaveBeenCalledWith` assertion on the RLS policy count confirms policies are active.

### Task 11 — Test service-role restriction via ESLint

**Purpose:** Verify AC #4 — service-role import is blocked outside whitelisted paths.

**File location:** `project-r/__tests__/eslint-service-role.test.ts` or manual verification

**Requirement:**
- [ ] Create a mock file at `src/app/login/page.tsx` with an intentional import:
  ```typescript
  import { serviceRoleClient } from '@/lib/supabase/service-role'; // ❌ Should fail lint
  ```
- [ ] Run `npm run lint` and verify the build fails with the custom message.
- [ ] Remove the import and verify lint passes.

**Verification:**
- [ ] ESLint rule correctly rejects service-role imports in Client Components.
- [ ] ESLint rule allows imports in whitelisted paths (e.g., `lib/actions/`).

### Task 12 — Test middleware authentication gate

**Purpose:** Verify AC #5 — middleware redirects unauthenticated users and refreshes sessions.

**File location:** `project-r/__tests__/middleware.test.ts`

**Test case 1: Unauthenticated request to protected route redirects to /login**
```
Given a request to /prontidao with no auth cookie
When processed by middleware
Then the response is a 307 redirect to /login
```

**Test case 2: Authenticated request is allowed**
```
Given a request to /prontidao with valid auth cookie
When processed by middleware
Then the response is 200 OK or passes through
```

**Test case 3: Session is refreshed on each request**
```
Given an authenticated request with near-expired JWT
When processed by middleware
Then auth.refreshSession() is called
And refreshed tokens are written to the response cookie
```

**Requirement:**
- [ ] Use Next.js `testMiddleware` utilities or mock `NextRequest`/`NextResponse`.
- [ ] Mock Supabase `auth.refreshSession()` to verify it's called.
- [ ] Verify redirect target is `/login` (307 status).

**Verification:**
- [ ] `npm run test -- middleware.test.ts` passes all 3 cases.

### Task 13 — Add type definitions for Supabase Database

**Purpose:** Enable TypeScript IntelliSense for Supabase queries.

**File location:** `project-r/src/types/supabase.ts`

**Requirements:**
- [ ] Generate types from Supabase project:
  ```bash
  supabase gen types typescript --local > src/types/supabase.ts
  ```
- [ ] Add to `.env.local` if needed: `SUPABASE_DB_URL` for local generation.
- [ ] Verify the types include `profiles`, `clubs`, and other tables created in Story 1.3.
- [ ] Import and use in Supabase clients:
  ```typescript
  import { Database } from '@/types/supabase';
  const client = createClient<Database>(...);
  ```

**Verification:**
- [ ] TypeScript autocomplete shows available table columns when writing `.from('profiles').select()`.
- [ ] Type checking catches schema mismatches (e.g., selecting non-existent column).

### Task 14 — Document configuration and deployment

**Purpose:** Ensure future developers know how to set up and troubleshoot multi-tenant RLS.

**File location:** `project-r/docs/multi-tenant-setup.md` or equivalent

**Document contents:**
- [ ] Overview: "Story 1.6 establishes multi-tenant isolation via RLS. All Supabase queries are scoped by `club_id = auth.club_id()`."
- [ ] How to verify RLS is working: "In Supabase Dashboard, query `SELECT * FROM pg_policies;` to list all RLS policies."
- [ ] How to use each client helper:
  - `lib/supabase/client.ts` — browser/Client Components
  - `lib/supabase/server.ts` — Server Actions, Server Components
  - `lib/supabase/service-role.ts` — Edge Functions, cron jobs (restricted)
- [ ] How to test: "Run integration tests with `npm run test -- supabase-multitenant.test.ts`."
- [ ] Common pitfalls: service-role in browser, missing "with check" on writes, etc.

**Verification:**
- [ ] Document is accessible from project root or docs folder.
- [ ] New developer can follow the document to set up local environment.

### Task 15 — Verify all ACs are satisfied

**Purpose:** Final checklist before marking ready-for-dev complete.

**Acceptance Criteria Checklist:**
- [ ] AC #1: Cross-tenant RLS isolation verified via integration test (no club B rows returned).
- [ ] AC #2: RLS "with check" prevents cross-tenant INSERT (tested and fails as expected).
- [ ] AC #3: Helper files follow conventions (`client.ts`, `server.ts`, `middleware.ts`, `service-role.ts`).
- [ ] AC #4: Service-role import restricted via ESLint (build fails on violation).
- [ ] AC #5: Middleware refreshes session and redirects unauthenticated users (tested).
- [ ] AC #6: Profiles enforce single-role CHECK constraint (SQL verified and tested).
- [ ] AC #7: Integration tests provide ≥80% coverage of RLS scenarios (test suite passes).

**Verification:**
- [ ] `npm run build` succeeds with no warnings.
- [ ] `npm run lint` succeeds with no violations.
- [ ] `npm run test` passes all tests including RLS and middleware.
- [ ] All documentation is in place and clear.

---

## Notes & Learnings

### From Previous Stories

**Story 1.5 (Auth Flow):**
- Login form validation uses Zod with inline error alerts (`<Alert>`).
- Supabase Auth recovery flow handles non-enumeration naturally.
- Logout should call `supabaseClient.auth.signOut()` and redirect to `/login`.

**Story 1.4 (JWT Custom Claims):**
- JWT hook injects `club_id` and `role` as string claims.
- These are accessed in SQL via `auth.club_id()` and `auth.user_role()` helpers.
- If the hook fails (no profile row), the JWT is issued without claims (graceful fallback).

**Story 1.3 (Migrations & RLS):**
- `club_id` is a foreign key in every table with multi-tenant data.
- RLS policies use `club_id = auth.club_id()` for read access.
- `WITH CHECK` on write policies prevents cross-club mutations.

### RLS Gotchas

1. **SELECT always filters by RLS; INSERT/UPDATE/DELETE need explicit WITH CHECK:**
   - Omitting `WITH CHECK` on UPDATE means a coach can update a row and change its `club_id` to another club (bypass!).
   - Always use `WITH CHECK (club_id = auth.club_id())` on mutating policies.

2. **RLS is silent:** When a query would return 0 rows due to RLS, it doesn't error — it just returns empty. Same with a rejected write — `INSERT` fails with a generic "violates RLS" error, not a custom message. This is by design (don't leak data).

3. **Indexes on club_id are mandatory for performance:** If a table has 100k rows across 2 clubs and no index on `club_id`, a query filters via sequential scan (slow). `idx_<table>_club_id` solves this.

4. **Middleware must run on protected routes only:** Setting matcher to `["/*"]` adds unnecessary overhead to static assets. Use a smart matcher to exclude `/_next`, `/_vercel`, etc.

5. **Service-role client bypasses all RLS:** There's no Supabase setting to "partially" bypass RLS — either you use RLS-respecting auth or service-role. Use service-role sparingly and always with defensive code (e.g., `club_id` checks in application logic).

### Multi-Tenant Testing

- **Don't rely on a single club for RLS tests:** If all test data is in club A, you can't verify that cross-tenant isolation works. Always seed ≥2 clubs with different users.
- **Mock JWT claims carefully:** If your test mocks `auth.club_id()` to return "club-a" but your fixture inserts "club-b", the test won't catch real bugs. Ensure mock values match fixtures.
- **Test the error case, not just the success case:** Verify that a cross-tenant write fails, not just that a same-tenant write succeeds.

### Deployment & Operations

- **Verify RLS policies in production:** After deploying migrations, open Supabase Dashboard and query `SELECT tablename, policyname FROM pg_policies ORDER BY tablename;`. Ensure every table with `club_id` has RLS enabled and ≥1 policy.
- **Check JWT hook logs if RLS queries fail:** If RLS is enforced but users can't access their data, the JWT claim might not be injected. Check Supabase Edge Function logs for `auth-hook` errors.
- **Monitor for RLS policy violations in logs:** Supabase logs INSERT/UPDATE/DELETE failures due to RLS. If a client app is consistently failing, investigate if a new mutation wasn't scoped correctly.

---

## Completion Status

**Story Status:** ready-for-dev

**Prerequisite Stories:** ✅ 1.1, 1.2, 1.3, 1.4, 1.5

**Estimated Effort:** 1.5 days (client helpers, middleware, tests, docs)

**Next Story After This:** 1.7 (MFA) or 1.8 (Design System Foundation) — both can be parallel-tracked

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase @supabase/ssr](https://github.com/supabase/supabase-js/tree/main/packages/ssr)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [OWASP Multitenant Architecture](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_SaaS_Security_Cheat_Sheet.html) — background reading on SaaS isolation patterns
