"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

async function sendConfirmationEmail(
  parentEmail: string,
  playerName: string
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[consent] RESEND_API_KEY em falta — email de confirmação não enviado");
    return;
  }

  const confirmedAt = new Date().toLocaleDateString("pt-PT");
  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: "Project R <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `Consentimento registado em ${confirmedAt}`,
      html: `<p>O seu consentimento para <strong>${playerName}</strong> foi registado em ${confirmedAt}.</p>
<p>${playerName} pode agora aceder à plataforma Project R.</p>`,
    });
  } catch (e) {
    console.error("[consent] sendConfirmationEmail falhou:", e);
  }
}

async function processConsentDecision(
  token: string,
  action: "confirm" | "withdraw",
  ip: string
): Promise<void> {
  const serviceRole = getServiceRoleClient();

  const { data: consent } = await serviceRole
    .from("parental_consents")
    .select("id, player_id, club_id, parent_email, token_expires_at")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!consent) return;

  if (new Date(consent.token_expires_at as string) < new Date()) {
    await serviceRole
      .from("parental_consents")
      .update({ status: "expired" })
      .eq("id", consent.id);
    return;
  }

  const { data: player } = await serviceRole
    .from("players")
    .select("profile_id, full_name")
    .eq("id", consent.player_id)
    .maybeSingle();

  if (!player?.profile_id) return;

  const playerName = (player.full_name as string) ?? "o seu educando";

  if (action === "confirm") {
    await serviceRole
      .from("parental_consents")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_ip: ip,
      })
      .eq("id", consent.id);

    await serviceRole
      .from("profiles")
      .update({ consent_status: "granted" })
      .eq("id", player.profile_id);

    await serviceRole.from("audit_logs").insert({
      club_id: consent.club_id,
      action: "consent.confirmed",
      target_kind: "player",
      target_id: consent.player_id,
      payload: { consent_id: consent.id, confirmed_ip: ip },
    });

    await sendConfirmationEmail(consent.parent_email as string, playerName);
    return;
  }

  await serviceRole
    .from("parental_consents")
    .update({
      status: "withdrawn",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", consent.id);

  await serviceRole
    .from("profiles")
    .update({ consent_status: "revoked" })
    .eq("id", player.profile_id);

  await serviceRole.from("audit_logs").insert({
    club_id: consent.club_id,
    action: "consent.withdrawn",
    target_kind: "player",
    target_id: consent.player_id,
    payload: { consent_id: consent.id },
  });
}

export async function submitConsentDecision(formData: FormData): Promise<void> {
  const token = formData.get("token") as string;
  const action = formData.get("action") as "confirm" | "withdraw";

  if (!token || !action) {
    redirect(`/consentimento/${token ?? ""}`);
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-real-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  try {
    await processConsentDecision(token, action, ip);
  } catch (e) {
    console.error("[consent] submitConsentDecision falhou:", e);
  }

  redirect(`/consentimento/${token}`);
}
