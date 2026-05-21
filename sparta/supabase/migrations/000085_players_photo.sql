-- Migration: 000085_players_photo
-- Purpose: Add photo storage path to players (FR12, FR13, NFR44)
-- Description: Adds photo_path column to players table to store reference to Supabase Storage

ALTER TABLE players ADD COLUMN photo_path text;

COMMENT ON COLUMN players.photo_path IS
  'Storage path in format club_id/player_id.ext (e.g., d8a3f5c1-2b4a-4e7f-9c1b-5d6e8f9a2c3d/a7f8c9e1-2b4a-4e7f-9c1b-5d6e8f9a2c3d.webp), null if no photo uploaded. Photos are stored privately in Supabase Storage bucket "player-photos" with RLS policies enforcing club isolation.';
