-- Migration: 000120_sessions
-- Purpose: Sessions table for training/match/friendly calendar management (FR30)

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('training', 'match', 'friendly')),
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 90 CHECK (duration_min BETWEEN 15 AND 240),
  location text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance: club_id queries scoped per tenant (NFR1)
CREATE INDEX idx_sessions_club ON sessions(club_id);

-- Performance: season-scoped queries
CREATE INDEX idx_sessions_season ON sessions(season_id);

-- Performance: chronological listing by date
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);

COMMENT ON TABLE sessions IS 'Training, match, and friendly sessions per club and season';
COMMENT ON COLUMN sessions.type IS 'training | match | friendly';
COMMENT ON COLUMN sessions.status IS 'scheduled | cancelled | completed';
COMMENT ON COLUMN sessions.duration_min IS 'Duration in minutes (15–240)';
COMMENT ON COLUMN sessions.scheduled_at IS 'UTC timestamp; rendered in Europe/Lisbon by client';

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- All authenticated club members can read sessions (direct profile lookup — consistent with 000110)
CREATE POLICY "sessions_select" ON sessions
  FOR SELECT TO authenticated
  USING (club_id = (
    SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Only coach can create sessions
CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Only coach can update sessions
CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Deletions forbidden; use cancellation status instead
CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE USING (false);
