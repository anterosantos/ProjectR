import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session on every proxied request and writes updated
 * auth cookies back to the response. Returns the refreshed user (null if
 * unauthenticated), the decoded JWT claims (including custom claims injected
 * by the auth hook), and the response to pass through.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ user: unknown; response: NextResponse; claims: Record<string, unknown>; supabase: ReturnType<typeof createServerClient<Database>> }> {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the JWT server-side and triggers token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decode JWT claims to access custom claims injected by the auth hook
  // (e.g. user_role, club_id). These are top-level JWT claims not exposed
  // in the User object returned by getUser().
  let claims: Record<string, unknown> = {};
  if (user) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const payloadB64 = session.access_token.split(".")?.[1];
        if (payloadB64) {
          const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
          const jsonStr = atob(padded + "==".slice(0, (4 - (padded.length % 4)) % 4));
          claims = JSON.parse(jsonStr) as Record<string, unknown>;
        }
      } catch {
        // Silent fail — claims remain empty, routing falls back to /login
      }
    }
  }

  return { user, response, claims, supabase };
}
