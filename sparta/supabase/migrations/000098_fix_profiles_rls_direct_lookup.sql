-- Migration: 000098_fix_profiles_rls_direct_lookup
-- Purpose: Fix profiles SELECT policy to not depend on JWT claims (auth.club_id())
-- Context: Migration 000097 updated players/positions/player_metrics policies to use
--          direct DB lookups (SELECT club_id FROM profiles WHERE id = auth.uid()).
--          However, the profiles SELECT policy still uses public.club_id() which reads
--          from JWT claims. With the auth hook disabled, public.club_id() returns NULL,
--          blocking all profile reads and cascading to break all policies that sub-select
--          from profiles.
-- Solution: Introduce a SECURITY DEFINER helper that reads club_id directly from the DB
--           (bypassing profiles RLS), then use it in the profiles SELECT policy.

-- SECURITY DEFINER helper: reads caller's club_id from profiles without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_club_id() TO authenticated;

-- Update profiles SELECT policy to use direct DB lookup instead of JWT claim
DROP POLICY IF EXISTS "club_isolation_read" ON profiles;

CREATE POLICY "club_isolation_read" ON profiles
  FOR SELECT TO authenticated
  USING (club_id = public.get_my_club_id());

COMMENT ON FUNCTION public.get_my_club_id() IS
  'Returns the authenticated user''s club_id via direct DB lookup. '
  'SECURITY DEFINER breaks the RLS circular dependency when profiles is sub-selected '
  'within another table''s policy check.';

COMMENT ON POLICY "club_isolation_read" ON profiles IS
  'Authenticated users can read profiles belonging to their own club. '
  'Uses get_my_club_id() SECURITY DEFINER helper to avoid JWT dependency.';
