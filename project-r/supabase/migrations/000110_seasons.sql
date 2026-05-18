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

-- All authenticated club members can read seasons (direct profile lookup — consistent with 000097)
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT TO authenticated
  USING (club_id = (
    SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Only coach/analyst can create seasons
CREATE POLICY "seasons_insert" ON seasons
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst')
    )
  );

-- Only coach/analyst can update their own club's seasons
CREATE POLICY "seasons_update" ON seasons
  FOR UPDATE TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst')
    )
  );

-- Atomic swap: unsets all current seasons for club, then sets the given one
-- SECURITY DEFINER bypasses RLS; role + club isolation enforced inside function
CREATE OR REPLACE FUNCTION public.set_current_season(p_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT club_id INTO v_club_id FROM profiles WHERE id = auth.uid() LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found or missing club_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst')
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges: only coach/analyst can set current season';
  END IF;

  UPDATE seasons SET is_current = false WHERE club_id = v_club_id;
  UPDATE seasons SET is_current = true WHERE id = p_season_id AND club_id = v_club_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_current_season TO authenticated;
