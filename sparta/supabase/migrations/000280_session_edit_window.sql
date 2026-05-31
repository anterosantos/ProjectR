-- Migration: 000280_session_edit_window
-- Story 6.6: Add event_edit_window_hours to notification_settings
-- Configurable window (1–168 hours) after session end during which events can be edited/deleted.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS event_edit_window_hours int NOT NULL DEFAULT 24
    CHECK (event_edit_window_hours BETWEEN 1 AND 168);

COMMENT ON COLUMN notification_settings.event_edit_window_hours IS
  'Hours after session end during which match events can be edited or deleted (FR29). Range: 1–168. Default: 24.';
