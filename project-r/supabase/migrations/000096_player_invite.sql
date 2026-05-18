-- Migration: 000095_player_invite
-- Purpose: Add email + invite tracking columns to players table (Story 2.10)
-- Slot 000095 is free between 000090 (player_metrics) and 000100 (telemetry_events)

ALTER TABLE players
  ADD COLUMN email text,
  ADD COLUMN invite_sent_at timestamptz;

-- Unique index to prevent email race conditions per club (ignores NULL emails)
CREATE UNIQUE INDEX idx_players_club_email_unique
  ON players(club_id, email)
  WHERE email IS NOT NULL;

COMMENT ON COLUMN players.email IS
  'Email do jogador usado no convite (nullable — preenchido quando convite é enviado).';
COMMENT ON COLUMN players.invite_sent_at IS
  'Timestamp do último convite enviado. NULL = sem convite enviado ainda.';
