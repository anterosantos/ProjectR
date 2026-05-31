-- 000275_match_minutes_played.sql
-- Story 6.4: View derivada para minutos jogados por jogador por sessão
-- Lida por Painel, dashboards e story 6.8 (Session-RPE)
-- Apenas inclui jogadores que estiveram em campo (role='starter')
-- started_minute DEFAULT 0 (set no submitLineup para todos os jogadores)
-- ended_minute NULL = ainda em campo → usa duration_min no COALESCE

CREATE OR REPLACE VIEW match_minutes_played AS
SELECT
  ml.session_id,
  ml.player_id,
  s.duration_min,
  ml.started_minute,
  ml.ended_minute,
  COALESCE(ml.ended_minute, s.duration_min) - COALESCE(ml.started_minute, 0) AS minutes_played
FROM match_lineups ml
JOIN sessions s ON s.id = ml.session_id
WHERE ml.role = 'starter';

-- Bench que nunca entrou: excluídos pela WHERE clause
-- Jogador substituído: ended_minute set → minutes_played = ended_minute - started_minute
-- Starter até ao fim: ended_minute NULL → minutes_played = duration_min - 0

GRANT SELECT ON match_minutes_played TO authenticated;
GRANT SELECT ON match_minutes_played TO service_role;
