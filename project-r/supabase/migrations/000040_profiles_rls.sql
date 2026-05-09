-- Migration: 000040_profiles_rls
-- Purpose: RLS policies and grants enforcing multi-tenant isolation + role-based access (NFR16, AR8)
-- Patches applied (code review 2026-05-09):
--   P2: Column-level UPDATE grant (only full_name editable by user; role/club_id locked)
--   P3: Drop insert_own_profile policy → profile creation is service-role only (Story 1.4 auth hook)
--   P4: SECURITY DEFINER helper for staff_club_read (avoids RLS recursion through profiles)
--   P8: Indexes for profiles(club_id) and profiles(role) live in 000020 (no duplicates here)

-- =============================================================================
-- HELPER FUNCTION (P4) — bypasses RLS for clubs read policy
-- =============================================================================
-- staff_club_read needs to check `profiles` membership without applying profiles' own RLS
-- (which would require JWT context that may not be set in all flows). SECURITY DEFINER
-- runs as the function owner (postgres), bypassing the caller's RLS scope safely.

CREATE OR REPLACE FUNCTION public.is_staff_of_club(target_club_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS on profiles for this read.
  -- Function explicitly checks auth.uid() so it cannot be abused as a generic profile reader.
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.club_id = target_club_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('coach', 'analyst')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_staff_of_club FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_of_club TO authenticated, service_role;

COMMENT ON FUNCTION public.is_staff_of_club IS
  'SECURITY DEFINER helper: returns true if auth.uid() is a coach or analyst of target_club_id. Bypasses RLS on profiles for this membership check (safe because auth.uid() is always the caller).';

-- =============================================================================
-- RLS POLICIES — profiles
-- =============================================================================

-- Policy 1: Club Isolation Read
-- Effect: Authenticated users SELECT profiles in their own club only.
CREATE POLICY "club_isolation_read" ON profiles
  FOR SELECT
  TO authenticated
  USING (club_id = public.club_id());

-- Policy 2: Self Update
-- Effect: Users can UPDATE only their own profile row.
-- Note: Combined with the column-level GRANT below (only full_name updatable),
--       this fully prevents privilege escalation via role/club_id mutation.
CREATE POLICY "self_update" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3 (REMOVED — P3): insert_own_profile dropped.
-- Profile creation is restricted to service_role:
--   - Story 1.4 (auth hook) creates profiles server-side with validated club_id + role
--   - Admin tooling bootstraps initial coach/club via service_role client
-- This eliminates the pre-JWT INSERT vector where a user could self-assign role/club_id.

-- =============================================================================
-- RLS POLICIES — clubs
-- =============================================================================

-- Policy: Staff Club Read
-- Effect: Coaches and analysts SELECT their own club's metadata.
-- Implementation note (P4): uses SECURITY DEFINER helper to avoid recursing through
-- profiles RLS — which would require a populated JWT for the inner SELECT.
CREATE POLICY "staff_club_read" ON clubs
  FOR SELECT
  TO authenticated
  USING (public.is_staff_of_club(id));

-- Note: Players intentionally have no clubs read access here. UI surfaces club info
-- via app code that joins through profiles (already RLS-isolated). Revisit if
-- direct club metadata access becomes needed for player UX.

-- =============================================================================
-- GRANTS (P2) — column-level UPDATE prevents privilege escalation
-- =============================================================================
-- IMPORTANT: Supabase grants ALL privileges to `anon` and `authenticated` by default
-- via ALTER DEFAULT PRIVILEGES. We REVOKE all first, then re-GRANT only what's needed.
-- This is the only correct way to restrict privileges below the Supabase default.

-- Revoke Supabase default grants on profiles + clubs
REVOKE ALL ON profiles FROM anon, authenticated, PUBLIC;
REVOKE ALL ON clubs FROM anon, authenticated, PUBLIC;

-- profiles grants:
-- SELECT — allow authenticated users to read profiles (RLS narrows to own club)
GRANT SELECT ON profiles TO authenticated;
-- UPDATE — column-level: ONLY full_name. role and club_id are NOT updatable by user
-- (would require service_role for re-assignment, e.g. coach moving a player between teams).
GRANT UPDATE (full_name) ON profiles TO authenticated;
-- INSERT — NOT granted to authenticated. Profiles are created server-side only:
--   - Story 1.4 auth hook (after signup, with validated claims)
--   - Admin/seed tooling (initial coach + club bootstrap)
-- DELETE — NOT granted to authenticated. Cascade-delete from auth.users handles user
-- account removal (GDPR right-to-erasure). Manual deletes go via service_role.

-- clubs grants:
-- SELECT only for authenticated; create/update/delete owned by admin tooling (service_role).
GRANT SELECT ON clubs TO authenticated;

-- Anon role intentionally has NO grants on either table (unauthenticated has no access).

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "club_isolation_read" ON profiles IS
  'Users can only SELECT profiles in their club. Primary security boundary for multi-tenant isolation.';

COMMENT ON POLICY "self_update" ON profiles IS
  'Users can only UPDATE their own profile row. Combined with column-level UPDATE (full_name only), prevents role/club_id privilege escalation.';

COMMENT ON POLICY "staff_club_read" ON clubs IS
  'Coaches/analysts can read clubs they belong to. Uses SECURITY DEFINER helper is_staff_of_club() to avoid RLS recursion.';
