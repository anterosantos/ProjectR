-- Migration: 000173b_update_reminders_log_status
-- Purpose: Add status column to parental_consent_reminders_log for 3-state tracking (Story 3.4 - Decision D1)
--
-- States: 'pending' (log created, HTTP call in flight) → 'sent' (confirmed by Edge Function)
-- Allows idempotence: if HTTP call succeeds but function crashes, retry can detect and skip.

ALTER TABLE public.parental_consent_reminders_log
ADD COLUMN status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'sent'));

-- Update existing logs to 'sent' (they were successful, so mark as such)
UPDATE public.parental_consent_reminders_log
SET status = 'sent'
WHERE status IS NULL;

-- Existing idx_consent_reminders_log_dedup already provides lookups by (consent_id, kind)
-- No additional index needed for status filtering
