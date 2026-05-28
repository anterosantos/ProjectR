"use server";

import { after } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logTelemetry } from "@/lib/actions/telemetry";
import { err, ok } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import {
  DECISION_KINDS,
  type DataDecision,
  type DecisionKind,
  type SaveDecisionInput,
  type MonthlyKpiRow,
} from "@/lib/types/decisions";

// ── Auth guard ────────────────────────────────────────────────────────────────

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

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * saveDataDrivenDecision — Insere uma nova decisão data-driven.
 *
 * Fire-and-forget (after()): audit_logs + logTelemetry
 */
export async function saveDataDrivenDecision(
  input: SaveDecisionInput
): Promise<Result<{ id: string }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  if (input.note && input.note.trim().length > 500) {
    return err({ code: "validation_error", message: "Nota demasiado longa (máx. 500 caracteres)." });
  }

  if (!DECISION_KINDS.includes(input.decisionKind)) {
    return err({ code: "validation_error", message: "Tipo de decisão inválido." });
  }

  // Service role bypasses RLS — application-level security already enforced:
  //   1. requireStaffRole() verified caller is coach/analyst of clubId
  //   2. Explicit club_id + actor_id ensure correct multi-tenant isolation
  const serviceRole = getServiceRoleClient();

  const { data, error } = await serviceRole
    .from("data_decisions")
    .insert({
      club_id: clubId,
      player_id: input.playerId,
      session_id: input.sessionId ?? null,
      actor_id: userId,
      decision_kind: input.decisionKind,
      note: input.note ?? null,
      was_data_driven: input.wasDataDriven ?? true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return err({ code: "db_error", message: "Erro ao guardar decisão." });
  }

  const decisionId = data.id;

  after(async () => {
    try {
      const serviceRole = getServiceRoleClient();
      await serviceRole.from("audit_logs").insert({
        club_id: clubId,
        actor_id: userId,
        action: "decision.marked",
        target_kind: "data_decisions",
        target_id: input.playerId,
      });
    } catch {
      // silent — fire-and-forget audit
    }
  });

  void logTelemetry("decision_marked", {
    playerId: input.playerId,
    decisionKind: input.decisionKind,
  });

  return ok({ id: decisionId });
}

/**
 * getDataDrivenDecisions — Retorna as últimas 3 decisões para o jogador.
 *
 * Retorna também currentUserId para que o componente possa determinar
 * quais decisões são editáveis (actor_id === currentUserId && dentro de 24h).
 * Decisões de staff não são dados de saúde — não obrigam auditedRead (FR50).
 */
export async function getDataDrivenDecisions(
  playerId: string
): Promise<Result<{ decisions: DataDecision[]; currentUserId: string }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  // Service role: requireStaffRole() already verified caller is staff of clubId.
  const serviceRole = getServiceRoleClient();

  const { data, error } = await serviceRole
    .from("data_decisions")
    .select("id, decision_kind, note, was_data_driven, created_at, actor_id")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    return err({ code: "db_error", message: "Erro ao carregar decisões." });
  }

  const decisions: DataDecision[] = (data ?? []).map((row) => ({
    id: row.id,
    decisionKind: row.decision_kind as DecisionKind,
    note: row.note,
    wasDataDriven: row.was_data_driven,
    createdAt: row.created_at,
    actorId: row.actor_id ?? "",
  }));

  return ok({ decisions, currentUserId: userId });
}

/**
 * updateDataDrivenDecision — Actualiza nota de uma decisão dentro da janela de 24h.
 *
 * Verifica actor_id + janela de tempo via query — RLS update policy reforça no DB.
 */
export async function updateDataDrivenDecision(
  id: string,
  note: string
): Promise<Result<void, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId } = authResult.data;

  if (note.length > 500) {
    return err({ code: "validation_error", message: "Nota demasiado longa (máx. 500 caracteres)." });
  }

  // Service role: requireStaffRole() already verified caller is staff.
  // actor_id + 24h window enforced at application level (same as RLS update policy).
  const serviceRole = getServiceRoleClient();
  const windowStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data, error } = await serviceRole
    .from("data_decisions")
    .update({ note })
    .eq("id", id)
    .eq("actor_id", userId)
    .gte("created_at", windowStart)
    .select("id");

  if (error) {
    return err({ code: "db_error", message: error.message });
  }

  if (!data || data.length === 0) {
    return err({
      code: "forbidden",
      message: "Edição não permitida. Janela de 24h expirada ou decisão de outro utilizador.",
    });
  }

  return ok(undefined);
}

/**
 * getDecisionKpiData — Contagens de decisões por mês e tipo para o KPI dashboard.
 *
 * Retorna os últimos 12 meses com agregação TypeScript (dados são pequenos, <500 rows/ano).
 */
export async function getDecisionKpiData(): Promise<
  Result<MonthlyKpiRow[], AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  // Service role: requireStaffRole() already verified caller is staff of clubId.
  const serviceRole = getServiceRoleClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data, error } = await serviceRole
    .from("data_decisions")
    .select("decision_kind, created_at")
    .eq("club_id", clubId)
    .gte("created_at", twelveMonthsAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return err({ code: "db_error", message: "Erro ao carregar KPIs." });
  }

  // Aggregate TypeScript-side: group by YYYY-MM then by decision_kind
  const monthMap = new Map<string, MonthlyKpiRow>();

  for (const row of data ?? []) {
    const month = row.created_at.slice(0, 7); // "YYYY-MM"
    const existing = monthMap.get(month);
    const kind = row.decision_kind as DecisionKind;

    if (existing) {
      existing.total += 1;
      existing.byKind[kind] = (existing.byKind[kind] ?? 0) + 1;
    } else {
      monthMap.set(month, {
        month,
        total: 1,
        byKind: { [kind]: 1 },
      });
    }
  }

  // Sort descending by month
  const rows = Array.from(monthMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  return ok(rows);
}
