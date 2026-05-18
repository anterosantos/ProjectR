// Supabase Auth Hook: Custom Access Token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.40.0";

serve(async (req: Request) => {
  try {
    const body = await req.json();
    const claims = body.claims || {};
    const userId = claims.sub || (body.user && body.user.id);

    if (!userId) {
      return new Response(
        JSON.stringify({ claims: claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ claims: claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log("Fetching profile for user:", userId);

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("club_id, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Could not fetch profile for user:", userId, "Error:", error.message);
      console.log("Full error:", JSON.stringify(error));
      return new Response(
        JSON.stringify({ claims: claims }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Profile found:", JSON.stringify(profile));

    // AQUI ESTÁ A CORREÇÃO (Mudado de role para user_role)
    if (profile) {
      claims.club_id = profile.club_id;
      claims.user_role = profile.role; 
    }

    return new Response(
      JSON.stringify({ claims: claims }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fatal Auth Hook Error:", error);
    return new Response(
      JSON.stringify({ claims: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});