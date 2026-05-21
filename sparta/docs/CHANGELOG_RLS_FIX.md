# Changelog: RLS Policy Migration (2026-05-18)

## Summary

Fixed **403 Forbidden** errors when creating players by migrating RLS policies from JWT custom claims to direct database lookups. This eliminates dependency on a fragile auth hook Edge Function.

## Files Changed

### Migrations
- **`supabase/migrations/000097_rls_policy_migration.sql`** (NEW)
  - Replaces RLS policies for `players`, `positions`, `player_metrics` tables
  - Migrates from `public.club_id()` and `public.user_role()` (JWT claims) to direct profile lookups
  - Fully reversible (old policies documented if needed)

### Documentation
- **`docs/RLS_POLICY_FIX.md`** (NEW)
  - Root cause analysis of the 403 error
  - Detailed before/after comparison of RLS policies
  - Migration path for existing projects

- **`docs/TESTING.md`** (NEW)
  - How to run integration tests
  - RLS policy test coverage matrix
  - Known issues and fixes

- **`CHANGELOG_RLS_FIX.md`** (THIS FILE)
  - Summary of changes

### Tests
- **`__tests__/rls-policies.integration.test.ts`** (NEW)
  - 14 test cases covering RLS enforcement
  - Tests club isolation, role-based access, relationship constraints
  - Prevents regression of RLS policies

## What Changed

### Before
```sql
-- RLS policy relied on JWT custom claims from auth hook
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'))
  WITH CHECK (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'));
```

### After
```sql
-- RLS policy queries profiles table directly
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (
    club_id = (
      SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach','analyst')
    )
  )
  WITH CHECK (
    club_id = (
      SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach','analyst')
    )
  );
```

## Tables Updated

| Table | Policy | Change |
|-------|--------|--------|
| `players` | `staff_write_own_club` | ✅ Migrated |
| `positions` | `positions_staff_read_write` | ✅ Migrated |
| `player_metrics` | `club_isolation_read` | ✅ Migrated |
| `player_metrics` | `staff_write_own_club` | ✅ Migrated |
| `player_metrics` | `staff_update_own_club` | ✅ Migrated |

## Impact

### Who This Affects
- ✅ Anyone creating players (staff)
- ✅ Anyone recording player positions or metrics
- ✅ Multi-tenant isolation (club1 staff can't access club2 data)

### Backwards Compatibility
- ✅ **Fully backwards compatible** — users don't need to re-authenticate
- ✅ Existing data is not modified
- ✅ Session tokens don't need to be regenerated

### Performance
- ⚡ **No performance regression** — direct lookups use indexed columns (id, club_id, role)
- 💾 **Reduced infrastructure complexity** — no more Edge Function dependency

## Testing

Run tests to validate RLS policies:

```bash
# Run RLS policy tests
npm run test -- rls-policies

# Full test suite
npm run test --run
```

**Test coverage:**
- 14 test cases
- 3 tables covered (players, positions, player_metrics)
- Club isolation validation
- Role-based access enforcement

## Deployment Instructions

### For Existing Projects

1. **Disable auth hook:**
   - Go to Supabase Dashboard
   - Authentication → Hooks
   - Toggle OFF "Customize Access Token (JWT) Claims hook"

2. **Apply migration:**
   ```bash
   supabase db push
   ```
   Or manually run SQL from `migrations/000097_rls_policy_migration.sql`

3. **Test:**
   ```bash
   npm run test -- rls-policies
   ```

4. **Deploy:**
   - No application code changes needed
   - Users can continue with existing sessions

### For New Projects

The fix is included in migrations. No special steps needed.

## Rollback

If needed, you can revert to JWT-based claims:

1. Restore old RLS policies from migrations 000070 and 000090
2. Re-enable auth hook in Supabase Dashboard
3. Restart auth service

(Not recommended unless auth hook is fixed — direct lookups are more reliable)

## FAQ

**Q: Do users need to log out and log back in?**  
A: No. Sessions remain valid. New logins will work without auth hook.

**Q: Will this work with offline mode?**  
A: Yes. The RLS policies work the same way — they just query the database instead of reading JWT claims.

**Q: What if auth hook was disabled before this?**  
A: That's exactly why this fix was needed! Direct lookups work whether auth hook is enabled or not.

**Q: Are the old helper functions still needed?**  
A: No. `public.club_id()` and `public.user_role()` functions in migration 000030 are now unused and can be removed in a future migration.

## Related Documentation

- [RLS Policy Fix - Technical Deep Dive](./RLS_POLICY_FIX.md)
- [Testing Guide](./TESTING.md)
- Architecture: See `epics.md` Story 1.3 AC #3 (Auth helpers & RLS)

## Support

If you encounter issues:

1. Check that profile exists: `SELECT * FROM profiles WHERE id = YOUR_USER_ID`
2. Verify role is 'coach' or 'analyst': `SELECT role FROM profiles WHERE id = YOUR_USER_ID`
3. Run test suite: `npm run test -- rls-policies`
4. Check Supabase logs for RLS violations

## Contact

For questions about this change, see `docs/RLS_POLICY_FIX.md` or project team.
