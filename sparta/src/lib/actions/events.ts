"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { logAccess } from "@/lib/actions/audit";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import {
  MatchEventInputSchema,
  MatchEventUpdateSchema,
  type MatchEventInput,
  MATCH_ACTIONS,
  MATCH_ZONES,
  type SessionEventEntry,
} from "@/lib/schemas/match-events";
import { requireStaffRole } from "@/lib/actions/auth";
import type { RecentEventEntry, MatchAction } from "@/lib/stores/match-session";
import { isEditWindowOpen } from "@/lib/utils/match-events";

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

// ── Private helpers ────────────────────────────────────────────────────────────

async function getEventEditWindowHours(clubId: string): Promise<number> {
  const serviceRole = getServiceRoleClient();
  const { data } = await serviceRole
    .from("notification_settings")
    .select("event_edit_window_hours")
    .eq("club_id", clubId)
    .maybeSingle();
  return (data as { event_edit_window_hours?: number } | null)?.event_edit_window_hours ?? 24;
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
        .select("id, is_deleted, session_id")
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

  // Window check (Story 6.6) — guard against race condition (dual deletes)
  // Check session existence first to ensure we can enforce the window
  const { data: session } = await serviceRole
    .from("sessions")
    .select("scheduled_at, duration_min")
    .eq("id", existing.session_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) {
    return err({ code: "not_found", message: "Sessão não encontrada." });
  }

  const windowHours = await getEventEditWindowHours(clubId);
  if (!isEditWindowOpen(session.scheduled_at, session.duration_min ?? 90, windowHours)) {
    return err({
      code: "forbidden",
      message: "Janela de edição encerrada. Não é possível apagar este evento.",
    });
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

  // Fire-and-forget audit logging: failures do not block deletion.
  // Monitor audit log errors separately via error tracking system (Sentry, etc).
  void logAccess("event.deleted", "match_event", id);

  return ok(undefined);
}

/**
 * getRecentMatchEvents — Últimos N eventos de uma sessão para o ring de auditoria.
 *
 * Two-step query: match_events + match_lineups para jersey numbers.
 * Apenas eventos não apagados (is_deleted = false).
 */
export async function getRecentMatchEvents(
  sessionId: string,
  limit = 6
): Promise<Result<RecentEventEntry[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, userId } = authResult.data;

  if (!userId) {
    return err({ code: "unauthorized", message: "User ID is invalid." });
  }

  const serviceRole = getServiceRoleClient();

  // Step 1: últimos N eventos da sessão (via auditedRead para FR50 compliance)
  const { data: events, error: eventsError } = await auditedRead(
    { targetKind: "session_metrics", targetId: sessionId, action: "recent_events.fetch", actorId: userId, clubId },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      serviceRole
        .from("match_events")
        .select("id, action, zone, occurred_at, player_id")
        .eq("session_id", sessionId)
        .eq("club_id", clubId)
        .eq("is_deleted", false)
        .order("occurred_at", { ascending: false })
        .limit(limit)
  );

  if (eventsError) {
    return err({ code: "unknown", message: eventsError.message });
  }
  if (!events || events.length === 0) return ok([]);

  // Step 2: jersey numbers de match_lineups (sem tipos TS — usar cast as any)
  const playerIds = [...new Set(events.map((e) => e.player_id))];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineupRows } = await (serviceRole.from as any)("match_lineups")
    .select("player_id, shirt_num, players(jersey_num)")
    .eq("session_id", sessionId)
    .in("player_id", playerIds);

  type LineupRow = {
    player_id: string;
    shirt_num: number | null;
    players: { jersey_num: number } | null;
  };

  const jerseyMap = new Map<string, number>();
  if (!lineupRows) {
    // Se query lineups falhou silenciosamente, fallback 0 é aceitável
    // Mas log de aviso para debugging
    const sid = sessionId ?? "unknown";
    console.warn(`[getRecentMatchEvents] No lineups found for session ${sid}`);
  }
  for (const l of (lineupRows ?? []) as LineupRow[]) {
    jerseyMap.set(l.player_id, l.shirt_num ?? l.players?.jersey_num ?? 0);
  }

  const result: RecentEventEntry[] = events.map((e) => ({
    id: e.id,
    action: e.action as MatchAction,
    zone: e.zone as (typeof MATCH_ZONES)[number],
    jersey_number: e.player_id ? jerseyMap.get(e.player_id) ?? 0 : 0,
    occurred_at: e.occurred_at,
  }));

  return ok(result);
}

/**
 * getMatchEventsForSession — Lista completa de eventos não apagados de uma sessão.
 *
 * Two-step query: match_events + match_lineups para nomes/jerseys.
 * Ordenado por occurred_at ASC (lista de revisão cronológica).
 */
export async function getMatchEventsForSession(
  sessionId: string
): Promise<Result<SessionEventEntry[], AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId, userId } = authResult.data;

  if (!userId) {
    return err({ code: "unauthorized", message: "ID de utilizador inválido." });
  }

  const serviceRole = getServiceRoleClient();

  // Step 1: todos os eventos da sessão (auditedRead para FR50)
  const { data: events, error: eventsError } = await auditedRead(
    { targetKind: "session_metrics", targetId: sessionId, action: "session_events.fetch", actorId: userId, clubId },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      serviceRole
        .from("match_events")
        .select("id, action, zone, occurred_at, player_id, captured_via")
        .eq("session_id", sessionId)
        .eq("club_id", clubId)
        .eq("is_deleted", false)
        .order("occurred_at", { ascending: true })
  );

  if (eventsError) {
    return err({ code: "unknown", message: eventsError.message });
  }
  if (!events || events.length === 0) return ok([]);

  // Step 2: nomes e jerseys via match_lineups
  const playerIds = [...new Set(events.map((e) => e.player_id).filter(Boolean))];

  type LineupRow = {
    player_id: string;
    shirt_num: number | null;
    players: { name: string; jersey_num: number } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineupRows } = await (serviceRole.from as any)("match_lineups")
    .select("player_id, shirt_num, players(name, jersey_num)")
    .eq("session_id", sessionId)
    .in("player_id", playerIds);

  const nameMap = new Map<string, string>();
  const jerseyMap = new Map<string, number | null>();
  for (const l of (lineupRows ?? []) as LineupRow[]) {
    nameMap.set(l.player_id, l.players?.name ?? "");
    jerseyMap.set(l.player_id, l.shirt_num ?? l.players?.jersey_num ?? null);
  }

  const result: SessionEventEntry[] = events.map((e) => ({
    id: e.id,
    action: e.action as (typeof MATCH_ACTIONS)[number],
    zone: e.zone as (typeof MATCH_ZONES)[number],
    player_id: e.player_id ?? null,
    player_name: e.player_id ? (nameMap.get(e.player_id) ?? null) : null,
    jersey_number: e.player_id ? (jerseyMap.get(e.player_id) ?? null) : null,
    occurred_at: e.occurred_at,
    captured_via: (e.captured_via ?? "online") as "online" | "offline-drain",
  }));

  return ok(result);
}

/**
 * updateMatchEvent — Editar action ou zone de um evento dentro da janela configurável.
 *
 * Enforça window check server-side. Audit log event.edited com before/after.
 */
export async function updateMatchEvent(
  eventId: string,
  update: unknown
): Promise<Result<void, AppError>> {
  const validated = MatchEventUpdateSchema.safeParse(update);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados inválidos",
    });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: existing } = await auditedRead(
    { targetKind: "match_event", targetId: eventId, action: "match_event.edit_check", actorId: userId, clubId },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      serviceRole
        .from("match_events")
        .select("id, action, zone, is_deleted, session_id")
        .eq("id", eventId)
        .eq("club_id", clubId)
        .maybeSingle()
  );

  if (!existing || existing.is_deleted === true) {
    return err({ code: "not_found", message: "Evento não encontrado." });
  }

  const { data: session } = await serviceRole
    .from("sessions")
    .select("scheduled_at, duration_min")
    .eq("id", existing.session_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) {
    return err({ code: "not_found", message: "Sessão não encontrada." });
  }

  const windowHours = await getEventEditWindowHours(clubId);
  if (!isEditWindowOpen(session.scheduled_at, session.duration_min ?? 90, windowHours)) {
    return err({
      code: "forbidden",
      message: "Janela de edição encerrada. Não é possível editar este evento.",
    });
  }

  const updateData = {
    ...(validated.data.action !== undefined && { action: validated.data.action }),
    ...(validated.data.zone !== undefined && { zone: validated.data.zone }),
  };

  const { error: updateError } = await serviceRole
    .from("match_events")
    .update(updateData)
    .eq("id", eventId)
    .eq("club_id", clubId);

  if (updateError) {
    return err({
      code: "unknown",
      message: `Erro ao editar evento: ${updateError.message || "erro desconhecido"}`,
    });
  }

  void logAccess("event.edited", "match_event", eventId, {
    before: { action: existing.action, zone: existing.zone },
    after: {
      action: validated.data.action ?? existing.action,
      zone: validated.data.zone ?? existing.zone,
    },
  });

  return ok(undefined);
}
