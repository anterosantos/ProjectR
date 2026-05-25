-- Migration: 000250_readiness_snapshots
-- Purpose: Tabela materializada de prontidão por jogador-sessão — fonte para o Painel (FR34, NFR1)
-- Stories: 5.3 — Readiness Snapshots
-- RGPD: dados de saúde derivados (Art. 9) — acesso via staff, nunca por jogador (dados mediados FR26)
-- Dependências: sessions, players, clubs, session_metrics (000240), computeAcwr() (Story 5.2)

-- =============================================================================
-- readiness_snapshots — tabela principal (materialização)
-- =============================================================================

CREATE TABLE readiness_snapshots (
  player_id            uuid        NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  session_id           uuid        NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  club_id              uuid        NOT NULL REFERENCES clubs(id)     ON DELETE CASCADE,
  state                text        NOT NULL DEFAULT 'neutral'
    CHECK (state IN ('ready', 'caution', 'alert', 'neutral')),
  acwr                 numeric(4,2),
  acwr_band_lo         numeric(4,2),
  acwr_band_hi         numeric(4,2),
  recent_fatigue_avg   numeric(3,2),
  attendance_rate      numeric(3,2),
  data_sufficient      boolean     NOT NULL DEFAULT false,
  derived_age_group    text,
  computed_at          timestamptz NOT NULL DEFAULT now(),
  version              bigint      NOT NULL DEFAULT 1,

  CONSTRAINT readiness_snapshots_pkey PRIMARY KEY (player_id, session_id)
);

-- =============================================================================
-- Índices de performance (NFR1: Painel ≤2s para 40 jogadores)
-- =============================================================================

-- Queries do Painel por sessão (story 5.4 lê por session_id)
CREATE INDEX idx_readiness_snapshots_session_player
  ON readiness_snapshots(session_id, player_id);

-- Scoping multi-clube (AR9)
CREATE INDEX idx_readiness_snapshots_club
  ON readiness_snapshots(club_id);

-- =============================================================================
-- RLS (Row-Level Security) — Isolamento por clube
-- =============================================================================

ALTER TABLE readiness_snapshots ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) do mesmo clube podem ler
-- Nenhuma política para players — dados mediados, acesso negado sempre (FR26)
CREATE POLICY "staff_reads_club" ON readiness_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = readiness_snapshots.club_id
    )
  );

-- SEM política INSERT/UPDATE para authenticated
-- Service-role bypassa RLS — apenas o service-role escreve aqui
-- Players NUNCA devem ver esta tabela (dados mediados, FR26)

-- =============================================================================
-- Permissões (GRANT)
-- =============================================================================

-- authenticated pode ler (RLS filtra por clube e role)
-- INSERT/UPDATE apenas via service-role (bypassa RLS) — sem política INSERT/UPDATE para authenticated
-- Não conceder INSERT/UPDATE a authenticated: RLS só tem policy SELECT; qualquer GRANT de escrita
-- a authenticated abriria escrita cross-club via PostgREST sem protecção.
GRANT SELECT ON readiness_snapshots TO authenticated;

-- =============================================================================
-- Comentários RGPD (dados de saúde derivados, Art. 9)
-- =============================================================================

COMMENT ON TABLE readiness_snapshots IS
  'Materialização de prontidão (readiness) por jogador-sessão. Dados de saúde derivados (ACWR, fadiga média) — RGPD Art. 9. Acesso restrito a staff (coach/analyst) do mesmo clube via RLS. Players NUNCA lêem isto — dados mediados (FR26). Escrito apenas via service-role (Story 5.3 refreshSnapshotForSession).';

COMMENT ON COLUMN readiness_snapshots.player_id IS
  'Referência ao jogador.';

COMMENT ON COLUMN readiness_snapshots.session_id IS
  'Referência à sessão. Uma row por jogador por sessão.';

COMMENT ON COLUMN readiness_snapshots.club_id IS
  'Isolamento multi-clube (AR9). Preenchido pelo servidor.';

COMMENT ON COLUMN readiness_snapshots.state IS
  'Estado de prontidão: ready (verde) | caution (amarelo) | alert (vermelho) | neutral (sem dados). Determinado por classifyReadinessState().';

COMMENT ON COLUMN readiness_snapshots.acwr IS
  'Rácio ACWR (Acute/Chronic Workload Ratio) — computeAcwr() de Story 5.2.';

COMMENT ON COLUMN readiness_snapshots.acwr_band_lo IS
  'Limite inferior do intervalo de confiança ACWR para o escalão etário.';

COMMENT ON COLUMN readiness_snapshots.acwr_band_hi IS
  'Limite superior do intervalo de confiança ACWR para o escalão etário.';

COMMENT ON COLUMN readiness_snapshots.recent_fatigue_avg IS
  'Média das 5 dimensões de fadiga (energy, focus, sleep, soreness, mood) dos últimos 7 dias. NULL se sem respostas.';

COMMENT ON COLUMN readiness_snapshots.attendance_rate IS
  'Taxa de presença (épocas posteriores — Epic 6 Story 6.7). NULL nesta story.';

COMMENT ON COLUMN readiness_snapshots.data_sufficient IS
  'Flag: tem dados históricos suficientes para ACWR válido. Se false, state = neutral sempre.';

COMMENT ON COLUMN readiness_snapshots.derived_age_group IS
  'Escalão etário (u14, u15, u17, u19, senior) usado para limiares ACWR.';

COMMENT ON COLUMN readiness_snapshots.computed_at IS
  'Timestamp do cálculo (refresh).';

COMMENT ON COLUMN readiness_snapshots.version IS
  'Optimistic locking version — incrementado a cada upsert. Previne race conditions em upsets concorrentes.';
