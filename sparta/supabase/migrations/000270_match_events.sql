-- 000270_match_events.sql
-- Story 6.1: Match Events Schema — captura de eventos de performance (touchscreen)
-- player_id ON DELETE SET NULL — histórico preservado se jogador apagado (GDPR)
-- session_id ON DELETE CASCADE — apagar sessão apaga eventos associados

CREATE TABLE IF NOT EXISTS match_events (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  club_id       uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id    uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id     uuid        REFERENCES players(id) ON DELETE SET NULL,
  action        text        NOT NULL
    CHECK (action IN (
      'ball_loss','ball_recovery','shot_total','shot_on_target',
      'pass_completed','def_pressure','def_action_success','off_action_success'
    )),
  zone          text        NOT NULL
    CHECK (zone IN (
      'def_left','def_center','def_right',
      'mid_left','mid_center','mid_right',
      'att_left','att_center','att_right'
    )),
  occurred_at   timestamptz NOT NULL,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  captured_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  captured_via  text        NOT NULL
    CHECK (captured_via IN ('online', 'offline-drain')),
  is_deleted    boolean     NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  deleted_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- SELECT: staff do mesmo clube
CREATE POLICY "staff read own club" ON match_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = match_events.club_id
    )
  );

-- INSERT: staff do mesmo clube
CREATE POLICY "staff insert own club" ON match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = match_events.club_id
    )
  );

-- UPDATE: staff do mesmo clube (soft delete + upsert ON CONFLICT)
CREATE POLICY "staff update own club" ON match_events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = match_events.club_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = match_events.club_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON match_events TO authenticated;

-- idx por sessão ordenado por tempo (queries principais de visualização)
CREATE INDEX IF NOT EXISTS idx_match_events_session
  ON match_events (session_id, occurred_at DESC);

-- idx por jogador+sessão (agregações por jogador)
CREATE INDEX IF NOT EXISTS idx_match_events_player_session
  ON match_events (player_id, session_id);

-- idx por clube+soft-delete (filtro global is_deleted=false)
CREATE INDEX IF NOT EXISTS idx_match_events_club_deleted
  ON match_events (club_id, is_deleted);
