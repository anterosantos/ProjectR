# Multi-Tenant Setup — SPARTA

Story 1.6 establishes multi-tenant isolation via Row-Level Security (RLS).
All Supabase queries are automatically scoped by `club_id = public.club_id()`
derived from the user's JWT.

---

## Architecture Overview

```
Browser Request
  └─ src/proxy.ts            ← session refresh + auth gate (Next.js 16)
       └─ lib/supabase/middleware.ts  ← updateSession() helper
            └─ @supabase/ssr createServerClient

Server Actions / Components
  └─ lib/supabase/server.ts  ← createServerClient() (async cookies)

Client Components
  └─ lib/supabase/client.ts  ← createClient() / supabase singleton

Edge Functions / Cron Jobs (RESTRICTED)
  └─ lib/supabase/service-role.ts  ← bypasses RLS — import restricted by ESLint
```

---

## Client Helpers

| File | When to use |
|------|-------------|
| `lib/supabase/client.ts` | Browser code, Client Components, React hooks |
| `lib/supabase/server.ts` | Server Actions, Server Components, Route Handlers |
| `lib/supabase/middleware.ts` | `src/proxy.ts` only (session refresh) |
| `lib/supabase/service-role.ts` | Edge Functions, cron jobs — **RESTRICTED** |

### Browser client

```typescript
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
const { data } = await supabase.from("profiles").select("role");
```

### Server client (Server Actions)

```typescript
import { createServerClient } from "@/lib/supabase/server";
const supabase = await createServerClient();
const { data } = await supabase.from("profiles").select("role");
```

### Service-role client (restricted)

```typescript
// Only allowed in supabase/functions/ and src/lib/actions/
import { serviceRoleClient } from "@/lib/supabase/service-role";
```

---

## Verifying RLS is working

In the Supabase Dashboard, run:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
ORDER BY tablename;
```

Expected policies:
- `profiles` — `club_isolation_read` (SELECT), `self_update` (UPDATE)
- `clubs` — `staff_club_read` (SELECT)

Also confirm RLS is enabled on all tables:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('profiles', 'clubs');
```

Both should show `relrowsecurity = true`.

---

## SQL helpers

| Function | Returns | Used in |
|----------|---------|---------|
| `public.club_id()` | `uuid` | RLS policies — reads `club_id` JWT claim |
| `public.user_role()` | `text` | RLS policies — reads `role` JWT claim |
| `public.is_staff_of_club(uuid)` | `boolean` | `staff_club_read` policy on clubs |

> Note: helpers live in `public` schema (not `auth`) due to Supabase managed
> schema restrictions — documented in migration `000030_auth_helpers.sql`.

---

## Running integration tests

```bash
# From sparta/
npm run test -- supabase-multitenant.test.ts
npm run test -- proxy.test.ts
```

For true RLS validation (requires running Supabase locally):

```bash
supabase start
supabase db reset          # applies migrations + seed.sql
npm run test               # all tests
```

---

## Common pitfalls

1. **Service-role in browser**: `SUPABASE_SERVICE_ROLE_KEY` must never appear
   in client code. The ESLint rule `no-restricted-imports` blocks accidental
   imports outside whitelisted paths.

2. **Missing `WITH CHECK` on UPDATE**: Always pair an UPDATE RLS policy with
   `WITH CHECK (club_id = public.club_id())` to prevent a user from mutating
   their `club_id` to another club's value.

3. **Middleware not refreshing session**: The proxy calls `getUser()` (not
   `getSession()`) which validates the JWT server-side and refreshes tokens.
   Never skip this call.

4. **Single-club test fixtures**: Cross-tenant RLS tests only work when you
   seed ≥ 2 clubs. `supabase/seed.sql` creates Club Alpha and Club Beta.

5. **JWT hook failure**: If `public.club_id()` returns NULL, RLS policies
   fail-closed (no rows returned). Check Supabase Edge Function logs for the
   `auth-hook` function if users can't see their data.
