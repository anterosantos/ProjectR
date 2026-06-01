-- Migration: 000300_age_18_reconfirmation
-- Purpose: GDPR Art. 7 re-confirmation flow when a player turns 18.
--          Parental consent must be renewed by the adult data subject.
-- Dependencies: uuidv7(), audit_logs, players, profiles, clubs (Stories 1.3, 1.12, 2.1, 1.6)

-- =============================================================================
-- TABLE: consent_reconfirmations
-- =============================================================================

CREATE TABLE public.consent_reconfirmations (
  id            uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  club_id       uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id     uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  profile_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         text        NOT NULL UNIQUE,
  status        text        NOT NULL CHECK (status IN ('pending', 'confirmed', 'anonymized')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  anonymized_at timestamptz,
  CONSTRAINT confirmed_at_implies_confirmed
    CHECK (confirmed_at IS NULL OR status = 'confirmed'),
  CONSTRAINT anonymized_at_implies_anonymized
    CHECK (anonymized_at IS NULL OR status = 'anonymized'),
  CONSTRAINT not_both_confirmed_and_anonymized
    CHECK (NOT (confirmed_at IS NOT NULL AND anonymized_at IS NOT NULL))
);

-- Enforce at most one pending/confirmed row per player (idempotency guard)
CREATE UNIQUE INDEX idx_consent_reconfirmations_pending_per_player
  ON public.consent_reconfirmations(player_id)
  WHERE status = 'pending';

CREATE INDEX idx_consent_reconfirmations_token
  ON public.consent_reconfirmations(token);

CREATE INDEX idx_consent_reconfirmations_club
  ON public.consent_reconfirmations(club_id);

-- RLS
ALTER TABLE public.consent_reconfirmations ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) can read their own club's records
CREATE POLICY "consent_reconfirmations_staff_read"
  ON public.consent_reconfirmations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = consent_reconfirmations.club_id
    )
  );

-- All writes go through service-role (pg_cron + Server Actions)
GRANT SELECT, INSERT, UPDATE ON public.consent_reconfirmations TO service_role;

-- =============================================================================
-- HELPER: anonymize_player_pii
-- Anonymizes PII for any player (active or archived), preserving aggregates.
-- Unlike anonymize_archived_player(), this does NOT check is_archived.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.anonymize_player_pii(p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotency: skip if already fully anonymized (all three PII fields)
  IF EXISTS (
    SELECT 1 FROM public.players
    WHERE id = p_player_id
      AND full_name = '[anonimizado]'
      AND birthdate IS NULL
      AND photo_path IS NULL
  ) THEN
    RAISE NOTICE 'Player % already fully anonymized; skipping', p_player_id;
    RETURN false;
  END IF;

  -- Anonymize PII fields; preserve statistical data via player_id FK
  UPDATE public.players
     SET full_name  = '[anonimizado]',
         birthdate  = NULL,
         photo_path = NULL,
         updated_at = NOW()
   WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Player % not found; skipping anonymization', p_player_id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.anonymize_player_pii(uuid) IS
  'Anonymizes PII (full_name, birthdate, photo_path) for any player regardless of archive status. '
  'Preserves statistical aggregates (session_metrics, match_events, readiness_snapshots) via player_id FK. '
  'Idempotent — returns false if already anonymized or player not found.';

-- =============================================================================
-- FUNCTION: detect_age_18_transitions
-- Runs daily at 04:00 UTC via pg_cron.
-- Creates consent_reconfirmations rows for players who turn 18 today.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.detect_age_18_transitions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url  text;
  v_service_key   text;
  v_reconf_id     uuid;
  rec             RECORD;
BEGIN
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[detect_age_18_transitions] app.supabase_url / app.service_role_key not set — HTTP calls skipped (local/CI env)';
  END;

  FOR rec IN
    SELECT p.id AS player_id, p.profile_id, p.club_id
    FROM   public.players p
    WHERE  p.is_archived = false
      AND  p.profile_id IS NOT NULL
      AND  p.birthdate IS NOT NULL
      AND  p.birthdate + INTERVAL '18 years' = CURRENT_DATE
      AND  NOT EXISTS (
        SELECT 1 FROM public.consent_reconfirmations cr
        WHERE cr.player_id = p.id
          AND cr.status IN ('pending', 'confirmed')
      )
  LOOP
    INSERT INTO public.consent_reconfirmations
      (club_id, player_id, profile_id, token, status)
    VALUES (
      rec.club_id,
      rec.player_id,
      rec.profile_id,
      encode(gen_random_bytes(32), 'hex'),
      'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_reconf_id;

    -- Only call Edge Function if insert succeeded (no conflict)
    IF v_reconf_id IS NOT NULL
       AND v_supabase_url <> ''
       AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    THEN
      BEGIN
        -- Edge Function returns { ok, skipped?, reason? }
        -- We invoke it fire-and-forget; logging happens server-side
        PERFORM net.http_post(
          url     := v_supabase_url || '/functions/v1/send-age-18-reconfirmation',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body    := jsonb_build_object('reconfirmationId', v_reconf_id)
        );
        -- Note: net.http_post is fire-and-forget; failures are logged by the Edge Function
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[detect_age_18_transitions] pg_net call failed for reconfirmation %: %', v_reconf_id, SQLERRM;
      END;
    END IF;

    v_reconf_id := NULL;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'detect_age_18_transitions error: %', SQLERRM;
END;
$$;

-- =============================================================================
-- FUNCTION: enforce_age_18_anonymization
-- Runs daily at 04:30 UTC via pg_cron.
-- Anonymizes players who have not confirmed within 90 days.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_age_18_anonymization()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, player_id, club_id
    FROM   public.consent_reconfirmations
    WHERE  status = 'pending'
      AND  created_at <= NOW() - INTERVAL '90 days'
  LOOP
    -- Anonymize PII (preserves aggregates — different from Story 3.7 full erasure)
    PERFORM public.anonymize_player_pii(rec.player_id);

    UPDATE public.consent_reconfirmations
       SET status = 'anonymized', anonymized_at = NOW()
     WHERE id = rec.id;

    -- Audit log (fire-and-forget within PL/pgSQL)
    BEGIN
      INSERT INTO public.audit_logs
        (club_id, actor_id, action, target_kind, target_id)
      VALUES (
        rec.club_id,
        NULL,
        'consent.auto_anonymized_at_18',
        'player',
        rec.player_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[enforce_age_18_anonymization] audit_log insert failed for player %: %', rec.player_id, SQLERRM;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enforce_age_18_anonymization error: %', SQLERRM;
END;
$$;

-- =============================================================================
-- CRON JOBS
-- =============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available — skipping cron job registration (local/CI env)';
    RETURN;
  END IF;

  -- detect_age_18_transitions: daily at 04:00 UTC
  PERFORM cron.schedule(
    'detect_age_18_transitions',
    '0 4 * * *',
    $$SELECT public.detect_age_18_transitions()$$
  );

  -- enforce_age_18_anonymization: daily at 04:30 UTC
  PERFORM cron.schedule(
    'enforce_age_18_anonymization',
    '30 4 * * *',
    $$SELECT public.enforce_age_18_anonymization()$$
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- jobs already registered, safe to ignore
END;
$do$;
