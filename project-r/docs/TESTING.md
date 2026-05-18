# Testing Guide

This document covers testing strategies for Project R, including RLS policies, API endpoints, and component tests.

## Quick Start

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- rls-policies

# Run tests with coverage
npm run test -- --coverage
```

## Integration Tests: RLS Policies

**File:** `__tests__/rls-policies.integration.test.ts`

Tests the Row-Level Security (RLS) policies that enforce:
- ✅ Club isolation (users only access their club's data)
- ✅ Role-based access (coach/analyst can manage players, players cannot)
- ✅ Relationship constraints (positions/metrics respect player ownership)

### Why These Tests Matter

RLS policies are the primary security layer preventing unauthorized data access. Regression tests ensure:

1. **No accidental policy bypasses** — catches if policies get disabled or weakened
2. **Multi-tenancy safety** — validates club isolation still works after changes
3. **Role enforcement** — verifies staff vs. player permissions

### Test Coverage

| Table | Scenario | Expected Result |
|-------|----------|-----------------|
| `players` | Coach creates player in own club | ✅ Success |
| `players` | Analyst creates player in own club | ✅ Success |
| `players` | Player tries to create player | ❌ RLS denied (PGRST301) |
| `players` | Coach creates player in other club | ❌ RLS denied (PGRST301) |
| `positions` | Coach adds position to player | ✅ Success |
| `positions` | Player adds position | ❌ RLS denied (PGRST301) |
| `player_metrics` | Coach records metrics | ✅ Success |
| `player_metrics` | Player records metrics | ❌ RLS denied (PGRST301) |

### Running RLS Tests

```bash
npm run test -- rls-policies
```

**Requirements:**
- Supabase project running (local or cloud)
- `.env.local` with valid credentials:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```

### Test Cleanup

Tests automatically clean up:
- Test auth users (deleted after tests)
- Test clubs (cascade deletes related data)
- Test players, positions, metrics

If tests fail during cleanup, you can manually remove test data:

```sql
-- Find and delete orphaned test data
SELECT * FROM clubs WHERE name LIKE 'Test Club%';
DELETE FROM clubs WHERE name LIKE 'Test Club%';
```

## Known Issues & Fixes

### Issue: `UNAUTHORIZED_NO_AUTH_HEADER` when creating players

**Status:** ✅ Fixed in migration 000097

**Solution:** Migrated RLS policies from JWT custom claims to direct database lookups.
See [RLS_POLICY_FIX.md](./RLS_POLICY_FIX.md) for details.

## Unit Tests

**Run unit tests:**
```bash
npm run test -- --exclude="**/integration.test.ts"
```

## Adding New Tests

When adding features that touch RLS-protected tables:

1. **Add integration test** to `__tests__/rls-policies.integration.test.ts`
2. **Document** why the test exists (security boundary?)
3. **Run full test suite** before committing:
   ```bash
   npm run test --run
   ```

## CI/CD Integration

Tests run automatically on:
- Pull requests (before merge)
- Pushes to main (before deploy)

See `.github/workflows/test.yml` for CI configuration.
