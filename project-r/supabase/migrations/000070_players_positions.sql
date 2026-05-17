-- Migration: 000070_players_positions
-- Purpose: Player records and positions for plantel management (FR12, FR13)

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  jersey_num int NOT NULL CHECK (jersey_num BETWEEN 1 AND 99),
  full_name text NOT NULL,
  birthdate date NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('u14','u15','u17','u19','senior')),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT public.uuidv7(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 4)
);

-- Unique jersey per club among active players
CREATE UNIQUE INDEX idx_players_jersey_club_active
  ON players(club_id, jersey_num)
  WHERE is_archived = false;

CREATE INDEX idx_players_club ON players(club_id);
CREATE INDEX idx_positions_player ON positions(player_id);

-- Trigger updated_at (reuse set_updated_at from 000160; OR REPLACE handles duplicates)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Players: club-scoped read
CREATE POLICY "club_isolation_read" ON players
  FOR SELECT TO authenticated
  USING (club_id = public.club_id());

-- Players: staff write (coach + analyst) with WITH CHECK
CREATE POLICY "staff_write_own_club" ON players
  FOR ALL TO authenticated
  USING (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'))
  WITH CHECK (club_id = public.club_id() AND public.user_role() IN ('coach','analyst'));

-- Players: player sees their own record
-- Note: Requires profile_id to be set. Players with profile_id=NULL cannot access their record (intentional).
CREATE POLICY "player_sees_own_record" ON players
  FOR SELECT TO authenticated
  USING (club_id = public.club_id() AND profile_id = auth.uid());

-- Positions: staff read/write via player ownership
CREATE POLICY "positions_staff_read_write" ON positions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = public.club_id()
        AND public.user_role() IN ('coach','analyst')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.club_id = public.club_id()
        AND public.user_role() IN ('coach','analyst')
    )
  );

-- Positions: player reads their own positions
CREATE POLICY "positions_player_read_own" ON positions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_id
        AND p.profile_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "service_role_all_players" ON players
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_positions" ON positions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE players IS 'Player roster records per club (FR12)';
COMMENT ON TABLE positions IS 'Player field positions with primary and alternatives (FR12)';
COMMENT ON COLUMN players.jersey_num IS 'Unique jersey number per club among active players (1-99)';
COMMENT ON COLUMN players.age_group IS 'Age group: u14, u15, u17, u19, senior';
COMMENT ON COLUMN players.is_archived IS 'Soft-delete: archived players hidden from plantel by default';
COMMENT ON COLUMN positions.is_primary IS 'Exactly one position per player must be primary';
COMMENT ON COLUMN positions.sort_order IS 'Display order (0=primary, 1-4=alternatives)';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE positions TO authenticated;
GRANT ALL ON TABLE players TO service_role;
GRANT ALL ON TABLE positions TO service_role;
