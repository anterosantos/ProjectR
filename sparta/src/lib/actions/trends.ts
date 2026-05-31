"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export type FatigueDimension = "dim_energy" | "dim_focus" | "dim_sleep" | "dim_soreness" | "dim_mood";

export type SparklinePoint = {
  date: string; // ISO 8601 (submitted_at truncado ao dia)
  value: number; // 1–5
};

export type DimensionSparklines = {
  dim_energy: SparklinePoint[];
  dim_focus: SparklinePoint[];
  dim_sleep: SparklinePoint[];
  dim_soreness: SparklinePoint[];
  dim_mood: SparklinePoint[];
};

export type PlayerTrendData = {
  playerId: string;
  playerName: string;
  position: string; // "GR" | "DEF" | "MED" | "AVA"
  ageGroup: string; // "u14" | "u15" | "u17" | "u19" | "senior"
  sparklines: DimensionSparklines;
  delta: number | null; // mean(last7) − mean(prev21) em todas as 5 dims; null se dados insuficientes
  hasFatigueData: boolean;
};

export type TrendFilters = {
  position: "all" | "GR" | "DEF" | "MED" | "AVA";
  ageGroup: "all" | "u14" | "u15" | "u17" | "u19" | "senior";
  sortBy: "delta" | "alphabetic";
};

type TrendResponseRow = {
  player_id: string;
  submitted_at: string | null;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};

const STAFF_ROLES = ["coach", "analyst"] as const;
const DURATION_DAYS = 28;

/**
 * Checks whether the currently authenticated user is staff (coach or analyst).
 * Returns their profile row if so, or an authorization error result.
 *
 * Used as a shared guard by trends Server Actions.
 */
async function requireStaffRole(): Promise<Result<{ userId: string; clubId: string; role: string }, AppError>> {
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

/**
 * getFatigueTrendsData — Fetches 4-week fatigue trends for all active players
 *
 * - Validates staff role
 * - Performs batch query (2 queries: players + fatigue_responses)
 * - Computes sparkline data and delta indicators
 * - Applies filters client-side
 * - Logs access via auditedRead (fire-and-forget)
 */
export async function getFatigueTrendsData(
  filters?: TrendFilters
): Promise<Result<{ players: PlayerTrendData[] }, AppError>> {
  // 1. Guard
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  // Use service role for all DB queries — createServerClient JWT propagation
  // is unreliable for Server Actions (AGENTS.md Rule 1)
  const serviceRole = getServiceRoleClient();

  // 2. Query batch única — jogadores activos
  const { data: playersData, error: playersError } = await serviceRole
    .from("players")
    .select("id, full_name, age_group")
    .eq("club_id", clubId)
    .neq("is_archived", true)
    .order("full_name", { ascending: true });

  if (playersError || !playersData) {
    return err({
      code: "db_error",
      message: playersError?.message ?? "Erro ao carregar jogadores",
    });
  }

  // Get primary positions for all players
  const playerIds = playersData.map((p) => p.id);

  if (playerIds.length === 0) {
    return ok({ players: [] });
  }
  const { data: positionsData, error: positionsError } = await serviceRole
    .from("positions")
    .select("player_id, position")
    .in("player_id", playerIds)
    .eq("is_primary", true);

  if (positionsError) {
    return err({
      code: "db_error",
      message: positionsError.message,
    });
  }

  // Create position map
  const positionMap = new Map<string, string>();
  for (const pos of positionsData ?? []) {
    if (pos && pos.player_id && pos.position) {
      positionMap.set(pos.player_id, pos.position);
    }
  }

  // 3. Query batch única — respostas dos últimos 28 dias via auditedRead (FR50)
  const since = new Date(Date.now() - DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let responses: TrendResponseRow[] = [];
  try {
    responses = await auditedRead<TrendResponseRow[]>(
      {
        action: "trends.viewed",
        targetKind: "fatigue_responses",
        targetId: clubId,
        actorId: userId,
        clubId,
        payload: { player_count: playersData.length },
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- query is legitimately wrapped in auditedRead()
        const { data, error } = await serviceRole
          .from("fatigue_responses")
          .select("player_id, submitted_at, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood")
          .eq("club_id", clubId)
          .in("player_id", playerIds)
          .gte("submitted_at", since)
          .order("submitted_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as TrendResponseRow[];
      }
    );
  } catch (error) {
    return err({
      code: "db_error",
      message: error instanceof Error ? error.message : "Erro ao carregar respostas de fadiga",
    });
  }

  // 5. Agrupar respostas por player_id
  const responsesByPlayer = new Map<string, typeof responses>();
  for (const r of responses ?? []) {
    const arr = responsesByPlayer.get(r.player_id) ?? [];
    arr.push(r);
    responsesByPlayer.set(r.player_id, arr);
  }

  // 6. Construir PlayerTrendData para cada jogador
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const players: PlayerTrendData[] = playersData.map((p) => {
    const playerResponses = responsesByPlayer.get(p.id) ?? [];
    const hasFatigueData = playerResponses.length > 0;

    const dims = ["dim_energy", "dim_focus", "dim_sleep", "dim_soreness", "dim_mood"] as const;
    const sparklines: DimensionSparklines = {
      dim_energy: [],
      dim_focus: [],
      dim_sleep: [],
      dim_soreness: [],
      dim_mood: [],
    };

    for (const r of playerResponses) {
      const t = new Date(r.submitted_at ?? "").getTime();
      if (isNaN(t)) continue;
      const date = (r.submitted_at ?? "").slice(0, 10); // YYYY-MM-DD
      for (const dim of dims) {
        const val = r[dim];
        if (typeof val === "number" && val >= 1 && val <= 5) {
          sparklines[dim].push({ date, value: val });
        }
      }
    }

    // Delta: mean(last 7 dias) - mean(prev 21 dias) — média de todas as 5 dimensões
    const last7: number[] = [];
    const prev21: number[] = [];
    for (const r of playerResponses) {
      const t = new Date(r.submitted_at ?? "").getTime();
      if (isNaN(t)) continue;
      const dimVals = dims
        .map((d) => r[d])
        .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
      if (dimVals.length === 0) continue;
      const mean = dimVals.reduce((a, b) => a + b, 0) / dimVals.length;
      if (now - t <= sevenDaysMs) last7.push(mean);
      else prev21.push(mean);
    }

    const delta =
      last7.length > 0 && prev21.length > 0
        ? last7.reduce((a, b) => a + b, 0) / last7.length - prev21.reduce((a, b) => a + b, 0) / prev21.length
        : null;

    return {
      playerId: p.id,
      playerName: p.full_name ?? "—",
      position: positionMap.get(p.id) ?? "—",
      ageGroup: p.age_group ?? "—",
      sparklines,
      delta,
      hasFatigueData,
    };
  });

  // 7. Aplicar filtros e ordenação
  let filtered = players;
  if (filters?.position && filters.position !== "all") {
    filtered = filtered.filter((p) => p.position === filters.position);
  }
  if (filters?.ageGroup && filters.ageGroup !== "all") {
    filtered = filtered.filter((p) => p.ageGroup === filters.ageGroup);
  }
  if (filters?.sortBy === "delta") {
    filtered = [...filtered].sort((a, b) => {
      if (a.delta === null && b.delta === null) return 0;
      if (a.delta === null) return 1;
      if (b.delta === null) return -1;
      return b.delta - a.delta; // descendente
    });
  }
  // sortBy === "alphabetic": já ordenado por full_name na query

  return ok({ players: filtered });
}
