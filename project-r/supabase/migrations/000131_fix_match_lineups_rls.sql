-- Migration: 000131_fix_match_lineups_rls
-- Purpose: Fix RLS policies for match_lineups to use profiles table instead of JWT claims
-- Reason: JWT claim user_role may not be reliably set; validate directly from profiles table

-- Drop old policies that depend on public.user_role() JWT claim
DROP POLICY IF EXISTS "match_lineups_select_club_isolation" ON match_lineups;
DROP POLICY IF EXISTS "match_lineups_insert_coach_only" ON match_lineups;
DROP POLICY IF EXISTS "match_lineups_update_coach" ON match_lineups;
DROP POLICY IF EXISTS "match_lineups_delete_coach" ON match_lineups;

-- RLS: SELECT — coach/analyst from the club can see lineups for sessions in their club
-- Multi-tenant isolation via session_id → sessions.club_id
CREATE POLICY "match_lineups_select_club_isolation" ON match_lineups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('coach', 'analyst')
    )
  );

-- RLS: INSERT — coach only (only coach can create/submit lineups)
-- Note: Validate via profiles table instead of JWT claim for reliability
CREATE POLICY "match_lineups_insert_coach_only" ON match_lineups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

-- RLS: UPDATE — coach can update lineups pre-kickoff
-- Business logic (post-kickoff lock) enforced in application layer
CREATE POLICY "match_lineups_update_coach" ON match_lineups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );

-- RLS: DELETE — coach can delete lineups (for cleanup when re-submitting)
CREATE POLICY "match_lineups_delete_coach" ON match_lineups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
    )
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
        AND s.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
    )
  );
