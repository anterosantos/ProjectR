// Supabase Auth Hook: Custom Access Token
// Versão simplificada para debug
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const body = await req.json();
    const claims = body.claims || {};

    // Por agora, apenas retorna os claims originais sem modificar
    console.log("Auth hook called with claims:", JSON.stringify(claims));

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