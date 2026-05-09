-- Migration: 000040_profiles_rls
-- Purpose: Implement Row-Level Security policies for multi-tenant isolation
-- Context: Enforces club isolation and role-based access control at database layer

---

-- =============================================================================
-- RLS POLICIES FOR 'profiles' TABLE
-- =============================================================================

-- Policy 1: Club Isolation Read
-- Effect: Authenticated users can only SELECT profiles in their own club
-- Used by: Coaches/analysts viewing squad, players seeing roster
CREATE POLICY "club_isolation_read" ON profiles
  FOR SELECT
  TO authenticated
  USING (club_id = public.get_club_id());

-- Policy 2: Self Update
-- Effect: Users can only UPDATE their own profile (id = auth.uid())
-- Used by: Updating own full_name, preferences, etc.
CREATE POLICY "self_update" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Insert Own Profile
-- Effect: Users can insert their own profile during signup
-- Used by: Post-signup profile creation (will be paired with auth hook in Story 1.4)
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

---

-- =============================================================================
-- RLS POLICIES FOR 'clubs' TABLE
-- =============================================================================

-- Policy 1: Staff Club Read
-- Effect: Coaches and analysts can read their club's metadata
-- Used by: Fetching club name, country, created_at for UI
-- Note: Simpler than profiles because clubs have fewer sensitive fields
CREATE POLICY "staff_club_read" ON clubs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.club_id = clubs.id
        AND profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'analyst')
    )
  );

-- Note: Players don't need explicit club read access if they only query via app code
-- (app code handles club context). This policy is conservative (staff-only).

---

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index: profiles(club_id)
-- Purpose: Efficient filtering in WHERE club_id = ? queries (RLS + app queries)
-- Impact: ~100x faster on 1000+ row tables
-- Note: May already exist from 000020_clubs_profiles.sql; using IF NOT EXISTS for idempotency
CREATE INDEX IF NOT EXISTS idx_profiles_club ON profiles(club_id);

-- Index: profiles(role)
-- Purpose: Efficient filtering by role (future: dashboard aggregations by role)
-- Impact: Useful for "get all players" or "get all coaches" queries
-- Note: May already exist from 000020_clubs_profiles.sql; using IF NOT EXISTS for idempotency
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

---

-- =============================================================================
-- GRANTS (for app code access)
-- =============================================================================

-- Allow authenticated users to read/write their own profiles
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Allow authenticated users to read clubs
GRANT SELECT ON clubs TO authenticated;

-- Allow anon to do nothing on these tables (unauthenticated users have no access)
-- GRANT SELECT ON profiles TO anon;  -- Intentionally NOT granted
-- GRANT SELECT ON clubs TO anon;     -- Intentionally NOT granted

---

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "club_isolation_read" ON profiles IS
'Users can only SELECT profiles in their club. Primary security boundary for multi-tenant isolation.';

COMMENT ON POLICY "self_update" ON profiles IS
'Users can only UPDATE their own profile row. Prevents cross-user manipulation.';

COMMENT ON POLICY "insert_own_profile" ON profiles IS
'Users can INSERT their own profile during signup. Paired with auth hook (Story 1.4) to populate club_id.';

COMMENT ON POLICY "staff_club_read" ON clubs IS
'Coaches/analysts can read clubs they belong to. Simple check prevents unauthorized club metadata access.';
