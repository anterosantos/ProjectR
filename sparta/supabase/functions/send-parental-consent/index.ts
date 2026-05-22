import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

function parentalConsentEmailHtml({
  playerName,
  confirmUrl,
  expiresAt,
  reminderCopy,
}: {
  playerName: string;
  confirmUrl: string;
  expiresAt: string;
  reminderCopy?: string;
}): { html: string; text: string } {
  const reminderBlock = reminderCopy
    ? `<p style="font-size:13px;line-height:1.6;color:#525252;margin-bottom:16px;font-style:italic;">${reminderCopy}</p>`
    : "";
  const reminderText = reminderCopy ? `\n${reminderCopy}\n` : "";

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Consentimento parental</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Pedido de consentimento parental</h1>
  ${reminderBlock}
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Foi criada uma conta para <strong>${playerName}</strong> na plataforma SPARTA,
    utilizada pelo clube para gerir sess&#245;es desportivas e bem-estar dos atletas.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-bottom:24px;">
    Para que ${playerName} possa aceder, precisamos da sua autoriza&#231;&#227;o como encarregado de educa&#231;&#227;o.
    O link &#233; v&#225;lido at&#233; ${expiresAt}.
  </p>
  <a href="${confirmUrl}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Confirmar consentimento
  </a>
  <p style="font-size:12px;color:#737373;margin-top:24px;">
    Se n&#227;o reconhece este pedido, pode ignorar este email. Os dados s&#243; ser&#227;o recolhidos ap&#243;s confirma&#231;&#227;o.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA &middot; Gest&#227;o desportiva &middot; <a href="${confirmUrl}" style="color:#A3A3A3;">${confirmUrl}</a></p>
</body>
</html>`;

  const text = `Pedido de consentimento parental — SPARTA
${reminderText}
Foi criada uma conta para ${playerName} na plataforma SPARTA.
Para autorizar o acesso, clique no link abaixo (válido até ${expiresAt}):

${confirmUrl}

Se não reconhece este pedido, ignore este email.`;

  return { html, text };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://sparta-webapp.vercel.app";

  console.log("[send-parental-consent] env check:", {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceRoleKey: !!serviceRoleKey,
    hasBrevoApiKey: !!brevoApiKey,
    brevoKeyPrefix: brevoApiKey?.slice(0, 8) ?? "missing",
    siteUrl,
  });

  if (!supabaseUrl || !serviceRoleKey || !brevoApiKey || !brevoSenderEmail) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { consentId?: string; includePrefix?: boolean; prefixText?: string };
  try {
    body = await req.json() as { consentId?: string; includePrefix?: boolean; prefixText?: string };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { consentId, includePrefix = false, prefixText = "" } = body;
  if (!consentId) {
    return new Response(
      JSON.stringify({ error: "consentId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: consent, error: consentError } = await supabase
    .from("parental_consents")
    .select("token, parent_email, player_id, token_expires_at, status")
    .eq("id", consentId)
    .single();

  if (consentError || !consent) {
    return new Response(
      JSON.stringify({ error: "Consent not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (consent.status !== "pending") {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "not_pending" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Patch 7: Check token expiry before sending email
  if (new Date(consent.token_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "token_expired" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: player } = await supabase
    .from("players")
    .select("full_name")
    .eq("id", consent.player_id)
    .single();

  const playerName = player?.full_name ?? "o seu educando";
  const confirmUrl = `${siteUrl}/consentimento/${consent.token}`;
  const expiresAt = new Date(consent.token_expires_at).toLocaleDateString("pt-PT");

  // Construir copy baseado no tipo de lembrete
  let subject = "Consentimento parental — SPARTA";
  let reminderCopy: string | undefined;

  // Patch 4: Whitelist allowed prefixes for defensive coding
  const ALLOWED_PREFIXES = ["[Lembrete]", "[2º Lembrete]", "[2o Lembrete]"];

  if (includePrefix && prefixText) {
    // Validate prefix against whitelist
    if (!ALLOWED_PREFIXES.includes(prefixText)) {
      return new Response(
        JSON.stringify({ error: "Invalid prefixText" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    subject = `${prefixText} Consentimento parental — SPARTA`;
    if (prefixText.includes("2º") || prefixText.includes("2o")) {
      reminderCopy = "Esta é a última tentativa de reenvio automático. Por favor confirme o consentimento o mais brevemente possível.";
    } else {
      reminderCopy = "Se já confirmou, pode ignorar este lembrete.";
    }
  }

  const { html, text } = parentalConsentEmailHtml({ playerName, confirmUrl, expiresAt, reminderCopy });

  const fetchBrevo = fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SPARTA", email: brevoSenderEmail },
      to: [{ email: consent.parent_email }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("brevo_timeout")), 8000)
  );

  let brevoRes: Response;
  try {
    brevoRes = await Promise.race([fetchBrevo, timeoutPromise]);
  } catch (e) {
    console.error("[send-parental-consent] Brevo fetch error/timeout:", e);
    return new Response(
      JSON.stringify({ error: "Email send timeout" }),
      { status: 504, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!brevoRes.ok) {
    const errBody = await brevoRes.text();
    console.error("[send-parental-consent] Brevo error:", errBody);
    return new Response(
      JSON.stringify({ error: "Email send failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Patch 14+15: Mark log entry as 'sent' after successful email
  // (log was inserted with status='pending' by pg_cron before HTTP call)
  if (includePrefix) {
    const kind = prefixText.includes("2º") || prefixText.includes("2o") ? "day_14" : "day_7";
    await supabase
      .from("parental_consent_reminders_log")
      .update({ status: "sent" })
      .eq("consent_id", consentId)
      .eq("kind", kind)
      .eq("status", "pending")
      .gte("sent_at", new Date(Date.now() - 60000).toISOString()); // within last minute
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export default handler;
