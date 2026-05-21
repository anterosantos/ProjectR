import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

type ConsentState = "valid" | "expired" | "confirmed" | "withdrawn" | "invalid";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendConfirmationEmail({
  resendApiKey,
  parentEmail,
  playerName,
  confirmedAt,
}: {
  resendApiKey: string;
  parentEmail: string;
  playerName: string;
  confirmedAt: string;
}): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Consentimento registado</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Consentimento registado</h1>
  <p style="font-size:14px;line-height:1.6;">
    O seu consentimento para <strong>${playerName}</strong> foi registado em ${confirmedAt}.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-top:16px;">
    ${playerName} pode agora aceder &#224; plataforma SPARTA.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA &middot; Gest&#227;o desportiva</p>
</body>
</html>`;

  const text = `Consentimento registado — SPARTA\n\nO seu consentimento para ${playerName} foi registado em ${confirmedAt}.\n${playerName} pode agora aceder à plataforma.`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SPARTA <noreply@sparta.app>",
        to: [parentEmail],
        subject: `Consentimento registado em ${confirmedAt}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[consent-validate] sendConfirmationEmail failed:", errBody);
    }
  } catch (e) {
    console.error("[consent-validate] sendConfirmationEmail error:", e);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return jsonResponse({ state: "invalid" as ConsentState }, 400);

    const { data: consent } = await supabase
      .from("parental_consents")
      .select("id, status, player_id, token_expires_at, policy_version_id")
      .eq("token", token)
      .maybeSingle();

    if (!consent) {
      return jsonResponse({ state: "invalid" as ConsentState });
    }

    if (consent.status === "confirmed") {
      return jsonResponse({ state: "confirmed" as ConsentState });
    }
    if (consent.status === "withdrawn") {
      return jsonResponse({ state: "withdrawn" as ConsentState });
    }

    const isExpired = new Date(consent.token_expires_at) < new Date();
    if (consent.status === "expired" || isExpired) {
      if (consent.status === "pending" && isExpired) {
        await supabase
          .from("parental_consents")
          .update({ status: "expired" })
          .eq("id", consent.id);
      }
      return jsonResponse({ state: "expired" as ConsentState });
    }

    const { data: player } = await supabase
      .from("players")
      .select("full_name")
      .eq("id", consent.player_id)
      .single();

    const { data: policy } = await supabase
      .from("privacy_policies")
      .select("body_full_md")
      .eq("id", consent.policy_version_id)
      .single();

    return jsonResponse({
      state: "valid" as ConsentState,
      playerName: player?.full_name ?? "o seu educando",
      policyBody: policy?.body_full_md ?? "",
      tokenExpiresAt: consent.token_expires_at,
    });
  }

  if (req.method === "POST") {
    let body: { token?: string; action?: "confirm" | "withdraw"; ip?: string };
    try {
      body = await req.json() as { token?: string; action?: "confirm" | "withdraw"; ip?: string };
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { token, action, ip } = body;

    if (!token || !action) {
      return jsonResponse({ error: "token and action required" }, 400);
    }

    const { data: consent } = await supabase
      .from("parental_consents")
      .select("id, player_id, club_id, parent_email, token_expires_at")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!consent) {
      return jsonResponse({ error: "Consent not found or already processed" }, 404);
    }

    if (new Date(consent.token_expires_at) < new Date()) {
      await supabase
        .from("parental_consents")
        .update({ status: "expired" })
        .eq("id", consent.id);
      return jsonResponse({ error: "Token expired" }, 410);
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("profile_id, full_name")
      .eq("id", consent.player_id)
      .single();

    if (!player || !player.profile_id || playerError) {
      return jsonResponse(
        { error: "Player or profile not found" },
        404
      );
    }

    if (action === "confirm") {
      await supabase
        .from("parental_consents")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_ip: ip ?? null,
        })
        .eq("id", consent.id);

      await supabase
        .from("profiles")
        .update({ consent_status: "granted" })
        .eq("id", player.profile_id);

      await supabase.from("audit_logs").insert({
        club_id: consent.club_id,
        action: "consent.confirmed",
        target_kind: "player",
        target_id: consent.player_id,
        payload: { consent_id: consent.id, confirmed_ip: ip ?? null },
      });

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const confirmedAt = new Date().toLocaleDateString("pt-PT");
      const playerName = player?.full_name ?? "o seu educando";
      if (resendApiKey) {
        await sendConfirmationEmail({
          resendApiKey,
          parentEmail: consent.parent_email,
          playerName,
          confirmedAt,
        });
      }

      return jsonResponse({ ok: true, action: "confirmed" });
    }

    if (action === "withdraw") {
      await supabase
        .from("parental_consents")
        .update({
          status: "withdrawn",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", consent.id);

      await supabase
        .from("profiles")
        .update({ consent_status: "revoked" })
        .eq("id", player.profile_id);

      await supabase.from("audit_logs").insert({
        club_id: consent.club_id,
        action: "consent.withdrawn",
        target_kind: "player",
        target_id: consent.player_id,
        payload: { consent_id: consent.id },
      });

      return jsonResponse({ ok: true, action: "withdrawn" });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  }

  return new Response("Method not allowed", { status: 405 });
};

export default handler;
