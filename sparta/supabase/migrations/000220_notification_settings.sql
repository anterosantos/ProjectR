-- Migration: 000220_notification_settings
-- Purpose: Tabela de definições de notificações push por clube
-- Stories: 4.8 — Pre/Post Session Push Notifications with Configurable X/Y
-- AC: #1 (notification_settings table + RLS)
--
-- Esta tabela permite que o staff configure:
-- - pre_minutes: minutos antes da sessão para enviar notificação
-- - post_minutes: minutos após a sessão para enviar notificação
-- - is_enabled: ligar/desligar notificações globalmente para o clube

-- =============================================================================
-- TABELA: notification_settings
-- =============================================================================

CREATE TABLE notification_settings (
  id          uuid        NOT NULL DEFAULT public.uuidv7(),
  club_id     uuid        NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  pre_minutes int         NOT NULL DEFAULT 30 CHECK (pre_minutes BETWEEN 5 AND 120),
  post_minutes int        NOT NULL DEFAULT 30 CHECK (post_minutes BETWEEN 5 AND 120),
  is_enabled  boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_settings_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- Índices de performance
-- =============================================================================

-- Lookup rápido por club_id (muito frequente em schedule-session-pushes Edge Function)
CREATE INDEX idx_notification_settings_club_id
  ON notification_settings(club_id);

-- =============================================================================
-- Comentários de documentação
-- =============================================================================

COMMENT ON TABLE notification_settings IS
  'Definições globais de notificações push por clube. Um row por clube; criado automaticamente via trigger ao criar clube ou manualmente pelo staff.';

COMMENT ON COLUMN notification_settings.club_id IS
  'FK única para clubs.id — um clube tem exactamente uma linha de definições.';

COMMENT ON COLUMN notification_settings.pre_minutes IS
  'Minutos antes da sessão agendada para enviar notificação pré-sessão (5–120, default 30).';

COMMENT ON COLUMN notification_settings.post_minutes IS
  'Minutos após o fim da sessão para enviar notificação pós-sessão (5–120, default 30).';

COMMENT ON COLUMN notification_settings.is_enabled IS
  'true = notificações activas; false = sem notificações enviadas (desligado pelo staff ou compliance).';

COMMENT ON COLUMN notification_settings.updated_at IS
  'Timestamp da última alteração. AUTO-UPDATED via trigger (se configurado) ou manualmente.';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) do mesmo clube pode ler definições
CREATE POLICY "notification_settings_staff_read" ON notification_settings
  FOR SELECT
  TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('coach', 'analyst')
  );

-- Staff (coach/analyst) do mesmo clube pode actualizar definições
CREATE POLICY "notification_settings_staff_update" ON notification_settings
  FOR UPDATE
  TO authenticated
  USING (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('coach', 'analyst')
  )
  WITH CHECK (
    club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('coach', 'analyst')
  );

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, UPDATE ON notification_settings TO authenticated;

-- Service role (Edge Functions) precisa de INSERT para upserts via migration init
GRANT SELECT, INSERT, UPDATE ON notification_settings TO service_role;

-- =============================================================================
-- FUNÇÃO TRIGGER: auto-insert default row ao criar clube
-- =============================================================================
-- Esta função não é utilizada nesta versão (inicialização manual ou lazy-init),
-- mas deixada aqui para futuro: quando novo clube é criado, automaticamente
-- cria uma linha notification_settings com defaults.
--
-- CREATE OR REPLACE FUNCTION public.fn_auto_notification_settings()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $$
-- BEGIN
--   INSERT INTO public.notification_settings (club_id)
--   VALUES (NEW.id)
--   ON CONFLICT (club_id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER tg_auto_notification_settings
--   AFTER INSERT ON public.clubs
--   FOR EACH ROW
--   EXECUTE FUNCTION public.fn_auto_notification_settings();
