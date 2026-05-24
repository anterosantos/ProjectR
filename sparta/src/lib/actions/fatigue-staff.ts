"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

export interface FatigueResponse {
  id: string;
  player_id: string;
  session_id: string;
  phase: string;
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
  srpe_value: number | null;
  submitted_at: string;
  submitted_via: string;
}

export interface SessionInfo {
  id: string;
  type: string;
  scheduled_at: string;
}

export interface FatigueDataResult {
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  playerName: string;
  playerId: string;
}

const STAFF_ROLES = ["coach", "analyst"] as const;
const DURATION_DAYS = 28;

/**
 * Reads 28 days of fatigue responses for a player, staff-only.
 *
 * - Validates that the caller is staff (coach/analyst) of the same club
 * - Validates player belongs to the same club (AC #1, FR25, FR50)
 * - Uses auditedRead() for automatic audit logging (AC #2, Story 3.11)
 * - Returns 404 err when player not found (avoids revealing resource existence)
 */
export async function getPlayerFatigueData(
  playerId: string
): Promise<Result<FatigueDataResult, AppError>> {
  // Validate input
  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  // Validate staff role (AC #1)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !(STAFF_ROLES as readonly string[]).includes(profile.role ?? "")) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Validate club_id exists
  if (!profile.club_id) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Validate player belongs to same club (AC #1 — club_id match)
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, club_id")
    .eq("id", playerId)
    .eq("club_id", profile.club_id)
    .maybeSingle();

  if (!player) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // 28-day cutoff (UTC, consistent with DB timestamps) — precise ISO calculation
  const since = new Date(Date.now() - DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Query via auditedRead() — auto-inserts audit_logs fire-and-forget (AC #2)
  // actorId and clubId resolved here (outside after()) — cookies() not allowed inside after()
  let responses: FatigueResponse[] = [];
  try {
    responses = await auditedRead<FatigueResponse[]>(
      {
        action: "fatigue.staff_read",
        targetKind: "fatigue_responses",
        targetId: playerId,
        actorId: user.id,
        clubId: profile.club_id,
        payload: {
          duration_days: DURATION_DAYS,
          response_count: 0,
        },
      },
      async () => {
        // Service role bypasses RLS — application-level security already enforced:
        // 1. Caller authenticated (getUser above)
        // 2. Caller is coach/analyst of profile.club_id (role check above)
        // 3. Player belongs to profile.club_id (player lookup above)
        // Explicit club_id + player_id filters maintain data isolation.
        const serviceRole = getServiceRoleClient();
        // eslint-disable-next-line custom/no-direct-health-data-read -- query is legitimately wrapped in auditedRead()
        const { data, error } = await serviceRole
          .from("fatigue_responses")
          .select(
            "id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via"
          )
          .eq("player_id", playerId)
          .eq("club_id", profile.club_id)
          .gte("submitted_at", since.toISOString())
          .order("submitted_at", { ascending: false });

        if (error) throw error;
        return (data ?? []) as FatigueResponse[];
      }
    );
  } catch {
    return err({ code: "internal", message: "Erro ao carregar respostas de fadiga" });
  }

  // Fetch session metadata for all unique session_ids (graceful fallback if session deleted)
  const sessionIds = [...new Set(responses.map((r) => r.session_id))];
  let sessionsMap: Record<string, SessionInfo> = {};

  if (sessionIds.length > 0) {
    const serviceRoleForSessions = getServiceRoleClient();
    const { data: sessions } = await serviceRoleForSessions
      .from("sessions")
      .select("id, type, scheduled_at")
      .in("id", sessionIds);

    sessionsMap = (sessions ?? []).reduce<Record<string, SessionInfo>>((acc, s) => {
      acc[s.id] = { id: s.id, type: s.type, scheduled_at: s.scheduled_at };
      return acc;
    }, {});
  }

  return ok({
    responses,
    sessions: sessionsMap,
    playerName: player.full_name,
    playerId: player.id,
  });
}
