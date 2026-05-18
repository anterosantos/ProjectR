-- Migration: 000110_seasons
-- Purpose: Seasons table for temporal scoping of session/match data (FR20)

CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one current season per club (enforced at DB level)
CREATE UNIQUE INDEX idx_seasons_one_current ON seasons(club_id) WHERE is_current = true;

-- Performance: club_id queries scoped per tenant (NFR1)
CREATE INDEX idx_seasons_club ON seasons(club_id);

COMMENT ON TABLE seasons IS 'Temporal boundaries for session/match data per club';
COMMENT ON COLUMN seasons.is_current IS
  'true = active season for data entry. Only one per club enforced via partial unique index.';

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- All authenticated club members can read seasons
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT USING (club_id = auth.club_id());

-- Only coach/analyst can create seasons
CREATE POLICY "seasons_insert" ON seasons
  FOR INSERT WITH CHECK (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

-- Only coach/analyst can update their own club's seasons
CREATE POLICY "seasons_update" ON seasons
  FOR UPDATE USING (
    club_id = auth.club_id()
    AND auth.user_role() IN ('coach', 'analyst')
  );

-- Atomic swap: unsets all current seasons for club, then sets the given one
-- SECURITY DEFINER bypasses RLS for the swap operation
CREATE OR REPLACE FUNCTION public.set_current_season(p_season_id uuid, p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE seasons SET is_current = false WHERE club_id = p_club_id;
  UPDATE seasons SET is_current = true WHERE id = p_season_id AND club_id = p_club_id;
END;
$$;
