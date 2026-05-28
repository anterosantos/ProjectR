"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { after } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import type { Season } from "@/lib/schemas/seasons";

export type MonthlyLoad = {
  month: string;
  load: number;
};

export type PlayerLoadData = {
  playerId: string;
  playerName: string;
  position: string;
  ageGroup: string;
  currentSeasonLoad: number;
  currentSeasonSessions: number;
  currentSeasonMonthly: MonthlyLoad[];
  totalLoad: number;
  totalSessions: number;
  allTimeMonthly: MonthlyLoad[];
};

export type LoadFilters = {
  position: "all" | "GR" | "DEF" | "MED" | "AVA";
  sortBy: "load" | "sessions" | "alphabetic";
};

const STAFF_ROLES = ["coach", "analyst"] as const;

async function requireStaffRole(): Promise<
  Result<{ userId: string; clubId: string; role: string }, AppError>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "unauthorized", message: "Não autorizado" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !(STAFF_ROLES as readonly string[]).includes(profile.role ?? "")
  ) {
    return err({ code: "unauthorized", message: "Não autorizado" });
  }

  if (!profile.club_id) {
    return err({ code: "unauthorized", message: "Não autorizado" });
  }

  return ok({
    userId: user.id,
    clubId: profile.club_id,
    role: profile.role as string,
  });
}

type MetricRow = {
  player_id: string;
  srpe_load: number;
  sessions: { season_id: string; scheduled_at: string };
};

function groupByMonth(rows: MetricRow[]): MonthlyLoad[] {
  const monthMap = new Map<string, number>();
  for (const row of rows) {
    const match = row.sessions.scheduled_at.match(/^\d{4}-\d{2}/);
    const month = match?.[0];
    if (!month) continue;
    monthMap.set(month, (monthMap.get(month) ?? 0) + row.srpe_load);
  }
  return Array.from(monthMap.entries())
    .map(([month, load]) => ({ month, load }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getCumulativeLoadData(): Promise<
  Result<{ players: PlayerLoadData[]; currentSeason: Season | null }, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const supabase = await createServerClient();

  // Fetch current season
  const seasonResult = await getCurrentSeason();
  const currentSeason = seasonResult.ok ? seasonResult.data : null;

  // Query batch 1 — active players
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, full_name, age_group")
    .eq("club_id", clubId)
    .is("archived_at", null)
    .order("full_name", { ascending: true });

  if (playersError) {
    return err({
      code: "db_error",
      message: playersError.message ?? "Erro ao carregar jogadores",
    });
  }

  const playersArr = playersData ?? [];

  // Query primary positions for all active players
  const playerIds = playersArr.map((p) => p.id);
  const positionMap = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: positionsData } = await supabase
      .from("positions")
      .select("player_id, position")
      .in("player_id", playerIds)
      .eq("is_primary", true);
    for (const pos of positionsData ?? []) {
      if (pos && pos.player_id && pos.position) {
        positionMap.set(pos.player_id, pos.position);
      }
    }
  }

  // Fire-and-forget audit log (AC #5)
  after(async () => {
    try {
      const serviceRole = getServiceRoleClient();
      await serviceRole.from("audit_logs").insert({
        club_id: clubId,
        actor_id: userId,
        action: "load.viewed",
        target_kind: "session_metrics",
        target_id: clubId,
      });
    } catch { /* silent */ }
  });

  if (playersArr.length === 0) {
    return ok({ players: [], currentSeason });
  }

  // Query batch 2 — session_metrics with JOIN to sessions (season_id + scheduled_at)
  // eslint-disable-next-line custom/no-direct-health-data-read -- session_metrics is not health data; it is sRPE load data
  const { data: metricsData, error: metricsError } = await supabase
    .from("session_metrics")
    .select("player_id, srpe_load, sessions!inner(season_id, scheduled_at)")
    .eq("club_id", clubId);

  if (metricsError) {
    return err({
      code: "db_error",
      message: metricsError.message ?? "Erro ao carregar métricas de sessão",
    });
  }

  const metrics = (metricsData ?? []).filter((m) => {
    return (
      m &&
      typeof m.player_id === "string" &&
      typeof m.srpe_load === "number" &&
      m.srpe_load > 0 &&
      m.sessions &&
      typeof m.sessions.season_id === "string" &&
      typeof m.sessions.scheduled_at === "string"
    );
  }) as MetricRow[];

  // Group metrics by player_id
  const metricsByPlayer = new Map<string, MetricRow[]>();
  for (const m of metrics) {
    const arr = metricsByPlayer.get(m.player_id) ?? [];
    arr.push(m);
    metricsByPlayer.set(m.player_id, arr);
  }

  const players: PlayerLoadData[] = playersArr.map((p) => {
    const allMetrics = metricsByPlayer.get(p.id) ?? [];

    const currentMetrics = currentSeason?.id
      ? allMetrics.filter((m) => m.sessions.season_id === currentSeason.id)
      : [];

    return {
      playerId: p.id,
      playerName: p.full_name?.trim() || "—",
      position: positionMap.get(p.id) ?? "—",
      ageGroup: p.age_group ?? "—",
      currentSeasonLoad: currentMetrics.reduce((s, m) => s + m.srpe_load, 0),
      currentSeasonSessions: currentMetrics.length,
      currentSeasonMonthly: groupByMonth(currentMetrics),
      totalLoad: allMetrics.reduce((s, m) => s + m.srpe_load, 0),
      totalSessions: allMetrics.length,
      allTimeMonthly: groupByMonth(allMetrics),
    };
  });

  return ok({ players, currentSeason });
}
