-- Migration: 000290_attendances
-- Story 6.7: Registo de Presenças em Sessões
-- Attendance records per player per session (FR30)

CREATE TABLE IF NOT EXISTS attendances (
  id           uuid        PRIMARY KEY DEFAULT uuidv7(),
  club_id      uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id    uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status       text        NOT NULL CHECK (status IN ('present','absent','late','injured','excused')),
  note         text,
  recorded_by  uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

COMMENT ON TABLE attendances IS 'Presenças por sessão e jogador (FR30)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS attendances_session_id_idx ON attendances (session_id);
CREATE INDEX IF NOT EXISTS attendances_player_id_idx  ON attendances (player_id);
CREATE INDEX IF NOT EXISTS attendances_club_session_idx ON attendances (club_id, session_id);

-- RLS
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read" ON attendances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = attendances.club_id
    )
  );

CREATE POLICY "staff write" ON attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = attendances.club_id
    )
  );

CREATE POLICY "staff update" ON attendances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = attendances.club_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = attendances.club_id
    )
  );
