-- Migration: 000130_match_lineups
-- Purpose: Match squad selection - convocados and starting XI lineup management (FR24)
-- Schema: match_lineups with multi-tenant RLS isolation via session_id → sessions.club_id

CREATE TABLE match_lineups (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('starter', 'bench', 'convocado_only')),
  shirt_num int CHECK (shirt_num IS NULL OR (shirt_num > 0 AND shirt_num <= 99)),
  started_minute int DEFAULT 0,
  ended_minute int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: no duplicate player per session
CREATE UNIQUE INDEX idx_match_lineups_session_player
  ON match_lineups(session_id, player_id);

-- Performance: queries by session and role (e.g., get all starters for a session)
CREATE INDEX idx_match_lineups_session_role
  ON match_lineups(session_id, role);

-- Performance: lookup by session
CREATE INDEX idx_match_lineups_session
  ON match_lineups(session_id);

-- Performance: lookup by player
CREATE INDEX idx_match_lineups_player
  ON match_lineups(player_id);

-- Trigger updated_at (reuse set_updated_at from 000160)
CREATE TRIGGER match_lineups_updated_at
  BEFORE UPDATE ON match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT — coach/analyst from the club can see lineups for sessions in their club
-- Multi-tenant isolation via session_id → sessions.club_id
CREATE POLICY "match_lineups_select_club_isolation" ON match_lineups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = public.club_id()
    )
    AND public.user_role() IN ('coach', 'analyst')
  );

-- RLS: INSERT — coach only (only coach can create/submit lineups)
CREATE POLICY "match_lineups_insert_coach_only" ON match_lineups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = public.club_id()
    )
  );

-- RLS: UPDATE — coach can update lineups pre-kickoff
-- Business logic (post-kickoff lock) enforced in application layer
CREATE POLICY "match_lineups_update_coach" ON match_lineups
  FOR UPDATE TO authenticated
  USING (
    public.user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = public.club_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = public.club_id()
    )
  );

-- RLS: DELETE — coach can delete lineups (for cleanup when re-submitting)
CREATE POLICY "match_lineups_delete_coach" ON match_lineups
  FOR DELETE TO authenticated
  USING (
    public.user_role() = 'coach'
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = public.club_id()
    )
  );

-- Service role full access
CREATE POLICY "service_role_all_match_lineups" ON match_lineups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE match_lineups TO authenticated;
GRANT ALL ON TABLE match_lineups TO service_role;

COMMENT ON TABLE match_lineups IS 'Match squad selection: convocados (called up) and starting XI for matches and friendlies (FR24)';
COMMENT ON COLUMN match_lineups.role IS 'Player role: starter (XI), bench, or convocado_only (called up but not in XI/bench)';
COMMENT ON COLUMN match_lineups.shirt_num IS 'Shirt number for starter; optional (1-99)';
COMMENT ON COLUMN match_lineups.started_minute IS 'Minute player entered the field; populated by Epic 6 (FR36)';
COMMENT ON COLUMN match_lineups.ended_minute IS 'Minute player left the field; populated by Epic 6 (FR36)';
