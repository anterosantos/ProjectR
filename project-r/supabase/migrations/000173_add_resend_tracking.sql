-- Migration: 000173_add_resend_tracking
-- Purpose: Adicionar coluna last_manual_resend_at para rate-limit de reenvio manual (Story 3.4, AC #7)
-- Fallback MVP sem Redis: validação simples baseada em timestamp na tabela.

ALTER TABLE public.parental_consents
  ADD COLUMN last_manual_resend_at timestamptz DEFAULT NULL;
