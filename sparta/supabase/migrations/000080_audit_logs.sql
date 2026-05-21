-- Migration: 000080_audit_logs
-- Purpose: Create audit_logs table for compliance evidence and access transparency (FR50, FR51, NFR16)
-- Scope: Multi-tenant audit trail; RLS policies enforce club + player privacy

-- =============================================================================
-- 'audit_logs' table — immutable audit trail
-- =============================================================================

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  -- actor_id is nullable: SET NULL when the actor's profile is deleted (preserves audit trail integrity)
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  target_kind text NOT NULL CHECK (target_kind ~ '^[a-z][a-z0-9_]*$'),
  target_id uuid,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_club_occurred ON audit_logs(club_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_target_id ON audit_logs(target_id);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail. Records every significant action (fatigue.submitted, event.recorded, export.requested, etc.). Supports compliance (FR50), subject visibility (FR51), and monitoring (NFR16).';
COMMENT ON COLUMN audit_logs.id IS 'UUIDv7 primary key — sortable and collision-resistant.';
COMMENT ON COLUMN audit_logs.club_id IS 'Multi-tenant scoping. RLS policies enforce club isolation.';
COMMENT ON COLUMN audit_logs.actor_id IS 'User who performed the action. NULL when actor account has been deleted (GDPR erasure preserves audit record with tombstoned actor).';
COMMENT ON COLUMN audit_logs.action IS 'Action name in domain.verb format (e.g., ''fatigue.submitted'', ''event.recorded'', ''export.requested'', ''decision.marked'')';
COMMENT ON COLUMN audit_logs.target_kind IS 'Type of target affected in snake_case (e.g., ''fatigue_response'', ''match_event'', ''player'', ''readiness_snapshot'')';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of target row, if applicable. Nullable for aggregate actions (e.g., ''panel.viewed'').';
COMMENT ON COLUMN audit_logs.payload IS 'Additional JSON context. Examples: { duration_ms: 123, offline: false }, { decision_reason: "..." }. No PII.';
COMMENT ON COLUMN audit_logs.occurred_at IS 'Server timestamp (TZ-aware, stored UTC). Immutable.';

-- =============================================================================
-- RLS POLICIES — audit_logs (FR50, FR51, NFR16)
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Player Self-Visibility
-- Effect: Titulares (players) can SELECT entries where target_id = their user ID (see who accessed their health data — FR51)
CREATE POLICY "audit_logs_player_read" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    target_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'player'
  );

-- Policy 2: Staff Club Oversight
-- Effect: Coaches and analysts can SELECT all audit entries for their club (club oversight — NFR16)
CREATE POLICY "audit_logs_staff_read" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    club_id = public.club_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'analyst')
  );

-- Policy 3: Authenticated INSERT
-- Effect: Authenticated users can INSERT audit entries for their own club and as themselves only
CREATE POLICY "audit_logs_authenticated_insert" ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = public.club_id()
    AND actor_id = auth.uid()
  );

-- Policy 4: Service-Role Write & Admin
-- Effect: Service-role can perform all operations (system operations, seed, corrections)
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Service-role has implicit full access (no explicit grants needed)
-- Authenticated users: INSERT restricted to own club + self (via policy above); SELECT via player/staff policies

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "audit_logs_player_read" ON audit_logs IS
  'Players can query their own access history (target_id = auth.uid()). Supports FR51 (Subject Right: Who Accessed My Data).';

COMMENT ON POLICY "audit_logs_staff_read" ON audit_logs IS
  'Staff (coaches, analysts) can query all audit logs for their club. Supports NFR16 (Auditoria e logs de acesso).';

COMMENT ON POLICY "audit_logs_authenticated_insert" ON audit_logs IS
  'Authenticated users can INSERT entries for their own club (club_id = public.club_id()) and as themselves (actor_id = auth.uid()). Used by logAccess() Server Action.';

COMMENT ON POLICY "audit_logs_service_insert" ON audit_logs IS
  'Service-role can perform all operations. Used by seed/admin tooling or background maintenance jobs.';
