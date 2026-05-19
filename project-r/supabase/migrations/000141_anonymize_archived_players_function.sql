-- Migration: 000141_anonymize_archived_players_function
-- Purpose: PL/pgSQL function to anonymize player PII after 5 seasons (FR16, GDPR Art. 5(1)(e))
-- Security: SECURITY DEFINER runs as postgres role, bypassing RLS

CREATE OR REPLACE FUNCTION public.anonymize_archived_player(p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_club_id uuid;
  v_archived_at timestamptz;
  v_age_group text;
  v_seasons_count int;
BEGIN
  -- Fetch player state
  SELECT club_id, archived_at, age_group
    INTO v_club_id, v_archived_at, v_age_group
    FROM players
   WHERE id = p_player_id
     AND is_archived = true;

  IF NOT FOUND THEN
    RAISE NOTICE 'Player % is not archived or does not exist; skipping anonymization', p_player_id;
    RETURN false;
  END IF;

  IF v_archived_at IS NULL THEN
    RAISE NOTICE 'Player % has no archived_at timestamp; skipping', p_player_id;
    RETURN false;
  END IF;

  -- Idempotence guard: already anonymized
  IF EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND full_name = '[anonimizado]'
  ) THEN
    RAISE NOTICE 'Player % already anonymized; skipping', p_player_id;
    RETURN false;
  END IF;

  -- 5 seasons ≈ 5 × 275 days = 1375 days
  v_seasons_count := FLOOR(EXTRACT(DAY FROM (NOW() - v_archived_at)) / 275);

  IF v_seasons_count < 5 THEN
    RAISE NOTICE 'Player % archived < 5 seasons ago (% seasons); skipping', p_player_id, v_seasons_count;
    RETURN false;
  END IF;

  -- Anonymize PII fields; preserve statistical data via player_id FK
  UPDATE players
     SET full_name  = '[anonimizado]',
         birthdate  = NULL,
         photo_path = NULL,
         updated_at = NOW()
   WHERE id = p_player_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.anonymize_archived_player(uuid) IS
  'Anonymizes PII for a player archived 5+ seasons ago. Idempotent — returns false if not yet due or already anonymized. Runs as postgres role (bypasses RLS). Statistical data (match_events, fatigue_responses, session_metrics) retained via player_id FK (NFR16).';
