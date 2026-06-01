// @ts-nocheck — Deno types not available in Node.js type-checking context
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

function age18ReconfirmationEmailHtml({
  confirmLink,
}: {
  confirmLink: string;
}): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Confirmação de consentimento — 18 anos</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Fizeste 18 anos — confirma o teu consentimento</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Parabéns! Os teus dados pessoais estão protegidos pelo teu clube na plataforma SPARTA.
    Como adulto, tens agora o direito de confirmar o teu próprio consentimento.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Tens <strong>90 dias</strong> para confirmar. Se não confirmares, os teus dados serão anonimizados automaticamente.
  </p>
  <a href="${confirmLink}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Confirmar o meu consentimento
  </a>
  <p style="font-size:12px;color:#737373;margin-top:24px;">
    Se não reconheces este pedido, podes ignorar este email.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA &middot; Gestão desportiva &middot; <a href="${confirmLink}" style="color:#A3A3A3;">${confirmLink}</a></p>
</body>
</html>`;

  const text = `Fizeste 18 anos — confirma o teu consentimento | SPARTA

Parabéns! Os teus dados pessoais estão protegidos pelo teu clube na plataforma SPARTA.
Como adulto, tens agora o direito de confirmar o teu próprio consentimento.

Tens 90 dias para confirmar. Se não confirmares, os teus dados serão anonimizados automaticamente.

Confirma em: ${confirmLink}

Se não reconheces este pedido, ignora este email.`;

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

  if (!supabaseUrl || !serviceRoleKey || !brevoApiKey || !brevoSenderEmail) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { reconfirmationId?: string };
  try {
    body = await req.json() as { reconfirmationId?: string };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { reconfirmationId } = body;
  if (!reconfirmationId) {
    return new Response(
      JSON.stringify({ error: "reconfirmationId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: reconfirmation, error: reconfError } = await supabase
    .from("consent_reconfirmations")
    .select("token, profile_id, status")
    .eq("id", reconfirmationId)
    .single();

  if (reconfError || !reconfirmation) {
    return new Response(
      JSON.stringify({ error: "Reconfirmation not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (reconfirmation.status !== "pending") {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "not_pending" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
    reconfirmation.profile_id as string
  );

  if (authError || !authData?.user?.email) {
    console.error("[send-age-18-reconfirmation] Failed to get user email:", authError);
    return new Response(
      JSON.stringify({ error: "Could not retrieve player email" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const playerEmail = authData.user.email;
  const confirmLink = `${siteUrl}/reconfirmacao/${reconfirmation.token}`;
  const { html, text } = age18ReconfirmationEmailHtml({ confirmLink });

  const fetchBrevo = fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SPARTA", email: brevoSenderEmail },
      to: [{ email: playerEmail }],
      subject: "Os teus dados — 18 anos: confirma se queres continuar",
      htmlContent: html,
      textContent: text,
    }),
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("brevo_timeout")), 5000)
  );

  let brevoRes: Response;
  try {
    brevoRes = await Promise.race([fetchBrevo, timeoutPromise]);
  } catch (e) {
    console.error("[send-age-18-reconfirmation] Brevo fetch error/timeout:", e);
    return new Response(
      JSON.stringify({ error: "Email send timeout" }),
      { status: 504, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!brevoRes.ok) {
    const errBody = await brevoRes.text();
    console.error("[send-age-18-reconfirmation] Brevo error:", errBody);
    return new Response(
      JSON.stringify({ error: "Email send failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export default handler;
