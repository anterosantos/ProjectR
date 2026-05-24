-- Migration: 000230_push_processing_lock
-- Purpose: Suporte a processamento atómico de notificações push (sem duplo envio)
-- Stories: 4.8 — D1 fix: race condition em send-push Edge Function
--
-- Adiciona status 'processing' para permitir SELECT ... FOR UPDATE SKIP LOCKED.
-- O RPC claim_push_notifications() atomicamente reclama até N rows para processamento,
-- evitando que duas invocações sobrepostas do cron de 5min enviem a mesma notificação.

-- =============================================================================
-- 1. Adicionar 'processing' ao CHECK constraint de notification_log.status
-- =============================================================================
-- Necessário antes de criar o RPC que usa este status como estado intermédio.

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
    CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled', 'skipped'));

COMMENT ON CONSTRAINT notification_log_status_check ON public.notification_log IS
  'processing = reclamado por send-push para envio; estado intermédio que previne duplo envio em execuções sobrepostas.';

-- =============================================================================
-- 2. RPC: claim_push_notifications — SELECT + UPDATE atómico com SKIP LOCKED
-- =============================================================================
-- Reclama até batch_size rows em status='scheduled' com scheduled_for <= now(),
-- transitando-as para 'processing'. Invocações sobrepostas saltam rows bloqueadas
-- (SKIP LOCKED), eliminando o risco de duplo envio.
--
-- Chamado por: supabase/functions/send-push/index.ts
-- SECURITY DEFINER: corre com permissões do owner (service_role) para poder
--                   executar UPDATE em notification_log via RLS bypass.

CREATE OR REPLACE FUNCTION public.claim_push_notifications(batch_size int DEFAULT 50)
RETURNS SETOF public.notification_log
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notification_log
  SET status = 'processing'
  WHERE id IN (
    SELECT id
    FROM public.notification_log
    WHERE status = 'scheduled'
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.claim_push_notifications(int) TO service_role;

-- =============================================================================
-- 3. Cleanup: repor 'processing' → 'failed' para rows bloqueadas há > 10 minutos
-- =============================================================================
-- Salvaguarda: se send-push crashar a meio, rows ficam em 'processing'.
-- Esta função é chamada no início de cada run de send-push para limpar o estado.

CREATE OR REPLACE FUNCTION public.reset_stale_processing_notifications(stale_minutes int DEFAULT 10)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reset AS (
    UPDATE public.notification_log
    SET
      status        = 'failed',
      error_message = 'Processing timeout — reset by cleanup'
    WHERE status = 'processing'
      AND created_at < now() - (stale_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT COUNT(*)::int FROM reset;
$$;

GRANT EXECUTE ON FUNCTION public.reset_stale_processing_notifications(int) TO service_role;
