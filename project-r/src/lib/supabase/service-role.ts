import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * ⚠️ RESTRICTED SERVICE-ROLE CLIENT
 *
 * This client bypasses Row-Level Security (RLS) and can access all data.
 * Only use in:
 * - Edge Functions (Supabase)
 * - Cron jobs (pg_cron)
 * - Authorized Server Actions (must verify club_id in application logic)
 *
 * NEVER use in browser code or for user-initiated mutations without an RLS
 * layer above. ESLint rule blocks imports outside whitelisted paths.
 */
export const serviceRoleClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
