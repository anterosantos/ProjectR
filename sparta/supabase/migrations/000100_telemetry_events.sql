-- Migration: 000100_telemetry_events
-- Purpose: Create telemetry_events table for internal KPI tracking (NFR22, NFR56)
-- Scope: Service-role only; no user-facing reads; fire-and-forget pattern

-- =============================================================================
-- 'telemetry_events' table — internal analytics (no PII)
-- =============================================================================

CREATE TABLE telemetry_events (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (length(kind) > 0),
  payload_json jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_telemetry_events_club_occurred ON telemetry_events(club_id, occurred_at DESC);
CREATE INDEX idx_telemetry_events_kind ON telemetry_events(kind);

COMMENT ON TABLE telemetry_events IS 'Internal telemetry events for product KPIs and monitoring. No PII. Service-role only (read-restricted). Examples: survey_submitted, panel_viewed, event_recorded, sync_drained, offline_sync_pending.';
COMMENT ON COLUMN telemetry_events.id IS 'UUIDv7 primary key — sortable and collision-resistant.';
COMMENT ON COLUMN telemetry_events.club_id IS 'Multi-tenant scoping. Used for club-level KPI aggregation.';
COMMENT ON COLUMN telemetry_events.kind IS 'Event type (enum-like). Examples: ''survey_submitted'', ''panel_viewed'', ''event_recorded'', ''sync_drained'', ''offline_page_shown''.';
COMMENT ON COLUMN telemetry_events.payload_json IS 'Structured event data (must be valid JSON). No PII except UUIDs. Examples: { playerId, sessionId, durationMs, offline }, { reason, syncCount }.';
COMMENT ON COLUMN telemetry_events.occurred_at IS 'Server timestamp (TZ-aware, stored UTC). Immutable.';

-- =============================================================================
-- RLS POLICIES — telemetry_events (NFR22, AR31)
-- =============================================================================

ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service-Role Insert Only
-- Effect: Only service-role can INSERT. All other operations blocked (including SELECT for authenticated users).
-- Rationale: Telemetry is system-internal, not for user consumption. Analytics handled server-side or via separate reporting tool.
CREATE POLICY "telemetry_events_service_only" ON telemetry_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Service-role has implicit full access (no explicit grants needed)
-- Authenticated users have NO grants (no SELECT, INSERT, UPDATE, DELETE)

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "telemetry_events_service_only" ON telemetry_events IS
  'Only service-role can INSERT telemetry events (via app Server Actions or background jobs). No user-facing reads. Supports NFR22 (No third-party analytics) and AR31 (Restricted telemetry writes).';
