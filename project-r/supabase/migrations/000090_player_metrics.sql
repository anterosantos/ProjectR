-- Migration: 000090_player_metrics
-- Purpose: Time-series weight & height readings per player (FR13, NFR1)

CREATE TABLE player_metrics (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  club_id     uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id   uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  weight_kg   numeric(5,2),
  height_cm   numeric(5,2),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club isolation read" ON player_metrics
  FOR SELECT USING (club_id = auth.club_id());

CREATE POLICY "staff write own club" ON player_metrics
  FOR INSERT WITH CHECK (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

CREATE POLICY "staff update own club" ON player_metrics
  FOR UPDATE USING (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

CREATE INDEX idx_player_metrics_player_recorded
  ON player_metrics (player_id, recorded_at DESC);

CREATE INDEX idx_player_metrics_club
  ON player_metrics (club_id);

COMMENT ON TABLE player_metrics IS
  'Time-series physical measurements (weight/height) per player. Multiple readings per player allowed; readings are never overwritten. (FR13)';
