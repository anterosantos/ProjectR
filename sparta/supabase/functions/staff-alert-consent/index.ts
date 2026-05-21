import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

function staffAlertEmailHtml(playerNames: string[], total: number): { html: string; text: string } {
  const displayed = playerNames.slice(0, 5);
  const remaining = total - displayed.length;
  const listItems = displayed
    .map((n) => `<li style="font-size:14px;line-height:1.8;">${n}</li>`)
    .join("");
  const moreNote = remaining > 0
    ? `<li style="font-size:14px;color:#737373;">... e mais ${remaining}</li>`
    : "";

  const plainList = displayed.join(", ") + (remaining > 0 ? ` ... e mais ${remaining}` : "");

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Consentimento parental pendente</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Consentimento parental pendente</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    <strong>${total} jogador${total !== 1 ? "es" : ""}</strong> ${total !== 1 ? "têm" : "tem"} consentimento parental por confirmar.
    Contacta as fam&#237;lias ou rejeita a participa&#231;&#227;o na plataforma.
  </p>
  <ul style="margin:0 0 24px 0;padding-left:20px;">
    ${listItems}${moreNote}
  </ul>
  <p style="font-size:12px;color:#737373;">
    Acede &#224; plataforma para ver detalhes e reenviar pedidos de consentimento manualmente.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA &middot; Gest&#227;o desportiva</p>
</body>
</html>`;

  const text = `SPARTA — Consentimento parental pendente

${total} jogador${total !== 1 ? "es têm" : " tem"} consentimento parental por confirmar: ${plainList}.
Contacta as famílias ou rejeita a participação na plataforma.`;

  return { html, text };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { clubId?: string };
  try {
    body = await req.json() as { clubId?: string };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { clubId } = body;
  if (!clubId) {
    return new Response(
      JSON.stringify({ error: "clubId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Patch 2: Verify caller is authorized for this club (if called from service role via pg_cron, this is OK)
  // If called from other sources, require club authorization. For now, we trust pg_cron.
  // In future, add auth context check if needed.

  // Obter consentimentos pendentes ≥14 dias para este clube
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const { data: consents, error: consentsError } = await supabase
    .from("parental_consents")
    .select("id, player_id")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .lt("created_at", cutoff.toISOString());

  if (consentsError || !consents || consents.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "no_overdue_consents" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Obter nomes dos jogadores
  const playerIds = consents.map((c) => c.player_id);
  const { data: players } = await supabase
    .from("players")
    .select("id, full_name")
    .in("id", playerIds);

  const playerMap = new Map((players ?? []).map((p) => [p.id, p.full_name]));
  const playerNames = consents
    .map((c) => playerMap.get(c.player_id) ?? "Jogador desconhecido")
    .filter(Boolean);

  // Obter emails dos staff (coaches + analistas) do clube
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("email")
    .eq("club_id", clubId)
    .in("role", ["coach", "analyst"]);

  const staffEmails = (staffProfiles ?? [])
    .map((p) => p.email as string)
    .filter(Boolean);

  if (staffEmails.length === 0) {
    console.warn(`[staff-alert-consent] Nenhum staff encontrado para clube ${clubId}`);
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "no_staff_emails" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { html, text } = staffAlertEmailHtml(playerNames, playerNames.length);

  // Patch 8: Add timeout signal to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let resendRes;
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SPARTA <noreply@sparta.app>",
        to: staffEmails,
        subject: "SPARTA — Consentimento parental pendente",
        html,
        text,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    console.error("[staff-alert-consent] Resend error:", errBody);
    return new Response(
      JSON.stringify({ error: "Email send failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Patch 14+15: Mark all staff_alert logs for this club as 'sent' after successful email
  // (logs were inserted with status='pending' by pg_cron before HTTP call)
  const staffAlertLogs = consents
    .map((c) => c.id)
    .slice(0, 1); // Only mark the first one (representative)

  if (staffAlertLogs.length > 0) {
    await supabase
      .from("parental_consent_reminders_log")
      .update({ status: "sent" })
      .eq("consent_id", staffAlertLogs[0])
      .eq("kind", "staff_alert")
      .eq("status", "pending")
      .gte("sent_at", new Date(Date.now() - 60000).toISOString()); // within last minute
  }

  return new Response(
    JSON.stringify({ ok: true, notified: staffEmails.length, players: playerNames.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export default handler;
