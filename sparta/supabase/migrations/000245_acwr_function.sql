-- Migration: 000245_acwr_function
-- Purpose: Função PL/pgSQL compute_acwr — espelho da lógica TypeScript de ACWR
-- Stories: 5.2 — ACWR Calculation Engine with Age-Group Thresholds
-- Referência: lib/readiness/acwr.ts (TypeScript) + lib/readiness/thresholds.ts
--
-- NOTA CRÍTICA: O número 000240 já está ocupado por 000240_session_metrics.sql (Story 5.1).
-- Este ficheiro usa obrigatoriamente 000245.
--
-- A função é SECURITY DEFINER com search_path = public (padrão de segurança do projecto).
-- Dependências: players, session_metrics (ambas existentes após Stories 2.1 e 5.1).

-- =============================================================================
-- compute_acwr — função PL/pgSQL espelho do TypeScript
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_acwr(
  p_player_id uuid,
  p_as_of     timestamptz
)
RETURNS TABLE (
  acute          numeric,
  chronic        numeric,
  ratio          numeric,
  age_group      text,
  threshold_lo   numeric,
  threshold_hi   numeric,
  state          text,
  data_sufficient boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_age_group         text;
  v_threshold_lo      numeric;
  v_threshold_hi      numeric;
  v_window_start_28   timestamptz;
  v_window_start_7    timestamptz;
  v_acute             numeric;
  v_chronic_total     numeric;
  v_chronic           numeric;
  v_ratio             numeric;
  v_distinct_weeks    int;
  v_data_sufficient   boolean;
  v_state             text;
  v_distance          numeric;
BEGIN
  -- Janelas temporais (exclusive start, inclusive end — idêntico ao TypeScript)
  v_window_start_28 := p_as_of - INTERVAL '28 days';
  v_window_start_7  := p_as_of - INTERVAL '7 days';

  -- 1. Fetch age_group do jogador
  SELECT players.age_group INTO v_age_group
  FROM players
  WHERE players.id = p_player_id;

  -- Fallback para 'senior' se jogador não encontrado
  v_age_group := COALESCE(v_age_group, 'senior');

  -- 2. Limiares por escalão (espelho de ACWR_THRESHOLDS em thresholds.ts)
  v_threshold_lo := 0.8; -- Todos os escalões partilham limite inferior

  v_threshold_hi := CASE v_age_group
    WHEN 'u14' THEN 1.3
    WHEN 'u15' THEN 1.4
    ELSE 1.5  -- u17, u19, senior
  END;

  -- 3. Carga aguda: soma dos últimos 7 dias (asOf-7d, asOf]
  SELECT COALESCE(SUM(sm.srpe_load), 0) INTO v_acute
  FROM session_metrics sm
  WHERE sm.player_id = p_player_id
    AND sm.computed_at >  v_window_start_7
    AND sm.computed_at <= p_as_of;

  -- 4. Carga crónica total: soma dos últimos 28 dias (asOf-28d, asOf]
  SELECT COALESCE(SUM(sm.srpe_load), 0) INTO v_chronic_total
  FROM session_metrics sm
  WHERE sm.player_id = p_player_id
    AND sm.computed_at >  v_window_start_28
    AND sm.computed_at <= p_as_of;

  -- chronic = total / 4 (divisor fixo, não número de semanas com dados)
  v_chronic := v_chronic_total / 4.0;

  -- 5. Rácio (null se chronic = 0)
  IF v_chronic > 0 THEN
    v_ratio := v_acute / v_chronic;
  ELSE
    v_ratio := NULL;
  END IF;

  -- 6. Suficiência de dados: semanas ISO distintas com ≥ 1 entrada ≥ 4
  -- EXTRACT(week FROM ...) retorna semana ISO (1-53)
  -- Combinar com ano ISO para evitar colisões entre anos
  SELECT COUNT(DISTINCT (
    EXTRACT(isoyear FROM sm.computed_at)::int * 100 +
    EXTRACT(week    FROM sm.computed_at)::int
  )) INTO v_distinct_weeks
  FROM session_metrics sm
  WHERE sm.player_id = p_player_id
    AND sm.computed_at >  v_window_start_28
    AND sm.computed_at <= p_as_of;

  v_data_sufficient := v_distinct_weeks >= 4;

  -- 7. Classificação de estado (espelho de classifyAcwrState em acwr.ts)
  IF NOT v_data_sufficient THEN
    v_state := 'neutral';

  ELSIF v_ratio IS NULL THEN
    -- chronic=0 com dados suficientes → risco máximo (sRPE nunca é 0 pela escala 1-10)
    v_state := 'alert';

  ELSIF v_ratio >= v_threshold_lo AND v_ratio <= v_threshold_hi THEN
    v_state := 'ready';

  ELSE
    -- Distância até ao limite mais próximo
    IF v_ratio > v_threshold_hi THEN
      v_distance := v_ratio - v_threshold_hi;
    ELSE
      v_distance := v_threshold_lo - v_ratio;
    END IF;

    -- Tolerância 1e-9 para IEEE 754 floating-point edge cases (ex: 0.8 - 0.6 = 0.20000000000000007).
    -- Sincronizado com acwr.ts:100 CAUTION_LIMIT = 0.2 + 1e-9.
    -- Precisão ACWR em medicina desportiva é 2-3 casas decimais; 1e-9 é clinicamente irrelevante
    -- mas necessário para boundaries exactos (ratio=0.6, ratio=1.7).
    IF v_distance <= 0.200000001 THEN
      v_state := 'caution';
    ELSE
      v_state := 'alert';
    END IF;
  END IF;

  -- 8. Retornar resultado
  RETURN QUERY SELECT
    v_acute,
    v_chronic,
    v_ratio,
    v_age_group,
    v_threshold_lo,
    v_threshold_hi,
    v_state,
    v_data_sufficient;
END;
$$;

-- Comentário descritivo
COMMENT ON FUNCTION public.compute_acwr(uuid, timestamptz) IS
  'Calcula ACWR (Acute:Chronic Workload Ratio) para um jogador numa data de referência. '
  'Espelha a lógica de lib/readiness/acwr.ts (TypeScript). '
  'Janelas: aguda=7d, crónica=28d/4. dataSufficient=>=4 semanas ISO com dados. '
  'Estados: neutral|ready|caution|alert. SECURITY DEFINER.';
