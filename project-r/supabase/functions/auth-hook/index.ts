// Supabase Auth Hook: Custom Access Token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("[auth-hook] Missing authorization header");
      return new Response(
        JSON.stringify({ claims: {} }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const claims = body.claims || {};
    const userId = claims.sub || (body.user && body.user.id);

    if (!userId) {
      console.warn("[auth-hook] No userId found in claims or body");
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[auth-hook] Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Dynamically import createClient with timeout
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.40.0");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, club_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn(`[auth-hook] Profile fetch error for user ${userId}:`, error.message);
      // Don't fail — just return claims without profile data
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (profile) {
      console.log(`[auth-hook] Profile found for user ${userId}, injecting claims`);
      claims.club_id = profile.club_id;
      claims.user_role = profile.role;
    } else {
      console.warn(`[auth-hook] No profile found for user ${userId}`);
    }

    return new Response(
      JSON.stringify({ claims }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[auth-hook] Unexpected error:", error);
    // Return claims even on error — don't block login
    const body = await req.json().catch(() => ({}));
    const claims = body.claims || {};
    return new Response(
      JSON.stringify({ claims }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});