// Supabase Auth Hook: Custom Access Token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ claims: {} }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const claims = body.claims || {};
    const userId = claims.sub || (body.user && body.user.id);

    if (!userId) {
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Dynamically import createClient
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.40.0");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, club_id, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Could not fetch profile:", error.message);
      return new Response(
        JSON.stringify({ claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (profile) {
      claims.club_id = profile.club_id;
      claims.user_role = profile.role;
    }

    return new Response(
      JSON.stringify({ claims }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auth hook error:", error);
    return new Response(
      JSON.stringify({ claims: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});