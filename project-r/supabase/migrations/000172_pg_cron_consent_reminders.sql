-- Migration: 000172_pg_cron_consent_reminders
-- Purpose: Tabela de log de lembretes + função PL/pgSQL + job pg_cron diário 08:00 UTC (Story 3.4)
--
-- IMPORTANT: pg_cron e pg_net devem estar activados no dashboard Supabase antes de aplicar.
-- Dashboard: Project Settings → Database → Extensions → pg_cron / pg_net
-- Não usar CREATE EXTENSION aqui — já provisionados pelo Supabase.
--
-- O job corre como papel `postgres`, bypassando RLS.
-- A função é idempotente — verificações na parental_consent_reminders_log evitam duplicados.

-- =============================================================================
-- TABELA: parental_consent_reminders_log (AC #6)
-- =============================================================================

CREATE TABLE public.parental_consent_reminders_log (
  id          uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  consent_id  uuid        NOT NULL REFERENCES public.parental_consents(id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('day_7', 'day_14', 'staff_alert', 'manual_resend')),
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- Previne lembretes duplos no mesmo dia para o mesmo consent+kind (AC #6)
CREATE UNIQUE INDEX idx_consent_reminders_log_dedup
  ON public.parental_consent_reminders_log(consent_id, kind, DATE(sent_at));

-- Suporte a lookups por consent_id
CREATE INDEX idx_consent_reminders_log_consent_id
  ON public.parental_consent_reminders_log(consent_id);

ALTER TABLE public.parental_consent_reminders_log ENABLE ROW LEVEL SECURITY;

-- Patch 9: Allow postgres role (used by pg_cron) to INSERT
CREATE POLICY "reminders_log_postgres_insert"
  ON public.parental_consent_reminders_log
  FOR INSERT
  WITH CHECK (true); -- Runs as postgres via SECURITY DEFINER

-- Staff can SELECT for audit purposes (AC #6)
CREATE POLICY "reminders_log_staff_read"
  ON public.parental_consent_reminders_log
  FOR SELECT
  TO authenticated
  USING (
    consent_id IN (
      SELECT id FROM public.parental_consents
      WHERE club_id = (auth.jwt() ->> 'club_id')::uuid
    )
  );

-- =============================================================================
-- FUNÇÃO: parental_consent_reminders() (AC #1, #2, #3, #4)
-- =============================================================================
-- Chamada pelo pg_cron às 08:00 UTC diariamente.
-- Usa pg_net para invocar Edge Functions de forma assíncrona.
-- Trata erros com RAISE WARNING para não bloquear o job.

CREATE OR REPLACE FUNCTION public.parental_consent_reminders()
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
  -- Ler configurações runtime (definidas via Supabase Vault ou app.settings)
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    -- Em ambientes locais/CI sem configurações, usar placeholders e continuar com logs
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[parental_consent_reminders] app.supabase_url / app.service_role_key não configurados — HTTP calls ignorados';
  END;

  v_functions_url := v_supabase_url || '/functions/v1';

  -- -----------------------------------------------------------------------
  -- DIA 7: consentimentos pendentes criados exactamente há 7 dias (AC #2)
  -- -----------------------------------------------------------------------
  -- Patch 5: Normalize timezone to UTC before date comparison
  FOR r IN
    SELECT pc.id AS consent_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND (pc.created_at AT TIME ZONE 'UTC')::date = (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '7 days'
      -- idempotência: não enviar se já enviado hoje
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        WHERE l.consent_id = pc.id
          AND l.kind = 'day_7'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    -- Patch 14+15: Insert log with status 'pending' first (3-state system)
    -- Edge Function will mark as 'sent' after successful email send
    BEGIN
      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (r.consent_id, 'day_7', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE; -- já enviado hoje, ignorar
    END;

    -- Invocar Edge Function via pg_net (assíncrono)
    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        -- Patch 6: Add idempotency key for retry safety
        PERFORM net.http_post(
          url     := v_functions_url || '/send-parental-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'day_7_' || r.consent_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object(
            'consentId',    r.consent_id,
            'includePrefix', true,
            'prefixText',   '[Lembrete]'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net day_7 falhou para consent %: %', r.consent_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- -----------------------------------------------------------------------
  -- DIA 14: consentimentos pendentes criados exactamente há 14 dias (AC #3)
  -- -----------------------------------------------------------------------
  -- Patch 5: Normalize timezone to UTC before date comparison
  FOR r IN
    SELECT pc.id AS consent_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND (pc.created_at AT TIME ZONE 'UTC')::date = (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        WHERE l.consent_id = pc.id
          AND l.kind = 'day_14'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    -- Patch 14+15: Insert log with status 'pending' (3-state system)
    BEGIN
      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (r.consent_id, 'day_14', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        -- Patch 6: Add idempotency key for retry safety
        PERFORM net.http_post(
          url     := v_functions_url || '/send-parental-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'day_14_' || r.consent_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object(
            'consentId',    r.consent_id,
            'includePrefix', true,
            'prefixText',   '[2º Lembrete]'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net day_14 falhou para consent %: %', r.consent_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- -----------------------------------------------------------------------
  -- ALERTA STAFF: consentimentos pendentes com mais de 14 dias (AC #4)
  -- Agrupa por clube e envia um único alerta por clube por dia.
  -- -----------------------------------------------------------------------
  -- Patch 5: Normalize timezone to UTC
  FOR r IN
    SELECT DISTINCT pc.club_id
    FROM public.parental_consents pc
    WHERE pc.status = 'pending'
      AND (pc.created_at AT TIME ZONE 'UTC') < (CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '14 days'
      -- alerta apenas se não foi enviado hoje para este clube
      AND NOT EXISTS (
        SELECT 1 FROM public.parental_consent_reminders_log l
        JOIN public.parental_consents pc2 ON pc2.id = l.consent_id
        WHERE pc2.club_id = pc.club_id
          AND l.kind = 'staff_alert'
          AND l.sent_at::date = CURRENT_DATE
      )
  LOOP
    -- Inserir log para o primeiro consent_id do clube (representativo)
    DECLARE v_first_consent uuid;
    BEGIN
      SELECT id INTO v_first_consent
      FROM public.parental_consents
      WHERE club_id = r.club_id
        AND status = 'pending'
        AND created_at < CURRENT_DATE - INTERVAL '14 days'
      LIMIT 1;

      -- Patch 14+15: Insert log with status 'pending' (3-state system)
      INSERT INTO public.parental_consent_reminders_log(consent_id, kind, status)
      VALUES (v_first_consent, 'staff_alert', 'pending');
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        -- Patch 6: Add idempotency key for retry safety
        PERFORM net.http_post(
          url     := v_functions_url || '/staff-alert-consent',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'X-Idempotency-Key', 'staff_alert_' || r.club_id::text || '_' || CURRENT_DATE::text
          ),
          body    := jsonb_build_object('clubId', r.club_id)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[parental_consent_reminders] pg_net staff_alert falhou para clube %: %', r.club_id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- CRON JOB: parental_consent_reminders às 08:00 UTC (AC #1)
-- =============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — a ignorar registo do job (local/CI)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'parental_consent_reminders',
    '0 8 * * *',
    $$SELECT public.parental_consent_reminders()$$
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- job já registado, ignorar
END;
$do$;
