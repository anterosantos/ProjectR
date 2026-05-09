-- Migration: 000030_auth_helpers
-- Purpose: Create helper functions to extract JWT claims for RLS policies
-- Context: Story 1.4 (auth hook) will inject club_id and role into JWT. These functions enable policies to use those claims.
-- Note: Functions are in public schema (not auth schema, which is Supabase-managed)

---

-- Function: public.get_club_id()
-- Returns: uuid of the user's current club (from JWT claim 'club_id')
-- Behavior: Returns NULL gracefully if claim not present (no crash)
-- Used in: RLS policies to enforce club-level data isolation
-- Note: Called as public.get_club_id() in policies

CREATE OR REPLACE FUNCTION public.get_club_id()
RETURNS uuid AS $$
DECLARE
  current_claim text;
BEGIN
  current_claim := auth.jwt() ->> 'club_id';
  IF current_claim IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN current_claim::uuid;
EXCEPTION WHEN OTHERS THEN
  -- Gracefully return NULL if casting fails or JWT is absent
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to all roles (needed for RLS policies to work)
GRANT EXECUTE ON FUNCTION public.get_club_id TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION public.get_club_id IS 'Extract club_id from JWT custom claim. Used in RLS policies for multi-tenant isolation. Returns NULL if not present.';

---

-- Function: public.get_user_role()
-- Returns: text role of the user (from JWT claim 'role')
-- Behavior: Returns NULL gracefully if claim not present (no crash)
-- Used in: RLS policies to enforce role-based access control
-- Note: Called as public.get_user_role() in policies

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN auth.jwt() ->> 'role';
EXCEPTION WHEN OTHERS THEN
  -- Gracefully return NULL if JWT is absent or claim missing
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to all roles (needed for RLS policies to work)
GRANT EXECUTE ON FUNCTION public.get_user_role TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION public.get_user_role IS 'Extract role from JWT custom claim. Used in RLS policies for role-based access control. Returns NULL if not present.';

---

-- Note: These functions will be tested thoroughly in Story 1.4 (auth hook) when JWT injection is implemented.
-- In local development (without JWT), both functions will return NULL, which is expected behavior.
