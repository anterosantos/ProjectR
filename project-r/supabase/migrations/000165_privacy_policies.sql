-- Migration: 000165_privacy_policies
-- Purpose: Versioned privacy policy storage (Story 3.1, FR54)

CREATE TABLE public.privacy_policies (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v7(),
  version       text        NOT NULL,
  effective_from date       NOT NULL DEFAULT CURRENT_DATE,
  body_full_md  text        NOT NULL,
  body_u14_md   text        NOT NULL,
  is_current    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Garante uma única linha is_current=true globalmente (FR54)
CREATE UNIQUE INDEX idx_privacy_policies_one_current
  ON public.privacy_policies(is_current)
  WHERE is_current = true;

-- RLS: leitura pública (página /politica-privacidade é acessível sem autenticação)
ALTER TABLE public.privacy_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_policies_public_read"
  ON public.privacy_policies
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Trigger: garante transição atómica de is_current (AC #3)
CREATE OR REPLACE FUNCTION public.ensure_single_current_policy()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.privacy_policies
      SET is_current = false
    WHERE is_current = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE TRIGGER ensure_single_current_policy_trigger
  BEFORE INSERT OR UPDATE ON public.privacy_policies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_current_policy();
