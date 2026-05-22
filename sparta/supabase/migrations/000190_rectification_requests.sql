-- Migration: 000190_rectification_requests
-- Purpose: Tabela rectification_requests + RLS + índices + pg_cron SLA day-7 (Story 3.8)
--
-- IMPORTANT: pg_cron e pg_net devem estar activados no dashboard Supabase antes de aplicar.
-- Dashboard: Project Settings → Database → Extensions → pg_cron / pg_net
-- Não usar CREATE EXTENSION aqui — já provisionados pelo Supabase.

-- =============================================================================
-- TABELA: rectification_requests (AC #1, #2, #3, #4, #6)
-- =============================================================================

CREATE TABLE public.rectification_requests (
  id               uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  club_id          uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id        uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'applied', 'rejected')),
  field_name       text        NOT NULL,       -- 'full_name' | 'birthdate' | 'jersey_num'
  requested_value  text        NOT NULL,       -- valor novo pedido
  current_value    text,                       -- valor actual no momento do pedido
  reason           text,                       -- motivo em texto livre
  applied_at       timestamptz,
  applied_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at      timestamptz,
  rejected_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reject_reason    text,
  notified_at      timestamptz,               -- quando o email foi enviado ao titular
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- ÍNDICES (AC #2, #6)
-- =============================================================================

CREATE INDEX idx_rectification_club_status
  ON public.rectification_requests(club_id, status);

CREATE INDEX idx_rectification_player
  ON public.rectification_requests(player_id);

CREATE INDEX idx_rectification_created_at
  ON public.rectification_requests(created_at);

-- =============================================================================
-- RLS (AC #2, #3, #4)
-- =============================================================================

ALTER TABLE public.rectification_requests ENABLE ROW LEVEL SECURITY;

-- Staff (coach/analyst) do mesmo clube lê todos os pedidos
CREATE POLICY "staff_read_club"
  ON public.rectification_requests
  FOR SELECT
  TO authenticated
  USING (
    club_id = (auth.jwt() ->> 'club_id')::uuid
    AND (auth.jwt() ->> 'user_role') IN ('coach', 'analyst')
  );

-- Player lê os seus próprios pedidos
CREATE POLICY "player_read_own"
  ON public.rectification_requests
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM public.players
      WHERE profile_id = auth.uid()
    )
  );

-- service_role acesso total (para Server Actions)
CREATE POLICY "service_role_all"
  ON public.rectification_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- GRANTs
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON public.rectification_requests TO authenticated;
GRANT ALL ON public.rectification_requests TO service_role;

-- =============================================================================
-- FUNÇÃO pg_cron: rectification_sla_check() — SLA day-7 email (AC #6)
-- =============================================================================
-- Corre diariamente às 09:00 UTC.
-- Identifica clubes com pedidos status='pending' há ≥7 dias.
-- Invoca Edge Function send-rectification-sla via pg_net (assíncrono).

CREATE OR REPLACE FUNCTION public.rectification_sla_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url  text;
  v_service_key   text;
  v_functions_url text;
  r               RECORD;
BEGIN
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[rectification_sla_check] app.supabase_url / app.service_role_key não configurados — HTTP calls ignorados';
  END;

  v_functions_url := v_supabase_url || '/functions/v1';

  -- Para cada clube com pedidos pendentes há ≥7 dias, enviar alerta
  FOR r IN
    SELECT DISTINCT club_id
    FROM public.rectification_requests
    WHERE status = 'pending'
      AND created_at <= now() - interval '7 days'
  LOOP
    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_functions_url || '/send-rectification-sla',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'rectification_sla_' || r.club_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object('clubId', r.club_id)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[rectification_sla_check] pg_net falhou para clube %: %', r.club_id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- CRON JOB: rectification_sla_alert às 09:00 UTC (AC #6)
-- =============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — a ignorar registo do job (local/CI)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'rectification_sla_alert',
    '0 9 * * *',
    $$SELECT public.rectification_sla_check()$$
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- job já registado, ignorar
END;
$do$;
