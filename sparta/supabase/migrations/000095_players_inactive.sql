-- Migration: 000095_players_inactive
-- Purpose: Add is_active + inactive_reason to players for soft temp-out status (FR15)
-- Distinction: is_archived=true = permanent removal; is_active=false = temporary out-of-rotation

ALTER TABLE players
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN inactive_reason text;

-- Composite index supports both active list (is_active=true) and inactive list (is_active=false)
-- scoped per club for multi-tenant isolation (NFR1)
CREATE INDEX idx_players_club_active ON players(club_id, is_active);

COMMENT ON COLUMN players.is_active IS
  'false = temporarily out-of-rotation (injury, leave). Distinct from is_archived=true which is permanent.';
COMMENT ON COLUMN players.inactive_reason IS
  'Optional free-text reason for inactivation (max 200 chars enforced at application layer).';
