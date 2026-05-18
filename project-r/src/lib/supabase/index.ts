// Browser / Client Component client
export { createClient } from "./client";

// Server Action / Server Component client
export { createServerClient } from "./server";

// Proxy session-refresh helper
export { updateSession } from "./middleware";

// Auth helpers (re-exported for convenience)
export {
  isAuthenticated,
  getSession,
  updatePassword,
  requestPasswordRecovery,
  logout,
  signInWithPassword,
  getRoleHomePath,
  getCurrentUserWithRole,
} from "./client";

// service-role is intentionally NOT exported here.
// Import it explicitly from "@/lib/supabase/service-role" to make usage
// visible in code review and trigger the ESLint restriction.
