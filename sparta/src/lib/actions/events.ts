"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import {
  MatchEventInputSchema,
  type MatchEventInput,
} from "@/lib/schemas/match-events";

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function requireStaffRole(): Promise<
  Result<{ userId: string; clubId: string; role: string }, AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return err({ code: "unauthorized", message: "Autenticação necessária." });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return err({ code: "unauthorized", message: "Perfil não encontrado." });
  }

  if (profile.role !== "coach" && profile.role !== "analyst") {
    return err({ code: "forbidden", message: "Acesso restrito a staff." });
  }

  if (!profile.club_id) {
    return err({ code: "forbidden", message: "Clube não atribuído." });
  }

  return ok({
    userId: user.id,
    clubId: profile.club_id,
    role: profile.role as string,
  });
}

// ── Server Actions ─────────────────────────────────────────────────────────────

/**
 * submitMatchEvent — Upsert idempotente de um evento de performance.
 *
 * Idempotência: mesmo UUIDv7 enviado duas vezes (offline-drain replay) → no-op.
 * Queries de agregação DEVEM sempre filtrar is_deleted = false.
 */
export async function submitMatchEvent(
  payload: MatchEventInput
): Promise<Result<{ id: string }, AppError>> {
  const validated = MatchEventInputSchema.safeParse(payload);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados inválidos",
    });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  if (!userId) {
    return err({
      code: "unauthorized",
      message: "ID de utilizador inválido.",
    });
  }

  // Validar occurred_at não está no futuro
  const now = new Date();
  const occurredAt = new Date(payload.occurred_at);
  if (occurredAt > now) {
    return err({
      code: "validation",
      message: "Horário do evento não pode estar no futuro.",
    });
  }

  const serviceRole = getServiceRoleClient();

  // Verificar sessão pertence ao clube do staff
  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, club_id")
    .eq("id", validated.data.session_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) {
    return err({
      code: "not_found",
      message: "Sessão não encontrada ou não pertence ao clube.",
    });
  }

  // Verificar player em match_lineups para a sessão (tabela sem tipos — usar any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineup } = await (serviceRole.from as any)("match_lineups")
    .select("player_id")
    .eq("session_id", validated.data.session_id)
    .eq("player_id", validated.data.player_id)
    .maybeSingle();

  if (!lineup) {
    return err({
      code: "validation",
      message: "Jogador não está na convocatória desta sessão.",
    });
  }

  // Verificar processing_restricted
  const { data: player } = await serviceRole
    .from("players")
    .select("processing_restricted")
    .eq("id", validated.data.player_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({
      code: "not_found",
      message: "Jogador não encontrado neste clube.",
    });
  }

  if (player.processing_restricted === true) {
    return err({
      code: "forbidden",
      message:
        "Tratamento limitado — não é possível registar eventos para este jogador.",
    });
  }

  const { error: upsertError } = await serviceRole
    .from("match_events")
    .upsert(
      {
        id: validated.data.id,
        club_id: clubId,
        session_id: validated.data.session_id,
        player_id: validated.data.player_id,
        action: validated.data.action,
        zone: validated.data.zone,
        occurred_at: validated.data.occurred_at,
        captured_by: userId,
        captured_via: validated.data.captured_via,
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    return err({
      code: "unknown",
      message: `Erro ao guardar evento: ${upsertError.message || "erro desconhecido"}`,
    });
  }

  return ok({ id: validated.data.id });
}

/**
 * deleteMatchEvent — Soft delete de um evento de performance.
 *
 * Nenhuma row é fisicamente removida — apenas is_deleted=true (FR29).
 * A janela de tempo configurável é Story 6.6 — esta action não enforça tempo.
 */
export async function deleteMatchEvent(
  id: string
): Promise<Result<void, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: existing } = await auditedRead(
    { targetKind: "match_event", targetId: id, action: "match_event.delete_check", actorId: userId, clubId },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      serviceRole
        .from("match_events")
        .select("id, is_deleted")
        .eq("id", id)
        .eq("club_id", clubId)
        .maybeSingle()
  );

  if (!existing) {
    return err({ code: "not_found", message: "Evento não encontrado." });
  }

  if (existing.is_deleted === true) {
    return err({ code: "not_found", message: "Evento já foi apagado." });
  }

  const { error: updateError } = await serviceRole
    .from("match_events")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", id)
    .eq("club_id", clubId);

  if (updateError) {
    return err({
      code: "unknown",
      message: `Erro ao apagar evento: ${updateError.message || "erro desconhecido"}`,
    });
  }

  return ok(undefined);
}
