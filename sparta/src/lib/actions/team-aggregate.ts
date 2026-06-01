"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { requireStaffRole } from "@/lib/actions/auth";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export type WeeklyFatiguePoint = {
  weekLabel: string;
  weekStart: string;
  avgFatigue: number;
  sampleSize: number;
};

export type WeeklyAttendancePoint = {
  weekLabel: string;
  weekStart: string;
  attendanceRate: number;
  attended: number;
  total: number;
};

export type TopPlayerItem = {
  playerId: string;
  playerName: string;
  position: string;
  ageGroup: string;
  value: number;
};

export type MatchEventsPoint = {
  sessionId: string;
  sessionDate: string;
  sessionType: "jogo" | "amigavel";
  eventCount: number;
};

export type TeamAggregateData = {
  weeklyFatigue: WeeklyFatiguePoint[];
  weeklyAttendance: WeeklyAttendancePoint[];
  topLoaded: TopPlayerItem[];
  topFatigued: TopPlayerItem[];
  eventsPerMatch: MatchEventsPoint[];
  currentSeason: { id: string; name: string } | null;
  totalActivePlayers: number;
  userRole: "coach" | "analyst";
};

type FatigueRow = {
  player_id: string | null;
  submitted_at: string | null;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};

export async function getTeamAggregateData(): Promise<
  Result<TeamAggregateData, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId, role } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const seasonResult = await getCurrentSeason();
  const currentSeason = seasonResult.ok ? seasonResult.data : null;

  const now = new Date();
  const since28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const weekWindows = Array.from({ length: 4 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end, label: `Sem ${4 - i}` };
  }).reverse();

  const { data: playersData, error: playersError } = await serviceRole
    .from("players")
    .select("id, full_name, age_group")
    .eq("club_id", clubId)
    .is("archived_at", null);

  if (playersError) {
    return err({
      code: "db_error",
      message: playersError.message ?? "Erro ao carregar jogadores",
    });
  }

  const playersArr = playersData ?? [];
  const playerIds = playersArr.map((p) => p.id);

  const positionMap = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: posData } = await serviceRole
      .from("positions")
      .select("player_id, position")
      .in("player_id", playerIds)
      .eq("is_primary", true);
    for (const pos of posData ?? []) {
      if (pos?.player_id && pos.position) {
        positionMap.set(pos.player_id, pos.position);
      }
    }
  }

  if (playerIds.length === 0) {
    return ok({
      weeklyFatigue: weekWindows.map((w) => ({
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        avgFatigue: 0,
        sampleSize: 0,
      })),
      weeklyAttendance: weekWindows.map((w) => ({
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        attendanceRate: 0,
        attended: 0,
        total: 0,
      })),
      topLoaded: [],
      topFatigued: [],
      eventsPerMatch: [],
      currentSeason: currentSeason
        ? { id: currentSeason.id, name: currentSeason.name ?? "" }
        : null,
      totalActivePlayers: 0,
      userRole: role as "coach" | "analyst",
    });
  }

  const [fatigueResult, attendanceResult, metricsResult, eventsResult] =
    await Promise.allSettled([
      // fatigue_responses — dados de saúde, obrigatório auditedRead (FR50)
      auditedRead<FatigueRow[]>(
        {
          action: "team_aggregate.viewed",
          targetKind: "club",
          targetId: clubId,
          actorId: userId,
          clubId,
        },
        async () => {
          // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
          const { data, error } = await serviceRole
            .from("fatigue_responses")
            .select(
              "player_id, submitted_at, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood"
            )
            .eq("club_id", clubId)
            .in("player_id", playerIds)
            .gte("submitted_at", since28.toISOString())
            .order("submitted_at", { ascending: true });
          if (error) throw error;
          return (data ?? []) as FatigueRow[];
        }
      ),
      // attendances + sessions — não é dado de saúde
      serviceRole
        .from("attendances")
        .select("player_id, status, session_id, sessions!inner(date, type)")
        .eq("club_id", clubId)
        .in("player_id", playerIds)
        .gte("sessions.date", since28.toISOString().slice(0, 10)),
      // session_metrics por época (Top-3 carregados) — sRPE load data, not health data
      currentSeason?.id
        ? // eslint-disable-next-line custom/no-direct-health-data-read -- session_metrics is sRPE load data, not personal health data
          serviceRole
            .from("session_metrics")
            .select("player_id, srpe_load, sessions!inner(season_id)")
            .eq("club_id", clubId)
            .in("player_id", playerIds)
            .eq("sessions.season_id", currentSeason.id)
        : Promise.resolve({ data: [] as Array<{ player_id: string; srpe_load: number }>, error: null }),
      // match_events últimos 10 jogos/amigáveis — performance event data, not health data
      // eslint-disable-next-line custom/no-direct-health-data-read -- match_events is performance data, not personal health data
      serviceRole
        .from("match_events")
        .select("session_id, sessions!inner(date, type)")
        .eq("club_id", clubId)
        .eq("is_deleted", false)
        .in("sessions.type", ["jogo", "amigavel"])
        .order("sessions.date", { ascending: false })
        .limit(10),
    ]);

  // Guard: se auditedRead() foi rejeitado, não continuar
  if (fatigueResult.status === "rejected") {
    return err({ code: "db_error", message: "Erro ao carregar dados de fadiga" });
  }

  // Processar fadiga semanal
  const fatigueRows: FatigueRow[] =
    fatigueResult.status === "fulfilled" ? fatigueResult.value : [];
  const weeklyFatigue = weekWindows.map((w) => {
    const bucket = fatigueRows.filter((r) => {
      const t = new Date(r.submitted_at ?? "").getTime();
      return t >= w.start.getTime() && t < w.end.getTime();
    });
    const playerSet = new Set(bucket.map((r) => r.player_id));
    if (bucket.length === 0) {
      return {
        weekLabel: w.label,
        weekStart: w.start.toISOString(),
        avgFatigue: 0,
        sampleSize: 0,
      };
    }
    const allDims = bucket.flatMap((r) =>
      [r.dim_energy, r.dim_focus, r.dim_sleep, r.dim_soreness, r.dim_mood].filter(
        (v): v is number => v !== null && v !== undefined
      )
    );
    const avg =
      allDims.length > 0 ? allDims.reduce((s, v) => s + v, 0) / allDims.length : 0;
    return {
      weekLabel: w.label,
      weekStart: w.start.toISOString(),
      avgFatigue: Math.round(avg * 10) / 10,
      sampleSize: playerSet.size,
    };
  });

  // Processar taxa de presença semanal
  type AttRow = {
    player_id: string;
    status: string;
    session_id: string;
    sessions: { date: string; type: string };
  };
  const attRows: AttRow[] =
    attendanceResult.status === "fulfilled" && !attendanceResult.value.error
      ? // Supabase TS SDK limitation: joined select types cannot be properly inferred at compile-time
        ((attendanceResult.value.data ?? []) as unknown as AttRow[])
      : [];
  const weeklyAttendance = weekWindows.map((w) => {
    const bucket = attRows.filter((r) => {
      const dateStr = r.sessions?.date;
      if (!dateStr) return false;
      const d = new Date(dateStr + "T00:00:00Z").getTime();
      if (Number.isNaN(d)) return false;
      return d >= w.start.getTime() && d < w.end.getTime();
    });
    const attended = bucket.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    const total = bucket.length;
    const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
    return {
      weekLabel: w.label,
      weekStart: w.start.toISOString(),
      attendanceRate: rate,
      attended,
      total,
    };
  });

  // Top-3 mais carregados (época actual)
  type MetricRow = { player_id: string; srpe_load: number };
  const metricsRows: MetricRow[] =
    metricsResult.status === "fulfilled" &&
    !("error" in metricsResult.value && metricsResult.value.error)
      ? ((("data" in metricsResult.value
          ? metricsResult.value.data
          : metricsResult.value) ?? []) as MetricRow[])
      : [];
  const loadByPlayer = new Map<string, number>();
  for (const m of metricsRows) {
    if (m?.player_id && typeof m.srpe_load === "number") {
      loadByPlayer.set(
        m.player_id,
        (loadByPlayer.get(m.player_id) ?? 0) + m.srpe_load
      );
    }
  }
  const topLoaded = Array.from(loadByPlayer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, load]) => {
      const player = playersArr.find((p) => p.id === pid);
      return {
        playerId: pid,
        playerName: player?.full_name?.trim() || "—",
        position: positionMap.get(pid) ?? "—",
        ageGroup: player?.age_group ?? "—",
        value: load,
      };
    });

  // Top-3 mais fatigados (últimas 4 sem — avg das 5 dims)
  const avgFatigueByPlayer = new Map<string, { sum: number; count: number }>();
  for (const r of fatigueRows) {
    if (!r.player_id) continue;
    const dims = [
      r.dim_energy,
      r.dim_focus,
      r.dim_sleep,
      r.dim_soreness,
      r.dim_mood,
    ].filter((v): v is number => v !== null && v !== undefined);
    if (dims.length === 0) continue;
    const avg = dims.reduce((s, v) => s + v, 0) / dims.length;
    const existing = avgFatigueByPlayer.get(r.player_id) ?? {
      sum: 0,
      count: 0,
    };
    avgFatigueByPlayer.set(r.player_id, {
      sum: existing.sum + avg,
      count: existing.count + 1,
    });
  }
  const topFatigued = Array.from(avgFatigueByPlayer.entries())
    .map(([pid, { sum, count }]) => ({
      playerId: pid,
      playerName:
        playersArr.find((p) => p.id === pid)?.full_name?.trim() || "—",
      position: positionMap.get(pid) ?? "—",
      ageGroup: playersArr.find((p) => p.id === pid)?.age_group ?? "—",
      value: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // Eventos por jogo (últimos 10)
  type EventRow = {
    session_id: string;
    sessions: { date: string; type: string };
  };
  const eventRows: EventRow[] =
    eventsResult.status === "fulfilled" && !eventsResult.value.error
      ? // Supabase TS SDK limitation: joined select types cannot be properly inferred at compile-time
        ((eventsResult.value.data ?? []) as unknown as EventRow[])
      : [];
  const eventsBySession = new Map<
    string,
    { date: string; type: string; count: number }
  >();
  for (const e of eventRows) {
    if (!e.session_id || !e.sessions?.date) continue;
    const existing = eventsBySession.get(e.session_id);
    if (existing) {
      existing.count++;
    } else {
      eventsBySession.set(e.session_id, {
        date: e.sessions.date,
        type: e.sessions.type,
        count: 1,
      });
    }
  }
  const eventsPerMatch = Array.from(eventsBySession.entries())
    .map(([sid, { date, type, count }]) => ({
      sessionId: sid,
      sessionDate: date,
      sessionType: type as "jogo" | "amigavel",
      eventCount: count,
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .slice(-10);

  return ok({
    weeklyFatigue,
    weeklyAttendance,
    topLoaded,
    topFatigued,
    eventsPerMatch,
    currentSeason: currentSeason
      ? { id: currentSeason.id, name: currentSeason.name ?? "" }
      : null,
    totalActivePlayers: playersArr.length,
    userRole: role as "coach" | "analyst",
  });
}
