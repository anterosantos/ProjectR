"use server";

import { z } from "zod";
import { Resend } from "resend";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@/lib/supabase/server";
import { newId } from "@/lib/uuid";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

const ConsentInitiateSchema = z.object({
  playerId: z.string().uuid(),
  parentEmail: z.string().email(),
});

export async function initiateParentalConsent(
  input: unknown
): Promise<Result<{ consentId: string }, AppError>> {
  const parsed = ConsentInitiateSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: "validation", message: parsed.error.message });
  }
  const { playerId, parentEmail } = parsed.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, profile_id, age_group, club_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }
  if (!["u14", "u15"].includes(player.age_group)) {
    return err({ code: "validation", message: "Consentimento parental apenas para grupos u14 e u15" });
  }

  const { data: existing } = await serviceRole
    .from("parental_consents")
    .select("id, status")
    .eq("player_id", playerId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  if (existing) {
    return err({ code: "conflict", message: `Já existe um registo de consentimento ${existing.status} para este jogador` });
  }

  const { data: policy } = await serviceRole
    .from("privacy_policies")
    .select("id")
    .eq("is_current", true)
    .single();

  if (!policy) {
    return err({ code: "not_found", message: "Política de privacidade activa não encontrada" });
  }

  const token = newId();
  const ttlDays = parseInt(process.env.PARENTAL_CONSENT_TOKEN_TTL_DAYS || "90", 10);
  const tokenExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: consent, error: insertError } = await serviceRole
    .from("parental_consents")
    .insert({
      club_id: player.club_id,
      player_id: playerId,
      parent_email: parentEmail,
      token,
      token_expires_at: tokenExpiresAt,
      status: "pending",
      policy_version_id: policy.id,
    })
    .select("id")
    .single();

  if (insertError || !consent) {
    return err({ code: "internal", message: "Erro ao criar registo de consentimento" });
  }

  // Player may not have an auth account yet (invited later) — update consent_status only if profile exists
  if (player.profile_id) {
    const { error: profileError } = await serviceRole
      .from("profiles")
      .update({ consent_status: "pending" })
      .eq("id", player.profile_id);

    if (profileError) {
      return err({ code: "internal", message: "Erro ao actualizar estado de consentimento" });
    }
  }

  await serviceRole.from("audit_logs").insert({
    club_id: player.club_id,
    action: "consent.initiate",
    target_kind: "player",
    target_id: playerId,
    payload: { consent_id: consent.id, parent_email: parentEmail },
  });

  // Fire-and-forget — não bloqueia o retorno da Server Action
  void fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-parental-consent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ consentId: consent.id }),
    }
  )
    .then(async (res) => {
      if (!res.ok) {
        const errBody = await res.text();
        console.error("[consent] send-parental-consent failed:", res.status, errBody);
      }
    })
    .catch((e) => console.error("[consent] send-parental-consent fetch error:", e));

  return ok({ consentId: consent.id });
}

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

export async function resendConsentEmail(
  playerId: string
): Promise<Result<{ message: string }, AppError>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (!staffProfile || !["coach", "analyst"].includes(staffProfile.role)) {
    return err({ code: "forbidden", message: "Sem permissão para reenviar email de consentimento" });
  }

  const serviceRole = getServiceRoleClient();
  const { data: player } = await serviceRole
    .from("players")
    .select("club_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }

  // Patch 1: Verify club isolation — staff can only resend for their own club
  if (staffProfile.club_id !== player.club_id) {
    return err({ code: "forbidden", message: "Sem permissão para reenviar email para este jogador (club diferente)" });
  }

  const { data: consent } = await serviceRole
    .from("parental_consents")
    .select("id, last_manual_resend_at")
    .eq("player_id", playerId)
    .eq("status", "pending")
    .maybeSingle();

  if (!consent) {
    return err({ code: "not_found", message: "Nenhum consentimento pendente para este jogador" });
  }

  // Patch 2: Rate-limit check — verify timestamp BEFORE sending
  // Patch 3: Show seconds if <1 minute remaining
  const now = new Date();
  if (consent.last_manual_resend_at) {
    const elapsed = now.getTime() - new Date(consent.last_manual_resend_at as string).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const remaining = RATE_LIMIT_MS - elapsed;

      if (remaining < 60000) {
        const secondsLeft = Math.ceil(remaining / 1000);
        return err({
          code: "rate_limited",
          message: `Tenta novamente em ${secondsLeft} segundo${secondsLeft !== 1 ? "s" : ""}`,
        });
      } else {
        const minutesLeft = Math.ceil(remaining / 60000);
        return err({
          code: "rate_limited",
          message: `Pode reenviar novamente em ${minutesLeft} minuto${minutesLeft !== 1 ? "s" : ""}`,
        });
      }
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return err({ code: "internal", message: "Configuração de email em falta" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sparta-red.vercel.app";

  const { data: consentRecord } = await serviceRole
    .from("parental_consents")
    .select("token, token_expires_at, player_id, parent_email")
    .eq("id", consent.id)
    .single();

  if (!consentRecord) {
    return err({ code: "not_found", message: "Registo de consentimento não encontrado" });
  }

  const { data: playerRecord } = await serviceRole
    .from("players")
    .select("full_name")
    .eq("id", consentRecord.player_id)
    .single();

  const playerName = playerRecord?.full_name ?? "o seu educando";
  const confirmUrl = `${siteUrl}/consentimento/${consentRecord.token}`;
  const expiresAt = new Date(consentRecord.token_expires_at as string).toLocaleDateString("pt-PT");

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: "SPARTA <onboarding@resend.dev>",
    to: [consentRecord.parent_email as string],
    subject: "[Lembrete] Consentimento parental — SPARTA",
    html: `<p>Caro encarregado de educação,</p>
<p>Este é um lembrete para confirmar o consentimento parental de <strong>${playerName}</strong>.</p>
<p><a href="${confirmUrl}">Confirmar consentimento</a> (válido até ${expiresAt})</p>`,
  });

  if (emailError) {
    console.error("[resendConsentEmail] Resend error:", emailError);
    return err({ code: "internal", message: "Falha ao enviar email de consentimento" });
  }

  await serviceRole.from("parental_consent_reminders_log").insert({
    consent_id: consent.id,
    kind: "manual_resend",
  });

  return ok({ message: "Email de consentimento reenviado." });
}

export type PendingConsentPlayer = {
  playerId: string;
  playerName: string;
};

export async function getPendingConsentsOver14Days(): Promise<PendingConsentPlayer[]> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Patch 4: Get authenticated staff's club_id first
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!staffProfile?.club_id) return [];

  const serviceRole = getServiceRoleClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const { data: consents } = await serviceRole
    .from("parental_consents")
    .select("id, player_id")
    .eq("club_id", staffProfile.club_id)
    .eq("status", "pending")
    .lt("created_at", cutoff.toISOString());

  if (!consents || consents.length === 0) return [];

  const playerIds = consents.map((c) => c.player_id as string);

  const { data: players } = await serviceRole
    .from("players")
    .select("id, full_name")
    .in("id", playerIds);

  const nameMap = new Map(
    (players ?? []).map((p) => [p.id as string, p.full_name as string])
  );

  return consents.map((c) => ({
    playerId: c.player_id as string,
    playerName: nameMap.get(c.player_id as string) ?? "Jogador desconhecido",
  }));
}

export async function getConsentByPlayerId(playerId: string) {
  const serviceRole = getServiceRoleClient();
  const { data } = await serviceRole
    .from("parental_consents")
    .select("status, parent_email, token_expires_at")
    .eq("player_id", playerId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();
  return data ?? null;
}

export type ConsentTokenState =
  | "valid"
  | "expired"
  | "confirmed"
  | "withdrawn"
  | "invalid";

export type ConsentTokenResult = {
  state: ConsentTokenState;
  playerName?: string;
  policyBody?: string;
  tokenExpiresAt?: string;
};

export async function getConsentByToken(
  token: string
): Promise<ConsentTokenResult> {
  if (!token) return { state: "invalid" };

  const serviceRole = getServiceRoleClient();

  const { data: consent } = await serviceRole
    .from("parental_consents")
    .select("id, status, player_id, token_expires_at, policy_version_id")
    .eq("token", token)
    .maybeSingle();

  if (!consent) return { state: "invalid" };

  if (consent.status === "confirmed") return { state: "confirmed" };
  if (consent.status === "withdrawn") return { state: "withdrawn" };

  const isExpired = new Date(consent.token_expires_at as string) < new Date();
  if (consent.status === "expired" || isExpired) {
    if (consent.status === "pending" && isExpired) {
      await serviceRole
        .from("parental_consents")
        .update({ status: "expired" })
        .eq("id", consent.id);
    }
    return { state: "expired" };
  }

  const { data: player } = await serviceRole
    .from("players")
    .select("full_name")
    .eq("id", consent.player_id)
    .maybeSingle();

  const { data: policy } = await serviceRole
    .from("privacy_policies")
    .select("body_full_md")
    .eq("id", consent.policy_version_id)
    .maybeSingle();

  return {
    state: "valid",
    playerName: (player?.full_name as string) ?? "o seu educando",
    policyBody: (policy?.body_full_md as string) ?? "",
    tokenExpiresAt: consent.token_expires_at as string,
  };
}

export async function getPlayerConsentStatus(profileId: string) {
  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!player) return null;

  const { data: consent } = await serviceRole
    .from("parental_consents")
    .select("status, parent_email, token_expires_at")
    .eq("player_id", player.id)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  return consent ?? null;
}
