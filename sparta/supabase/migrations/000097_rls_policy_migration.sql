-- Migration: 000097_rls_policy_migration
-- Purpose: Migrate RLS policies from JWT custom claims to direct database lookups
-- Context: The auth hook Edge Function had configuration issues preventing JWT claim injection.
--          Direct profile lookups are more reliable and eliminate external dependencies.
-- Date: 2026-05-18

-- ============================================================================
-- Background:
-- ============================================================================
-- Previous policies (000070, 000090) relied on JWT custom claims injected by
-- an auth hook Edge Function:
--   public.club_id()  -> auth.jwt() ->> 'club_id'
--   public.user_role() -> auth.jwt() ->> 'user_role'
--
-- Issue: The Edge Function required JWT authentication, creating a circular
-- dependency: couldn't generate JWT because auth hook failed.
--
-- Solution: Replace custom claims with direct database lookups via profiles table.
-- This approach is:
--   - More reliable (no external dependency)
--   - Simpler to maintain (pure SQL)
--   - Still performant (indexed lookups)

-- ============================================================================
-- 1. players table — UPDATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "staff_write_own_club" ON players;

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

-- ============================================================================
-- 2. positions table — UPDATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "positions_staff_read_write" ON positions;

CREATE POLICY "positions_staff_read_write" ON positions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = (
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = (
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
  );

-- ============================================================================
-- 3. player_metrics table — UPDATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "club isolation read" ON player_metrics;
DROP POLICY IF EXISTS "staff write own club" ON player_metrics;
DROP POLICY IF EXISTS "staff update own club" ON player_metrics;

CREATE POLICY "club_isolation_read" ON player_metrics
  FOR SELECT TO authenticated
  USING (club_id = (
    SELECT club_id FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  ));

CREATE POLICY "staff_write_own_club" ON player_metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = (
      SELECT club_id FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('coach', 'analyst')
    )
  );

CREATE POLICY "staff_update_own_club" ON player_metrics
  FOR UPDATE TO authenticated
  USING (
    club_id = (
      SELECT club_id FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('coach', 'analyst')
    )
  );

-- ============================================================================
-- Notes:
-- ============================================================================
-- - The public.club_id() and public.user_role() functions are still defined
--   in migration 000030 but no longer used. They can be removed in a future
--   migration if confirmed unused elsewhere.
--
-- - Auth hook Edge Function can now be safely disabled:
--   Authentication → Hooks → Customize Access Token (JWT) Claims hook
--
-- - All three tables now use consistent pattern:
--   1. Lookup user's club_id from profiles
--   2. Check if user has coach/analyst role
--   3. Enforce club isolation + role checks via RLS
--
-- - Performance: Direct lookups via indexed columns (id, club_id, role)
--   are comparable to JWT claim extraction. No performance regression expected.

COMMENT ON POLICY "staff_write_own_club" ON players IS
  'Staff (coach/analyst) can insert/update/delete players in their own club. Uses direct profile lookup instead of JWT claims.';

COMMENT ON POLICY "positions_staff_read_write" ON positions IS
  'Staff can manage positions for players in their own club. Checks both player ownership and staff role.';

COMMENT ON POLICY "staff_write_own_club" ON player_metrics IS
  'Staff can record metrics for players in their own club.';

COMMENT ON POLICY "staff_update_own_club" ON player_metrics IS
  'Staff can update metrics for players in their own club.';
