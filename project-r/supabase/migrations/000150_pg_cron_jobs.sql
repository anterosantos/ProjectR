-- Migration: 000150_pg_cron_jobs
-- Purpose: Register scheduled cleanup jobs (NFR20)
-- Scope: Database-level scheduled jobs; jobs run as postgres role
--
-- IMPORTANT: pg_cron must be enabled via the Supabase dashboard BEFORE applying this migration.
-- Dashboard: Project Settings → Database → Extensions → pg_cron
-- Do NOT enable pg_cron via CREATE EXTENSION here — it is already provisioned by Supabase.

-- =============================================================================
-- CRON JOB: Purge old audit_logs (NFR20 — 12-month retention)
-- =============================================================================
-- Schedule: Monthly on the 1st at 02:00 UTC
-- Job: DELETE audit_logs entries older than 12 months
-- Idempotence: Wrapped in DO block — re-running this migration skips silently if job exists

DO $$
BEGIN
  PERFORM cron.schedule(
    'purge_audit_logs_older_than_12_months',
    '0 2 1 * *',
    $$DELETE FROM audit_logs WHERE occurred_at < NOW() - INTERVAL '12 months'$$
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Job already registered (e.g., migration re-applied). Skip silently.
    NULL;
END;
$$;

-- =============================================================================
-- FUTURE: CRON JOBS (Deferred)
-- =============================================================================
-- These jobs are not yet implemented but noted for future stories:
--
-- Purge telemetry_events after 90 days (configurable retention per product KPI)
-- DO $$ BEGIN
--   PERFORM cron.schedule(
--     'purge_telemetry_events_older_than_90_days',
--     '0 3 * * *',  -- Daily at 03:00 UTC
--     $$DELETE FROM telemetry_events WHERE occurred_at < NOW() - INTERVAL '90 days'$$
--   );
-- EXCEPTION WHEN unique_violation THEN NULL;
-- END; $$;
--
-- Cleanup orphaned outbox rows after successful drain (Story 1.11, deferred)
-- DO $$ BEGIN
--   PERFORM cron.schedule(
--     'cleanup_orphaned_outbox_rows',
--     '0 4 * * *',  -- Daily at 04:00 UTC
--     $$DELETE FROM outbox WHERE synced_at IS NOT NULL AND occurred_at < NOW() - INTERVAL '30 days'$$
--   );
-- EXCEPTION WHEN unique_violation THEN NULL;
-- END; $$;

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

-- pg_cron jobs run as the `postgres` role, bypassing RLS.
-- The purge_audit_logs job is idempotent: re-running produces the same result (WHERE clause deduplication).
-- To verify job registration: SELECT jobid, schedule, command FROM cron.job WHERE jobname LIKE 'purge_audit%';
