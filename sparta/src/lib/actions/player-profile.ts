"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole } from "@/lib/actions/auth";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";
import type { PlayerMetric } from "@/lib/actions/metrics";
import type { DataDecision, DecisionKind } from "@/lib/types/decisions";
import { ACWR_THRESHOLDS, type AgeGroup } from "@/lib/readiness/thresholds";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerProfileHeader {
  id: string;
  full_name: string;
  age_group: string;
  jersey_num: number;
  photo_path: string | null;
  primary_position: string | null;
  alt_positions: string[];
}

export interface FatigueTabData {
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  playerName: string;
}

export interface AcwrDataPoint {
  date: string;
  acwr: number | null;
  srpe_load: number;
  session_id: string;
}

export interface LoadAcwrTabData {
  dataPoints: AcwrDataPoint[];
  ageGroup: string;
  acwrBandLo: number;
  acwrBandHi: number;
}

export interface AttendanceSession {
  session_id: string;
  date: string;
  session_type: string;
  status: string;
  note: string | null;
}

export interface AttendanceMonth {
  month: string;
  sessions: AttendanceSession[];
}

export interface AttendanceTabData {
  months: AttendanceMonth[];
  totalPresent: number;
  totalSessions: number;
}

export interface MatchStatsRow {
  session_id: string;
  date: string;
  session_type: string;
  minutes_played: number;
  losses: number;
  recoveries: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  defensive_pressures: number;
  offensive_actions: number;
  defensive_actions: number;
  zones: Record<string, number>;
}

export interface StatisticsTabData {
  rows: MatchStatsRow[];
  totals: {
    minutes: number;
    losses: number;
    recoveries: number;
    shots: number;
    shots_on_target: number;
    passes: number;
    defensive_pressures: number;
    offensive_actions: number;
    defensive_actions: number;
  };
  zoneHeatmap: Record<string, number>;
}

export interface DataDecisionsTabData {
  decisions: DataDecision[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapActionToColumn(action: string): keyof Omit<MatchStatsRow, "session_id" | "date" | "session_type" | "minutes_played" | "zones"> | null {
  const map: Record<string, keyof Omit<MatchStatsRow, "session_id" | "date" | "session_type" | "minutes_played" | "zones">> = {
    ball_loss: "losses",
    ball_recovery: "recoveries",
    shot_total: "shots",
    shot_on_target: "shots_on_target",
    pass_completed: "passes",
    def_pressure: "defensive_pressures",
    off_action_success: "offensive_actions",
    def_action_success: "defensive_actions",
  };
  return map[action] ?? null;
}

// ── Server Actions ─────────────────────────────────────────────────────────────

/**
 * getPlayerProfileHeader — Player info for the header widget.
 *
 * Returns name, age_group, jersey_num, photo_path, and positions.
 * Does NOT require auditedRead — this is not health data.
 */
export async function getPlayerProfileHeader(
  playerId: string
): Promise<Result<PlayerProfileHeader, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player, error } = await serviceRole
    .from("players")
    .select("id, full_name, age_group, jersey_num, photo_path")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error || !player) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }

  const { data: positions } = await serviceRole
    .from("positions")
    .select("position, is_primary, sort_order")
    .eq("player_id", playerId)
    .order("sort_order", { ascending: true });

  const sortedPositions = [...(positions ?? [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return 0;
  });
  const primary = sortedPositions.find((p) => p.is_primary)?.position ?? null;
  const alts = sortedPositions.filter((p) => !p.is_primary).map((p) => p.position);

  return ok({
    id: player.id,
    full_name: player.full_name ?? "",
    age_group: player.age_group ?? "senior",
    jersey_num: player.jersey_num ?? 0,
    photo_path: player.photo_path ?? null,
    primary_position: primary,
    alt_positions: alts,
  });
}

/**
 * getPlayerFatigueTabData — All fatigue responses for the player.
 *
 * When seasonId is provided, filters to the season date range.
 * Otherwise returns all responses (cumulative view).
 * Uses auditedRead() — health data (FR50).
 */
export async function getPlayerFatigueTabData(
  playerId: string,
  seasonId?: string | null
): Promise<Result<FatigueTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, full_name, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  let seasonDateFilter: { start: string; end: string } | null = null;
  if (seasonId) {
    const { data: season } = await serviceRole
      .from("seasons")
      .select("start_date, end_date")
      .eq("id", seasonId)
      .eq("club_id", clubId)
      .maybeSingle();
    if (season) {
      seasonDateFilter = { start: season.start_date, end: season.end_date };
    }
  }

  let responses: FatigueResponse[] = [];
  try {
    responses = await auditedRead<FatigueResponse[]>(
      {
        action: "fatigue_profile.viewed",
        targetKind: "fatigue_responses",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead()
        let query = serviceRole
          .from("fatigue_responses")
          .select(
            "id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via"
          )
          .eq("player_id", playerId)
          .eq("club_id", clubId)
          .order("submitted_at", { ascending: false });

        if (seasonDateFilter) {
          query = query
            .gte("submitted_at", `${seasonDateFilter.start}T00:00:00Z`)
            .lte("submitted_at", `${seasonDateFilter.end}T23:59:59Z`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as FatigueResponse[];
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar respostas de fadiga" });
  }

  const sessionIds = [...new Set(responses.map((r) => r.session_id))];
  let sessionsMap: Record<string, SessionInfo> = {};

  if (sessionIds.length > 0) {
    const { data: sessions } = await serviceRole
      .from("sessions")
      .select("id, type, scheduled_at")
      .in("id", sessionIds)
      .eq("club_id", clubId);

    sessionsMap = (sessions ?? []).reduce<Record<string, SessionInfo>>((acc, s) => {
      acc[s.id] = { id: s.id, type: s.type, scheduled_at: s.scheduled_at };
      return acc;
    }, {});
  }

  return ok({
    responses,
    sessions: sessionsMap,
    playerName: player.full_name ?? "—",
  });
}

/**
 * getPlayerLoadAcwrTabData — ACWR + sRPE history from readiness_snapshots + session_metrics.
 *
 * Returns one data point per session with ACWR ratio and sRPE load.
 * Uses auditedRead() — health data (FR50).
 */
export async function getPlayerLoadAcwrTabData(
  playerId: string,
  seasonId?: string | null
): Promise<Result<LoadAcwrTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, age_group, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const ageGroup = (player.age_group ?? "senior") as string;

  let seasonDateFilter: { start: string; end: string } | null = null;
  if (seasonId) {
    const { data: season } = await serviceRole
      .from("seasons")
      .select("start_date, end_date")
      .eq("id", seasonId)
      .eq("club_id", clubId)
      .maybeSingle();
    if (season) {
      seasonDateFilter = { start: season.start_date, end: season.end_date };
    }
  }

  // Fetch ACWR from readiness_snapshots + sRPE from session_metrics via auditedRead
  type SnapshotRow = { session_id: string; acwr: number | null; computed_at: string };
  type MetricRow = { session_id: string; srpe_load: number; computed_at: string };

  let snapshots: SnapshotRow[] = [];
  let metrics: MetricRow[] = [];

  const [snapshotsSettled, metricsSettled] = await Promise.allSettled([
    auditedRead<SnapshotRow[]>(
      {
        action: "acwr_profile.viewed",
        targetKind: "readiness_snapshots",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead()
        let query = serviceRole
          .from("readiness_snapshots")
          .select("session_id, acwr, computed_at")
          .eq("player_id", playerId)
          .eq("club_id", clubId)
          .order("computed_at", { ascending: true });
        if (seasonDateFilter) {
          query = query
            .gte("computed_at", `${seasonDateFilter.start}T00:00:00Z`)
            .lte("computed_at", `${seasonDateFilter.end}T23:59:59Z`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as SnapshotRow[];
      }
    ),
    auditedRead<MetricRow[]>(
      {
        action: "srpe_profile.viewed",
        targetKind: "session_metrics",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead()
        let query = serviceRole
          .from("session_metrics")
          .select("session_id, srpe_load, computed_at")
          .eq("player_id", playerId)
          .eq("club_id", clubId)
          .order("computed_at", { ascending: true });
        if (seasonDateFilter) {
          query = query
            .gte("computed_at", `${seasonDateFilter.start}T00:00:00Z`)
            .lte("computed_at", `${seasonDateFilter.end}T23:59:59Z`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as MetricRow[];
      }
    ),
  ]);

  snapshots = snapshotsSettled.status === "fulfilled" ? snapshotsSettled.value : [];
  metrics = metricsSettled.status === "fulfilled" ? metricsSettled.value : [];

  // Build srpe map: session_id → srpe_load
  const srpeMap = new Map<string, number>();
  for (const m of metrics) {
    srpeMap.set(m.session_id, m.srpe_load);
  }

  // Enrich snapshots with session dates and srpe
  const sessionIds = [...new Set([...snapshots.map((s) => s.session_id), ...metrics.map((m) => m.session_id)])];

  const sessionDateMap = new Map<string, string>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await serviceRole
      .from("sessions")
      .select("id, scheduled_at")
      .in("id", sessionIds)
      .eq("club_id", clubId);
    for (const s of sessions ?? []) {
      sessionDateMap.set(s.id, s.scheduled_at);
    }
  }

  // Merge: prefer snapshot data for ACWR, use session date for X-axis
  const seen = new Set<string>();
  const dataPoints: AcwrDataPoint[] = [];

  for (const snap of snapshots) {
    if (seen.has(snap.session_id)) continue;
    seen.add(snap.session_id);
    const date = sessionDateMap.get(snap.session_id) ?? snap.computed_at;
    dataPoints.push({
      date: date.slice(0, 10),
      acwr: snap.acwr !== null ? Number(snap.acwr) : null,
      srpe_load: srpeMap.get(snap.session_id) ?? 0,
      session_id: snap.session_id,
    });
  }

  // Include sessions with metrics but no snapshots (e.g., pre-snapshot sessions)
  for (const m of metrics) {
    if (seen.has(m.session_id)) continue;
    seen.add(m.session_id);
    const date = sessionDateMap.get(m.session_id) ?? m.computed_at;
    dataPoints.push({
      date: date.slice(0, 10),
      acwr: null,
      srpe_load: m.srpe_load,
      session_id: m.session_id,
    });
  }

  dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  const threshold = ACWR_THRESHOLDS[ageGroup as AgeGroup] ?? { lo: 0.8, hi: 1.5 };

  return ok({
    dataPoints,
    ageGroup,
    acwrBandLo: threshold.lo,
    acwrBandHi: threshold.hi,
  });
}

/**
 * getPlayerPhysicalMetricsTabData — Weight + height time-series.
 *
 * Reuses player_metrics table. Not health data per se, no auditedRead required.
 */
export async function getPlayerPhysicalMetricsTabData(
  playerId: string,
  seasonId?: string | null
): Promise<Result<PlayerMetric[], AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  let seasonDateFilter: { start: string; end: string } | null = null;
  if (seasonId) {
    const { data: season } = await serviceRole
      .from("seasons")
      .select("start_date, end_date")
      .eq("id", seasonId)
      .eq("club_id", clubId)
      .maybeSingle();
    if (season) {
      seasonDateFilter = { start: season.start_date, end: season.end_date };
    }
  }

  let metrics: PlayerMetric[] = [];
  try {
    metrics = await auditedRead<PlayerMetric[]>(
      {
        action: "physical_metrics_profile.viewed",
        targetKind: "player_metrics",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead()
        let query = serviceRole
          .from("player_metrics")
          .select("id, player_id, club_id, weight_kg, height_cm, recorded_at, created_by, created_at")
          .eq("player_id", playerId)
          .eq("club_id", clubId)
          .order("recorded_at", { ascending: true });

        if (seasonDateFilter) {
          query = query
            .gte("recorded_at", `${seasonDateFilter.start}T00:00:00Z`)
            .lte("recorded_at", `${seasonDateFilter.end}T23:59:59Z`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as PlayerMetric[];
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar métricas físicas" });
  }

  return ok(metrics);
}

/**
 * getPlayerAttendanceTabData — Attendance records grouped by month.
 *
 * Returns attendance for all sessions, merged with session metadata.
 */
export async function getPlayerAttendanceTabData(
  playerId: string,
  seasonId?: string | null
): Promise<Result<AttendanceTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Build season filter for sessions
  let seasonDateFilter: { start: string; end: string } | null = null;
  if (seasonId) {
    const { data: season } = await serviceRole
      .from("seasons")
      .select("start_date, end_date")
      .eq("id", seasonId)
      .eq("club_id", clubId)
      .maybeSingle();
    if (season) {
      seasonDateFilter = { start: season.start_date, end: season.end_date };
    }
  }

  // Fetch only attendance records that exist explicitly for this player.
  // This avoids showing all club sessions with a default "absent" for sessions
  // the player was never enrolled in (e.g., a senior seeing U14 sessions).
  const attQuery = serviceRole
    .from("attendances")
    .select("session_id, status, note")
    .eq("player_id", playerId)
    .eq("club_id", clubId);

  const { data: attendances, error: attError } = await attQuery;

  if (attError) {
    return err({ code: "internal", message: "Erro ao carregar presenças" });
  }

  const attList = attendances ?? [];
  if (attList.length === 0) {
    return ok({ months: [], totalPresent: 0, totalSessions: 0 });
  }

  const sessionIds = attList.map((a) => a.session_id);

  // Fetch session metadata for those specific sessions
  let sessionQuery = serviceRole
    .from("sessions")
    .select("id, type, scheduled_at")
    .eq("club_id", clubId)
    .in("id", sessionIds)
    .order("scheduled_at", { ascending: false });

  if (seasonDateFilter) {
    sessionQuery = sessionQuery
      .gte("scheduled_at", `${seasonDateFilter.start}T00:00:00Z`)
      .lte("scheduled_at", `${seasonDateFilter.end}T23:59:59Z`);
  }

  const { data: sessions, error: sessionsError } = await sessionQuery;
  if (sessionsError) {
    return err({ code: "internal", message: "Erro ao carregar sessões" });
  }

  const allSessions = sessions ?? [];
  if (allSessions.length === 0) {
    return ok({ months: [], totalPresent: 0, totalSessions: 0 });
  }

  const attendanceMap = new Map<string, { status: string; note: string | null }>();
  for (const a of attList) {
    attendanceMap.set(a.session_id, { status: a.status ?? "absent", note: a.note ?? null });
  }

  // Build attendance rows only for sessions that have explicit records
  const rows: AttendanceSession[] = allSessions.map((s) => {
    const att = attendanceMap.get(s.id);
    return {
      session_id: s.id,
      date: s.scheduled_at,
      session_type: s.type ?? "training",
      status: att?.status ?? "absent",
      note: att?.note ?? null,
    };
  });

  // Group by month (YYYY-MM)
  const monthMap = new Map<string, AttendanceSession[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const arr = monthMap.get(month) ?? [];
    arr.push(row);
    monthMap.set(month, arr);
  }

  const months: AttendanceMonth[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, sessions]) => ({ month, sessions }));

  const totalPresent = rows.filter((r) => r.status === "present" || r.status === "late").length;

  return ok({
    months,
    totalPresent,
    totalSessions: rows.length,
  });
}

/**
 * getPlayerStatisticsTabData — Match events aggregated per game with per-90 stats.
 *
 * Queries match_events for all match-type sessions involving this player.
 * Uses auditedRead() — performance health data (FR50).
 */
export async function getPlayerStatisticsTabData(
  playerId: string,
  seasonId?: string | null
): Promise<Result<StatisticsTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  let seasonDateFilter: { start: string; end: string } | null = null;
  if (seasonId) {
    const { data: season } = await serviceRole
      .from("seasons")
      .select("start_date, end_date")
      .eq("id", seasonId)
      .eq("club_id", clubId)
      .maybeSingle();
    if (season) {
      seasonDateFilter = { start: season.start_date, end: season.end_date };
    }
  }

  // Fetch match events for this player via auditedRead
  type MatchEventRow = {
    session_id: string;
    action: string;
    zone: string | null;
    occurred_at: string;
  };

  let events: MatchEventRow[] = [];
  try {
    events = await auditedRead<MatchEventRow[]>(
      {
        action: "statistics_profile.viewed",
        targetKind: "match_events",
        targetId: playerId,
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead()
        const { data, error } = await serviceRole
          .from("match_events")
          .select("session_id, action, zone, occurred_at")
          .eq("player_id", playerId)
          .eq("club_id", clubId)
          .eq("is_deleted", false)
          .order("occurred_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as MatchEventRow[];
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar estatísticas" });
  }

  if (events.length === 0) {
    return ok({ rows: [], totals: { minutes: 0, losses: 0, recoveries: 0, shots: 0, shots_on_target: 0, passes: 0, defensive_pressures: 0, offensive_actions: 0, defensive_actions: 0 }, zoneHeatmap: {} });
  }

  // Fetch session info (type + date) for all unique session_ids
  const sessionIds = [...new Set(events.map((e) => e.session_id))];

  let sessionInfoQuery = serviceRole
    .from("sessions")
    .select("id, type, scheduled_at, duration_min")
    .in("id", sessionIds)
    .eq("club_id", clubId);

  if (seasonDateFilter) {
    sessionInfoQuery = sessionInfoQuery
      .gte("scheduled_at", `${seasonDateFilter.start}T00:00:00Z`)
      .lte("scheduled_at", `${seasonDateFilter.end}T23:59:59Z`);
  }

  const { data: sessionInfos } = await sessionInfoQuery;
  const sessionMap = new Map<string, { type: string; date: string; duration: number }>();
  for (const s of sessionInfos ?? []) {
    sessionMap.set(s.id, { type: s.type ?? "match", date: s.scheduled_at, duration: s.duration_min ?? 90 });
  }

  // Fetch minutes played from match_minutes_played view. Falls back to session duration
  // if the view is unavailable or returns an error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: minutesData, error: minutesError } = await (serviceRole.from as any)("match_minutes_played")
    .select("session_id, player_id, minutes_played")
    .eq("player_id", playerId)
    .in("session_id", sessionIds);

  if (minutesError) {
    // View may not exist in this environment — fall back to session duration
    console.warn("[getPlayerStatisticsTabData] match_minutes_played view unavailable:", minutesError.message);
  }

  const minutesMap = new Map<string, number>();
  for (const m of (minutesData ?? []) as { session_id: string; player_id: string; minutes_played: number }[]) {
    if (m.minutes_played != null) minutesMap.set(m.session_id, m.minutes_played);
  }

  // Aggregate events by session
  const sessionStats = new Map<string, MatchStatsRow>();

  for (const evt of events) {
    const sessionInfo = sessionMap.get(evt.session_id);
    if (!sessionInfo) continue;

    const existing = sessionStats.get(evt.session_id) ?? {
      session_id: evt.session_id,
      date: sessionInfo.date,
      session_type: sessionInfo.type,
      minutes_played: minutesMap.get(evt.session_id) ?? sessionInfo.duration,
      losses: 0,
      recoveries: 0,
      shots: 0,
      shots_on_target: 0,
      passes: 0,
      defensive_pressures: 0,
      offensive_actions: 0,
      defensive_actions: 0,
      zones: {} as Record<string, number>,
    };

    const col = mapActionToColumn(evt.action);
    if (col) {
      (existing[col] as number) += 1;
    }

    if (evt.zone) {
      const zoneCount = existing.zones[evt.zone] ?? 0;
      existing.zones[evt.zone] = zoneCount + 1;
    }

    sessionStats.set(evt.session_id, existing);
  }

  const rows = Array.from(sessionStats.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Compute totals
  const totals = {
    minutes: rows.reduce((s, r) => s + r.minutes_played, 0),
    losses: rows.reduce((s, r) => s + r.losses, 0),
    recoveries: rows.reduce((s, r) => s + r.recoveries, 0),
    shots: rows.reduce((s, r) => s + r.shots, 0),
    shots_on_target: rows.reduce((s, r) => s + r.shots_on_target, 0),
    passes: rows.reduce((s, r) => s + r.passes, 0),
    defensive_pressures: rows.reduce((s, r) => s + r.defensive_pressures, 0),
    offensive_actions: rows.reduce((s, r) => s + r.offensive_actions, 0),
    defensive_actions: rows.reduce((s, r) => s + r.defensive_actions, 0),
  };

  // Zone heatmap: aggregate all zones across all sessions
  const zoneHeatmap: Record<string, number> = {};
  for (const row of rows) {
    for (const [zone, count] of Object.entries(row.zones)) {
      const existing = zoneHeatmap[zone] ?? 0;
      zoneHeatmap[zone] = existing + count;
    }
  }

  return ok({ rows, totals, zoneHeatmap });
}

/**
 * getPlayerDataDecisionsTabData — All data-driven decisions for a player.
 *
 * Staff decisions are not health data — no auditedRead required.
 */
export async function getPlayerDataDecisionsTabData(
  playerId: string
): Promise<Result<DataDecisionsTabData, AppError>> {
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: player } = await serviceRole
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const { data, error } = await serviceRole
    .from("data_decisions")
    .select("id, decision_kind, note, was_data_driven, created_at, actor_id")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) {
    return err({ code: "internal", message: "Erro ao carregar decisões" });
  }

  const decisions: DataDecision[] = (data ?? []).map((row) => ({
    id: row.id,
    decisionKind: row.decision_kind as DecisionKind,
    note: row.note ?? null,
    wasDataDriven: row.was_data_driven ?? false,
    createdAt: row.created_at,
    actorId: row.actor_id ?? "",
  }));

  return ok({ decisions });
}
