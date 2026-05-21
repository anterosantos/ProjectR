-- Migration: 000010_uuidv7_function
-- Purpose: Create UUIDv7 function for sortable, idempotent UUID generation (AR4)
-- Reference: RFC 9562 §5.7 (UUID Version 7) + §4 (variant bits)
--
-- Implementation notes:
-- - Uses byte-level construction (set_byte) to deterministically place version + variant bits.
-- - Version 7 (0111) is set in the high nibble of byte 6.
-- - Variant 10 (RFC 4122/9562) is set in the high two bits of byte 8.
-- - Uses clock_timestamp() (statement-time) NOT now() (transaction-time) for sortability across
--   multiple inserts in the same transaction.
-- - Note (D4 / MVP trade-off): UUIDs generated within the same millisecond have RANDOM
--   sub-ms ordering, NOT monotonic. Acceptable because (a) this function is a server-side
--   fallback (per AR4); (b) the primary path is client-generated `uuid` v9 via NPM lib;
--   (c) batch jobs will be rare. Revisit if high-volume server-side inserts emerge.
-- - Hardened search_path (CVE-2018-1058) prevents schema-based hijacking.

CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  unix_ts_ms bigint;
  uuid_bytes bytea;
BEGIN
  -- Statement-level timestamp (each call gets a fresh value, even in same txn)
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  -- Start with 16 random bytes (gen_random_bytes is in pgcrypto extension @ `extensions` schema)
  uuid_bytes := extensions.gen_random_bytes(16);

  -- Bytes 0-5: 48-bit timestamp (big-endian, ms since epoch)
  uuid_bytes := set_byte(uuid_bytes, 0, ((unix_ts_ms >> 40) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 1, ((unix_ts_ms >> 32) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 2, ((unix_ts_ms >> 24) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 3, ((unix_ts_ms >> 16) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 4, ((unix_ts_ms >> 8) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 5, (unix_ts_ms & 255)::int);

  -- Byte 6: version 7 in high nibble (low nibble stays random)
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);

  -- Byte 8: variant 10 in high two bits (low six bits stay random)
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- P6: REVOKE EXECUTE from anon (no use case for unauthenticated UUID minting; CSPRNG DoS surface)
REVOKE ALL ON FUNCTION public.uuidv7 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uuidv7 TO authenticated, service_role;

COMMENT ON FUNCTION public.uuidv7 IS
  'Generate RFC 9562-compliant UUIDv7 (sortable timestamp + random). Server-side fallback per AR4; client primary path uses uuid v9 NPM lib. Not strictly monotonic within a millisecond — see migration comments.';
