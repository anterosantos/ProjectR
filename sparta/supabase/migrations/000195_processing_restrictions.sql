-- Migration: 000195_processing_restrictions
-- Purpose: Adicionar colunas processing_restricted + restricted_at em profiles e players (RGPD Art. 18 — FR49)
-- Stories: 3.9 — Direito de Limitação do Tratamento

-- =============================================================================
-- profiles — colunas de limitação de tratamento
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN processing_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN restricted_at timestamptz;

-- CHECK constraint: se processing_restricted=true então restricted_at deve estar preenchido
ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_processing_restricted_at
    CHECK ((processing_restricted = false AND restricted_at IS NULL) OR (processing_restricted = true AND restricted_at IS NOT NULL));

-- Índice parcial para queries de enforcement (só entradas activas)
CREATE INDEX idx_profiles_processing_restricted ON profiles(processing_restricted)
  WHERE processing_restricted = true;

COMMENT ON COLUMN profiles.processing_restricted IS
  'RGPD Art. 18: Titular marcou a sua conta como "tratamento limitado". Sistema não regista novos dados enquanto true.';
COMMENT ON COLUMN profiles.restricted_at IS
  'Timestamp em que processing_restricted foi activado. NULL quando false.';

-- =============================================================================
-- players — colunas de limitação de tratamento (para menores geridos por Encarregado via token)
-- =============================================================================

ALTER TABLE players
  ADD COLUMN processing_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN restricted_at timestamptz;

-- CHECK constraint: se processing_restricted=true então restricted_at deve estar preenchido
ALTER TABLE players
  ADD CONSTRAINT chk_players_processing_restricted_at
    CHECK ((processing_restricted = false AND restricted_at IS NULL) OR (processing_restricted = true AND restricted_at IS NOT NULL));

CREATE INDEX idx_players_processing_restricted ON players(processing_restricted)
  WHERE processing_restricted = true;

COMMENT ON COLUMN players.processing_restricted IS
  'RGPD Art. 18: Encarregado limitou o tratamento do menor via token público.';
COMMENT ON COLUMN players.restricted_at IS
  'Timestamp em que processing_restricted foi activado para o jogador. NULL quando false.';

-- =============================================================================
-- GRANTS — profiles
-- =============================================================================
-- A policy "self_update" existente (000040_profiles_rls.sql) cobre UPDATE com USING (id = auth.uid())
-- e é suficiente para a RLS. O GRANT coluna-a-coluna é o que restringe o que authenticated pode escrever.
-- As Server Actions usam service_role pelo que não precisam deste GRANT — mas o titular pode precisar
-- de ler o estado via client (SELECT já está concedido em 000040).
-- Adicionar UPDATE nas novas colunas para authenticated (par com a policy "self_update"):
GRANT UPDATE (processing_restricted, restricted_at) ON profiles TO authenticated;

-- =============================================================================
-- GRANTS — players
-- =============================================================================
-- players não é directamente actualizável por authenticated — as Server Actions usam service_role.
-- Nenhum GRANT adicional necessário.
