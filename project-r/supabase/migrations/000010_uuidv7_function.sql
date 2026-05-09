-- Migration: 000010_uuidv7_function
-- Purpose: Create UUIDv7 function for sortable, idempotent UUID generation
-- Reference: UUIDv7 RFC draft (timestamp-based sortable UUIDs)

-- Create UUIDv7 function following RFC specification
CREATE OR REPLACE FUNCTION uuidv7()
RETURNS uuid AS $$
DECLARE
  unix_ts_ms bigint;
  timestamp_hex text;
  version_and_random text;
  random_bytes bytea;
BEGIN
  -- Get current timestamp in milliseconds since epoch
  unix_ts_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

  -- Convert timestamp (48 bits) to hex (12 hex chars = 48 bits)
  -- Padded to 12 characters for proper alignment
  timestamp_hex := LPAD(TO_HEX(unix_ts_ms), 12, '0');

  -- Generate 10 random bytes for the rest of the UUID
  random_bytes := gen_random_bytes(10);

  -- Convert random bytes to hex string
  version_and_random := ENCODE(random_bytes, 'hex');

  -- Build final UUID: timestamp (12 hex) + version field (1 hex, set to 7) + rest of random (15 hex)
  -- Result: 12 + 1 + 19 = 32 hex chars = 16 bytes
  -- Format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
  RETURN (
    SUBSTRING(timestamp_hex, 1, 8) || '-' ||
    SUBSTRING(timestamp_hex, 9, 4) || '-' ||
    '7' || SUBSTRING(version_and_random, 2, 3) || '-' ||
    SUBSTRING(version_and_random, 5, 4) || '-' ||
    SUBSTRING(version_and_random, 9, 12)
  )::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION uuidv7 TO anon, authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION uuidv7 IS 'Generate UUIDv7: sortable timestamp-based UUID with random suffix. Used as default for all primary keys.';
