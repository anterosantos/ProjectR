-- 000260_data_decisions.sql
-- Story 5.10: Data-Driven Decision Input + Audit (FR52)
-- Tabela para registar decisões de roster/gestão informadas por dados do painel de prontidão.
-- player_id ON DELETE CASCADE — eliminação GDPR automática via migration 000185
-- session_id ON DELETE SET NULL — cancelar sessão não elimina a decisão

CREATE TABLE IF NOT EXISTS data_decisions (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  club_id       uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id     uuid        REFERENCES players(id) ON DELETE CASCADE,
  session_id    uuid        REFERENCES sessions(id) ON DELETE SET NULL,
  actor_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  decision_kind text        NOT NULL
    CHECK (decision_kind IN ('roster', 'management', 'load_adjustment', 'rest', 'other')),
  note          text,
  was_data_driven boolean   NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read own club" ON data_decisions
  FOR SELECT TO authenticated
  USING (
    club_id = auth.club_id()
    AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"')
  );

CREATE POLICY "staff insert own club" ON data_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = auth.club_id()
    AND (auth.jwt() -> 'user_role')::text IN ('"coach"', '"analyst"')
  );

CREATE POLICY "actor update within 24h" ON data_decisions
  FOR UPDATE TO authenticated
  USING (
    club_id = auth.club_id()
    AND actor_id = auth.uid()
    AND created_at + INTERVAL '24 hours' > NOW()
  )
  WITH CHECK (club_id = auth.club_id());

GRANT SELECT, INSERT, UPDATE ON data_decisions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_data_decisions_club_created
  ON data_decisions (club_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_decisions_player_created
  ON data_decisions (player_id, created_at DESC);
