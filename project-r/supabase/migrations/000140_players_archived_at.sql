-- Migration: 000140_players_archived_at
-- Purpose: Add archived_at timestamp to players for retention policy (FR16, NFR16)

ALTER TABLE players
  ADD COLUMN archived_at timestamptz;

-- Composite index for fast queries of archived players by timestamp per club
CREATE INDEX idx_players_club_archived_at ON players(club_id, archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN players.archived_at IS
  'Timestamp when player was permanently archived (is_archived=true). NULL for active players. Used to calculate 5-season anonymization window (NFR16).';
