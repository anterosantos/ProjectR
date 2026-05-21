-- Migration: 000142_pg_cron_anonymize_job
-- Purpose: Register monthly cron job to anonymize players archived 5+ seasons ago (FR16, AR23)
--
-- IMPORTANT: pg_cron must be enabled via the Supabase dashboard BEFORE applying this migration.
-- Dashboard: Project Settings → Database → Extensions → pg_cron
-- Do NOT enable pg_cron via CREATE EXTENSION here — it is already provisioned by Supabase.
--
-- pg_cron jobs run as the `postgres` role, bypassing RLS.
-- The anonymize function is idempotent — re-running produces the same result.
-- To verify: SELECT jobid, schedule, command FROM cron.job WHERE jobname LIKE 'anonymize%';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available — skipping cron job registration (local/CI env)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'anonymize_archived_players_monthly',
    '0 1 1 * *',
    $$
    SELECT public.anonymize_archived_player(id)
      FROM players
     WHERE is_archived = true
       AND archived_at IS NOT NULL
       AND full_name != '[anonimizado]'
    $$
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Job already registered (e.g., migration re-applied). Skip silently.
    NULL;
END;
$do$;
