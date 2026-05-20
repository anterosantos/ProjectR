-- Migration: 000170_parental_consents
-- Purpose: Parental consent tokenized schema + profiles.consent_status (Story 3.2, AR13, FR4, FR6)

-- citext extension para emails case-insensitive
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.parental_consents (
  id                uuid        PRIMARY KEY DEFAULT public.uuidv7(),
  club_id           uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id         uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_email      citext      NOT NULL,
  token             text        NOT NULL UNIQUE,
  token_expires_at  timestamptz NOT NULL,
  status            text        NOT NULL
    CHECK (status IN ('pending','confirmed','withdrawn','expired')),
  confirmed_at      timestamptz,
  confirmed_ip      inet,
  policy_version_id uuid        NOT NULL REFERENCES public.privacy_policies(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Uma linha activa (pending ou confirmed) por jogador (FR6)
CREATE UNIQUE INDEX idx_parental_consents_active_per_player
  ON public.parental_consents(player_id)
  WHERE status IN ('pending','confirmed');

-- Suporte a lookups por token (Edge Function em Story 3.3)
CREATE INDEX idx_parental_consents_token
  ON public.parental_consents(token);

ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- Staff do clube pode ler registos do seu clube (AR13: token visível só via service-role em Edge Functions)
CREATE POLICY "parental_consents_staff_read"
  ON public.parental_consents
  FOR SELECT
  TO authenticated
  USING (club_id = (auth.jwt() ->> 'club_id')::uuid);

-- Sem políticas INSERT/UPDATE para authenticated — escrita exclusivamente via service-role

-- profiles.consent_status — campo de gating rápido para o middleware (AC #2)
ALTER TABLE public.profiles
  ADD COLUMN consent_status text NOT NULL DEFAULT 'not_required'
  CHECK (consent_status IN ('not_required','pending','granted','revoked'));
