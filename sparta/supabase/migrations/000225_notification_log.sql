-- Migration: 000225_notification_log
-- Purpose: Tabela de log de notificações push + trigger de cancelamento + pg_cron jobs
-- Stories: 4.8 — Pre/Post Session Push Notifications with Configurable X/Y
-- AC: #2 (notification_log table + cancellation trigger), #3, #4 (pg_cron jobs)
--
-- Esta tabela é uma fila de notificações agendadas (scheduled/sent/failed/cancelled/skipped).
-- A Edge Function schedule-session-pushes (hourly) insere rows com status='scheduled'.
-- A Edge Function send-push (a cada 5 min) processa rows com status='scheduled' e envia.

-- =============================================================================
-- TABELA: notification_log
-- =============================================================================

CREATE TABLE notification_log (
  id             uuid        NOT NULL DEFAULT public.uuidv7(),
  club_id        uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id     uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind           text        NOT NULL CHECK (kind IN ('fatigue_pre', 'fatigue_post')),
  scheduled_for  timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled', 'skipped')),
  sent_at        timestamptz,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_log_pkey PRIMARY KEY (id),
  CONSTRAINT notification_log_unique_session_kind UNIQUE (profile_id, session_id, kind)
);

-- =============================================================================
-- Índices de performance
-- =============================================================================

-- Índice crítico para a fila de processamento: Edge Function send-push filtra
-- por (status='scheduled' AND scheduled_for <= now() LIMIT 50 ORDER BY scheduled_for ASC)
CREATE INDEX idx_notification_log_processing
  ON notification_log(status, scheduled_for)
  WHERE status = 'scheduled';

-- Suporte a propagação de cancelamento: quando session é cancelada,
-- trigger precisa atualizar rápido todos os rows daquela sessão
CREATE INDEX idx_notification_log_session
  ON notification_log(session_id, status);

-- Suporte a lookups por profile (auditoria, resets locais)
CREATE INDEX idx_notification_log_profile
  ON notification_log(profile_id, created_at DESC);

-- =============================================================================
-- Comentários de documentação
-- =============================================================================

COMMENT ON TABLE notification_log IS
  'Fila de notificações push agendadas e entregues. Cada sessão gera até 2 rows (pre + post). Rows preservam auditoria completa: scheduled → sent/failed/cancelled/skipped. Nunca apagados (audit trail).';

COMMENT ON COLUMN notification_log.kind IS
  'fatigue_pre = notificação X minutos antes da sessão; fatigue_post = Y minutos após.';

COMMENT ON COLUMN notification_log.scheduled_for IS
  'Data/hora da notificação agendada (UTC). Comparada com NOW() para decidir se é hora de enviar.';

COMMENT ON COLUMN notification_log.status IS
  'scheduled = pronta para enviar; sent = enviada com sucesso; failed = erro ao enviar (retentável ou 410 Gone); cancelled = sessão foi cancelada; skipped = sem subscrição activa.';

COMMENT ON COLUMN notification_log.sent_at IS
  'Timestamp real de envio com sucesso. NULL se status != sent.';

COMMENT ON COLUMN notification_log.error_message IS
  'Mensagem de erro se status=failed (ex: "410 Gone", "timeout", "5xx"). NULL se status != failed.';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) pode ler o log de notificações do seu clube (auditoria)
CREATE POLICY "notification_log_staff_read" ON notification_log
  FOR SELECT
  TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('coach', 'analyst')
  );

-- Edge Function send-push usa service_role e bypassa RLS (via SECURITY DEFINER)
-- Sem policy necessária para service_role — RLS não aplica a authenticated roles com bypassRLS()

-- =============================================================================
-- FUNÇÃO TRIGGER: cancelar notificações quando sessão é cancelada
-- =============================================================================
-- AC #6: Trigger fires AFTER UPDATE on sessions when NEW.status = 'cancelled' AND OLD.status = 'scheduled'
-- Atualiza todos os rows de notification_log com status = 'cancelled' para aquela sessão.

CREATE OR REPLACE FUNCTION public.fn_cancel_notifications_on_session_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'scheduled' THEN
    UPDATE public.notification_log
    SET status = 'cancelled'
    WHERE session_id = NEW.id
      AND status = 'scheduled';

    -- Log estruturado (opcional, para auditoria)
    RAISE NOTICE '[fn_cancel_notifications_on_session_cancel] session_id=%, cancelled % notifications',
      NEW.id,
      (SELECT COUNT(*) FROM public.notification_log WHERE session_id = NEW.id AND status = 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: fire AFTER UPDATE on sessions
CREATE TRIGGER tg_cancel_notifications_on_session_cancel
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cancel_notifications_on_session_cancel();

-- =============================================================================
-- FUNÇÃO TRIGGER: auto-update updated_at em notification_settings
-- =============================================================================
-- Util para rastrear quando o staff fez a última alteração às definições.
-- (Opcional, mas bom para auditoria.)

-- CREATE OR REPLACE FUNCTION public.fn_update_notification_settings_timestamp()
-- RETURNS TRIGGER LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER tg_notification_settings_update_timestamp
--   BEFORE UPDATE ON public.notification_settings
--   FOR EACH ROW
--   EXECUTE FUNCTION public.fn_update_notification_settings_timestamp();

-- =============================================================================
-- pg_cron JOBS: schedule-session-pushes (hourly) e send-push (every 5 min)
-- =============================================================================
-- Padrão baseado em 000172_pg_cron_consent_reminders.sql
--
-- Graceful degradation: se pg_cron ou pg_net não estiverem disponíveis (local/CI),
-- um RAISE NOTICE avisa, mas a migration não falha.

-- =========================================================================
-- Job 1: schedule-session-pushes (a cada hora, HH:00)
-- =========================================================================
-- FUNÇÃO PL/pgSQL que invoca a Edge Function via pg_net

CREATE OR REPLACE FUNCTION public.schedule_session_pushes_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key  text;
BEGIN
  -- Ler configurações runtime (app settings definidas em Supabase Vault ou locals)
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[schedule_session_pushes_job] app.supabase_url / app.service_role_key não configurados — HTTP calls ignorados';
  END;

  IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/schedule-session-pushes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := '{}'::jsonb
    );
    RAISE NOTICE '[schedule_session_pushes_job] invoked successfully';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '[schedule_session_pushes_job] pg_net extension not available — skipped (local/CI environment)';
  END IF;
END;
$$;

-- Agendar job: a cada hora (0 * * * * = :00 de cada hora)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available — schedule_session_pushes_job NOT scheduled (local/CI environment)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'schedule_session_pushes_hourly',
    '0 * * * *',
    $$SELECT public.schedule_session_pushes_job()$$
  );
  RAISE NOTICE 'Job schedule_session_pushes_hourly scheduled: 0 * * * * (every hour at :00)';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Job schedule_session_pushes_hourly already scheduled (skipping duplicate)';
END;
$$;

-- =========================================================================
-- Job 2: send-push (a cada 5 minutos)
-- =========================================================================
-- FUNÇÃO PL/pgSQL que invoca a Edge Function send-push via pg_net

CREATE OR REPLACE FUNCTION public.send_push_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key  text;
BEGIN
  -- Ler configurações runtime
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[send_push_job] app.supabase_url / app.service_role_key não configurados — HTTP calls ignorados';
  END;

  IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := '{}'::jsonb
    );
    RAISE NOTICE '[send_push_job] invoked successfully';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '[send_push_job] pg_net extension not available — skipped (local/CI environment)';
  END IF;
END;
$$;

-- Agendar job: a cada 5 minutos (*/5 * * * *)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available — send_push_job NOT scheduled (local/CI environment)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'send_push_every_5_minutes',
    '*/5 * * * *',
    $$SELECT public.send_push_job()$$
  );
  RAISE NOTICE 'Job send_push_every_5_minutes scheduled: */5 * * * * (every 5 minutes)';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Job send_push_every_5_minutes already scheduled (skipping duplicate)';
END;
$$;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON notification_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_log TO service_role;
