-- Migration: 000075_player_rpc
-- Purpose: Atomic upsert of player positions within a transaction (AC #3, #5)

CREATE OR REPLACE FUNCTION public.upsert_player_positions(
  p_player_id uuid,
  p_positions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  DELETE FROM positions WHERE player_id = p_player_id;

  INSERT INTO positions (id, player_id, position, is_primary, sort_order)
  SELECT
    public.uuidv7(),
    p_player_id,
    (pos->>'position')::text,
    (pos->>'is_primary')::boolean,
    (pos->>'sort_order')::int
  FROM jsonb_array_elements(p_positions) AS pos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_player_positions TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_player_positions IS
  'Atomically replaces all positions for a player. SECURITY INVOKER preserves RLS.';
