-- Migration: 000240_session_metrics
-- Purpose: Tabela de métricas de sessão por jogador — sRPE calculado (FR33, NFR1, NFR5)
-- Stories: 5.1 — sRPE Calculation & Persistence per Session
-- RGPD: dados de esforço percebido (saúde, Art. 9) — requerem auditedRead() ao nível do Server Action
-- Dependências: sessions, players, clubs (já existentes)

-- =============================================================================
-- session_metrics — tabela principal
-- =============================================================================

CREATE TABLE session_metrics (
  id           uuid        NOT NULL DEFAULT public.uuidv7(),
  club_id      uuid        NOT NULL REFERENCES clubs(id)    ON DELETE CASCADE,
  session_id   uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id    uuid        NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  srpe_value   int         NOT NULL CHECK (srpe_value BETWEEN 1 AND 10),
  duration_min int         NOT NULL CHECK (duration_min BETWEEN 15 AND 240),
  srpe_load    int GENERATED ALWAYS AS (srpe_value * duration_min) STORED,
  computed_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT session_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT session_metrics_unique_player_session UNIQUE (session_id, player_id)
);

-- =============================================================================
-- Índices de performance (NFR1, NFR5)
-- =============================================================================

-- Queries ACWR por jogador ordenadas por data (Story 5.2)
CREATE INDEX idx_session_metrics_player_computed
  ON session_metrics(player_id, computed_at DESC);

-- Scoping multi-clube (AR9)
CREATE INDEX idx_session_metrics_club
  ON session_metrics(club_id);

-- =============================================================================
-- Comentários RGPD (dados de saúde, Art. 9)
-- =============================================================================

COMMENT ON TABLE session_metrics IS
  'Métricas de sessão por jogador: sRPE calculado (Session-RPE × duração). Dados de esforço percebido — saúde, RGPD Art. 9. Leituras de staff passam por auditedRead() (Story 3.11).';

COMMENT ON COLUMN session_metrics.id IS
  'UUIDv7 gerado pelo servidor via uuidv7().';

COMMENT ON COLUMN session_metrics.club_id IS
  'Isolamento multi-clube (AR9). Preenchido pelo servidor com o club_id do jogador.';

COMMENT ON COLUMN session_metrics.srpe_value IS
  'Session Rating of Perceived Exertion: 1–10 (Foster scale). Fornecido pelo jogador no questionário pós-sessão.';

COMMENT ON COLUMN session_metrics.duration_min IS
  'Duração da sessão em minutos (15–240). Copiado de sessions.duration_min no momento do upsert.';

COMMENT ON COLUMN session_metrics.srpe_load IS
  'Carga sRPE calculada: srpe_value × duration_min. Coluna GENERATED STORED — calculada automaticamente pelo PostgreSQL.';

COMMENT ON COLUMN session_metrics.computed_at IS
  'Data/hora do cálculo. Actualizado em cada upsert.';

-- =============================================================================
-- Row Level Security (AR8, NFR16)
-- =============================================================================

ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) do mesmo clube pode fazer SELECT
-- (leitura efectiva passa por auditedRead() no Server Action — Story 3.11, FR50)
CREATE POLICY "staff_reads_club" ON session_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = session_metrics.club_id
    )
  );

-- Jogador NÃO tem acesso directo (dados mediados — Story 4.6)
-- Sem política para role 'player' → acesso bloqueado por omissão

-- =============================================================================
-- GRANTS
-- Authenticated: SELECT e INSERT/UPDATE (service-role bypassa RLS para writes)
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON session_metrics TO authenticated;
