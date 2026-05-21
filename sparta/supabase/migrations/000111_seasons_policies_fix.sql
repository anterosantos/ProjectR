-- Migration: 000111_seasons_policies_fix
-- Purpose: Re-apply seasons RLS policies and grants that failed in 000110
-- Context: Migration 000110 partially applied on production (CREATE TABLE succeeded
--          but CREATE POLICY / FUNCTION statements failed silently). The push script
--          recorded 000110 as executed, so it will not retry. This migration uses
--          DROP IF EXISTS to be fully idempotent.

-- ============================================================================
-- Table-level grants (missing from 000110)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE seasons TO authenticated;
GRANT ALL ON TABLE seasons TO service_role;

-- ============================================================================
-- RLS policies — drop first so this migration is re-runnable
-- ============================================================================

DROP POLICY IF EXISTS "seasons_select" ON seasons;
DROP POLICY IF EXISTS "seasons_insert" ON seasons;
DROP POLICY IF EXISTS "seasons_update" ON seasons;

-- All authenticated club members can read seasons
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

-- ============================================================================
-- set_current_season RPC (re-create in case it also failed in 000110)
-- ============================================================================

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
