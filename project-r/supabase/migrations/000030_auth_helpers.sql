-- Migration: 000030_auth_helpers
-- Purpose: Create club_id() and user_role() helpers for RLS policies (AR11, AR12)
-- Spec: epics.md Story 1.3 AC #3 + architecture.md L309-331
--
-- Naming note (deviation from spec, documented):
--   Spec mandates `auth.club_id()` and `auth.user_role()` in the `auth` schema. However, the
--   `auth` schema is owned by `supabase_admin` (Supabase-managed) and migrations run as the
--   `postgres` role, which lacks CREATE privilege on `auth`. We place the helpers in `public`
--   without the `get_` prefix — minimum-possible divergence from spec (schema-only).
--   Update planned for epics.md AC #3 + Story 1.4 AC to reflect `public.club_id()` /
--   `public.user_role()` calling convention.

-- =============================================================================
-- public.club_id() — extract `club_id` JWT custom claim (AR11)
-- =============================================================================
-- Returns: uuid of the user's current club (NULL if claim absent or malformed text)
-- Used in: RLS policies for multi-tenant isolation
-- Hardened: SET search_path locks symbol resolution (CVE-2018-1058 mitigation)
-- Narrow EXCEPTION: only catches uuid cast failures, not generic programming errors

CREATE OR REPLACE FUNCTION public.club_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_claim text;
BEGIN
  current_claim := auth.jwt() ->> 'club_id';
  IF current_claim IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN current_claim::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    -- Only swallow uuid cast errors. Programming errors propagate normally.
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_id TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.club_id IS
  'Extract club_id from JWT custom claim. Used in RLS policies for multi-tenant isolation. Returns NULL if claim absent or not a valid uuid.';

-- =============================================================================
-- public.user_role() — extract `role` JWT custom claim (AR12)
-- =============================================================================
-- Returns: text role of the user (NULL if claim absent)
-- Used in: RLS policies for role-based access control
-- No EXCEPTION block needed — `->>` returns NULL on missing key, no cast performed.

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RETURN auth.jwt() ->> 'role';
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_role TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.user_role IS
  'Extract role from JWT custom claim. Used in RLS policies for role-based access control. Returns NULL if claim absent.';

-- Note: JWT injection (Story 1.4 auth hook) populates these claims. In local dev without JWT,
-- both functions return NULL — RLS policies that reference them then fail-closed (correct default).
