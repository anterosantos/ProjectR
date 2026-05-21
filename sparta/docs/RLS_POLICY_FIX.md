# RLS Policy Fix: Custom Claims Migration

**Status:** ✅ Resolved (2026-05-18)

## Problem

Users received **403 Forbidden (RLS violation)** errors when trying to create players, even after:
- Profile existed with correct `role = 'coach'`
- User was authenticated
- Club ID was correct

### Root Cause

The RLS policies for `players`, `positions`, and `player_metrics` tables relied on **custom JWT claims** injected by an auth hook:

```sql
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'))
  WITH CHECK (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'));
```

The helper functions:
- `public.club_id()` → extracted `auth.jwt() ->> 'club_id'`
- `public.user_role()` → extracted `auth.jwt() ->> 'user_role'`

**The auth hook (Edge Function) had a configuration issue:**
1. Edge Function required JWT authentication (`UNAUTHORIZED_NO_AUTH_HEADER` error)
2. This created a chicken-and-egg problem: couldn't generate JWT because auth hook failed
3. Without custom claims in JWT, RLS policies failed

## Solution

Migrated RLS policies from **JWT custom claims** to **direct database lookups** via `profiles` table.

### Changes Applied

#### 1. **Disabled Auth Hook**
- Turned off "Customize Access Token (JWT) Claims hook" in Authentication → Hooks
- Edge Function auth hook no longer needed

#### 2. **Updated RLS Policies**

**Before (using custom claims):**
```sql
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'))
  WITH CHECK (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'));
```

**After (direct profile lookup):**
```sql
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (
    club_id = (
      SELECT club_id FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('coach','analyst')
    )
  )
  WITH CHECK (
    club_id = (
      SELECT club_id FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('coach','analyst')
    )
  );
```

#### Tables Updated:
- ✅ `players` — SELECT, INSERT, UPDATE, DELETE
- ✅ `positions` — INSERT, UPDATE for player-related operations
- ✅ `player_metrics` — SELECT, INSERT, UPDATE

### Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Dependency** | Edge Function (external, fragile) | Direct DB lookup (reliable) |
| **Auth Flow** | Blocked if hook failed | Works independently |
| **Performance** | One function call + DB query | One subquery in RLS |
| **Maintainability** | Requires Edge Function management | Pure SQL, version-controlled |

## Files Changed

```
sparta/supabase/migrations/
├── 000070_players_positions.sql (updated RLS policies)
└── 000090_player_metrics.sql (updated RLS policies)
```

## Migration Path

If you have an existing Supabase project with the old policies:

1. **Disable auth hook:**
   - Authentication → Hooks
   - Toggle off "Customize Access Token (JWT) Claims hook"

2. **Run SQL migration:**
   ```bash
   supabase db push
   ```
   Or manually execute the policy updates in SQL Editor.

3. **Test:**
   - Login
   - Create a player
   - Verify player appears in team list

## Testing

See `__tests__/rls-policies.integration.test.ts` for regression tests validating:
- Staff can create players in their club
- Staff cannot create players in another club
- Non-staff (players) cannot create players
- Position records respect parent player ownership
- Metrics records respect club isolation

Run tests:
```bash
npm run test rls-policies
```

## Notes

- Auth helper functions (`public.club_id()`, `public.user_role()`) are still defined but no longer used
- They can be removed in a future migration if not used elsewhere
- The service_role still has full access (unchanged)

## Related Issues

- **Epic:** Story 1.3 AC #3 (Auth helpers & RLS)
- **Decision:** Use direct DB lookups instead of JWT custom claims for RLS policies
- **Validated by:** Manual testing (player creation workflow)
