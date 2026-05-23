-- Migration: 000200_fatigue_responses
-- Purpose: Tabela de respostas ao questionário de fadiga — 5 dimensões + sRPE opcional (FR21, FR23, NFR48)
-- Stories: 4.1 — Fatigue Response Schema & Idempotent Server Action
-- RGPD: dados de saúde (NFR16, AR8, AR9)

-- =============================================================================
-- fatigue_responses — tabela principal
-- =============================================================================

CREATE TABLE fatigue_responses (
  id             uuid        NOT NULL DEFAULT uuidv7(),
  club_id        uuid        NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  player_id      uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id     uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  phase          text        NOT NULL CHECK (phase IN ('pre', 'post')),
  dim_energy     int         NOT NULL CHECK (dim_energy BETWEEN 1 AND 5),
  dim_focus      int         NOT NULL CHECK (dim_focus BETWEEN 1 AND 5),
  dim_sleep      int         NOT NULL CHECK (dim_sleep BETWEEN 1 AND 5),
  dim_soreness   int         NOT NULL CHECK (dim_soreness BETWEEN 1 AND 5),
  dim_mood       int         NOT NULL CHECK (dim_mood BETWEEN 1 AND 5),
  srpe_value     int             NULL CHECK (srpe_value BETWEEN 1 AND 10),
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  submitted_via  text        NOT NULL DEFAULT 'online' CHECK (submitted_via IN ('online', 'offline-drain')),

  CONSTRAINT fatigue_responses_pkey PRIMARY KEY (id),
  CONSTRAINT fatigue_responses_unique_phase UNIQUE (player_id, session_id, phase)
);

-- =============================================================================
-- Índices de performance (NFR1, NFR4, AR9)
-- =============================================================================

CREATE INDEX idx_fatigue_responses_player_submitted
  ON fatigue_responses(player_id, submitted_at DESC);

CREATE INDEX idx_fatigue_responses_club
  ON fatigue_responses(club_id);

-- =============================================================================
-- Comentários de compliance (RGPD, dados de saúde)
-- =============================================================================

COMMENT ON TABLE fatigue_responses IS
  'Respostas ao questionário de fadiga por sessão. Dados de saúde — sujeitos a RGPD Art. 9.';

COMMENT ON COLUMN fatigue_responses.id IS
  'UUIDv7 gerado pelo cliente (NFR48, AR4). ON CONFLICT (id) DO UPDATE garante idempotência no replay offline.';

COMMENT ON COLUMN fatigue_responses.club_id IS
  'Isolamento multi-clube (AR9). Preenchido pelo servidor com o club_id do jogador autenticado.';

COMMENT ON COLUMN fatigue_responses.phase IS
  'pre = antes da sessão; post = após a sessão. Único por (player_id, session_id, phase).';

COMMENT ON COLUMN fatigue_responses.dim_energy IS
  'Nível de energia subjetivo: 1 (muito baixo) → 5 (muito alto).';

COMMENT ON COLUMN fatigue_responses.dim_focus IS
  'Nível de foco/concentração subjetivo: 1 → 5.';

COMMENT ON COLUMN fatigue_responses.dim_sleep IS
  'Qualidade do sono: 1 (muito mau) → 5 (excelente).';

COMMENT ON COLUMN fatigue_responses.dim_soreness IS
  'Dor muscular/cansaço físico: 1 (muito elevado) → 5 (sem dor).';

COMMENT ON COLUMN fatigue_responses.dim_mood IS
  'Estado de humor: 1 (muito mau) → 5 (excelente).';

COMMENT ON COLUMN fatigue_responses.srpe_value IS
  'sRPE (Session Rating of Perceived Exertion) 1–10. Apenas permitido na fase post. NULL em pre.';

COMMENT ON COLUMN fatigue_responses.submitted_via IS
  'online = submissão directa; offline-drain = replay do outbox Dexie (Story 4.4, FR23).';

-- =============================================================================
-- Row Level Security (AR8, NFR16)
-- =============================================================================

ALTER TABLE fatigue_responses ENABLE ROW LEVEL SECURITY;

-- Jogador vê as suas próprias respostas
CREATE POLICY "player_sees_own" ON fatigue_responses
  FOR SELECT USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

-- Staff (coach/analyst) lê e insere dentro do seu clube
CREATE POLICY "staff_reads_club" ON fatigue_responses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = fatigue_responses.club_id
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = fatigue_responses.club_id
    )
  );

-- Jogador insere apenas a sua própria resposta no seu clube
CREATE POLICY "player_inserts_own" ON fatigue_responses
  FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT ON fatigue_responses TO authenticated;
