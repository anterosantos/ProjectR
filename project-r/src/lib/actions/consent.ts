"use server";

import { z } from "zod";
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

  if (!player.profile_id) {
    return err({ code: "internal", message: "Perfil de jogador não encontrado" });
  }

  const { error: profileError } = await serviceRole
    .from("profiles")
    .update({ consent_status: "pending" })
    .eq("id", player.profile_id);

  if (profileError) {
    return err({ code: "internal", message: "Erro ao actualizar estado de consentimento" });
  }

  await serviceRole.from("audit_logs").insert({
    club_id: player.club_id,
    action: "consent.initiate",
    target_kind: "player",
    target_id: playerId,
    payload: { consent_id: consent.id, parent_email: parentEmail },
  });

  return ok({ consentId: consent.id });
}

export async function resendConsentEmail(
  playerId: string
): Promise<Result<{ message: string }, AppError>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!staffProfile || !["coach", "analyst"].includes(staffProfile.role)) {
    return err({ code: "forbidden", message: "Sem permissão para reenviar email de consentimento" });
  }

  const serviceRole = getServiceRoleClient();
  const { data: consent } = await serviceRole
    .from("parental_consents")
    .select("id")
    .eq("player_id", playerId)
    .eq("status", "pending")
    .maybeSingle();

  if (!consent) {
    return err({ code: "not_found", message: "Nenhum consentimento pendente para este jogador" });
  }

  return ok({ message: "O email de consentimento será enviado em breve. (Funcionalidade completa em Story 3.3)" });
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
