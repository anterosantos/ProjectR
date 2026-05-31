"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { requireStaffRole } from "@/lib/actions/auth";
import { after } from "next/server";
import { logAccess } from "@/lib/actions/audit";

export interface SubstitutionLineupRow {
  lineup_id: string;
  player_id: string;
  name: string;
  jersey_number: number;
  started_minute: number;
  ended_minute: number | null;
}

type LineupRaw = {
  id: string;
  player_id: string;
  role: string;
  shirt_num: number | null;
  started_minute: number;
  ended_minute: number | null;
  players: { full_name: string; jersey_num: number } | null;
};

export async function getMatchLineupForSubs(
  sessionId: string
): Promise<
  Result<{ starters: SubstitutionLineupRow[]; bench: SubstitutionLineupRow[] }, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = (await (serviceRole.from as any)("match_lineups")
    .select("id, player_id, role, shirt_num, started_minute, ended_minute, players(full_name, jersey_num)")
    .eq("session_id", sessionId)) as {
    data: LineupRaw[] | null;
    error: { message: string } | null;
  };

  if (error) return err({ code: "unknown", message: error.message });
  if (!rows) return ok({ starters: [], bench: [] });

  const toRow = (r: LineupRaw): SubstitutionLineupRow => ({
    lineup_id: r.id,
    player_id: r.player_id,
    name: r.players?.full_name ?? "—",
    jersey_number: r.shirt_num ?? r.players?.jersey_num ?? 0,
    started_minute: r.started_minute,
    ended_minute: r.ended_minute,
  });

  const starters = rows
    .filter((r) => r.role === "starter" && r.ended_minute === null)
    .map(toRow);

  const bench = rows.filter((r) => r.role === "bench").map(toRow);

  return ok({ starters, bench });
}

export async function registerSubstitution(
  sessionId: string,
  outPlayerId: string,
  inPlayerId: string,
  minute: number
): Promise<Result<void, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  if (minute < 0 || minute > 120) {
    return err({ code: "validation", message: "Minuto deve estar entre 0 e 120." });
  }

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, duration_min")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  type LineupMinimal = { id: string; role: string; ended_minute: number | null };

  // Verificar jogador que sai: starter em campo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outRow } = (await (serviceRole.from as any)("match_lineups")
    .select("id, role, ended_minute")
    .eq("session_id", sessionId)
    .eq("player_id", outPlayerId)
    .maybeSingle()) as { data: LineupMinimal | null; error: unknown };

  if (!outRow || outRow.role !== "starter" || outRow.ended_minute !== null) {
    return err({ code: "validation", message: "Jogador que sai não está em campo." });
  }

  // Verificar jogador que entra: bench
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inRow } = (await (serviceRole.from as any)("match_lineups")
    .select("id, role")
    .eq("session_id", sessionId)
    .eq("player_id", inPlayerId)
    .maybeSingle()) as { data: { id: string; role: string } | null; error: unknown };

  if (!inRow || inRow.role !== "bench") {
    return err({ code: "validation", message: "Jogador que entra não está no banco." });
  }

  // Update jogador que sai: ended_minute
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: outError } = (await (serviceRole.from as any)("match_lineups")
    .update({ ended_minute: minute })
    .eq("id", outRow.id)) as { error: { message: string } | null };

  if (outError) return err({ code: "unknown", message: outError.message });

  // Update jogador que entra: started_minute + role = 'starter'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: inError } = (await (serviceRole.from as any)("match_lineups")
    .update({ started_minute: minute, role: "starter" })
    .eq("id", inRow.id)) as { error: { message: string } | null };

  if (inError) return err({ code: "unknown", message: inError.message });

  after(() =>
    logAccess("lineup.substitution", "session", sessionId, {
      out_player_id: outPlayerId,
      in_player_id: inPlayerId,
      minute,
    })
  );

  return ok(undefined);
}

export async function closeMatchRecord(
  sessionId: string
): Promise<Result<{ updated_count: number }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: session } = await serviceRole
    .from("sessions")
    .select("id, duration_min")
    .eq("id", sessionId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada." });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = (await (serviceRole.from as any)("match_lineups")
    .update({ ended_minute: session.duration_min })
    .eq("session_id", sessionId)
    .eq("role", "starter")
    .is("ended_minute", null)
    .select("id")) as {
    data: { id: string }[] | null;
    error: { message: string } | null;
  };

  if (error) return err({ code: "unknown", message: error.message });

  const updated_count = updated?.length ?? 0;

  after(() => logAccess("lineup.closed", "session", sessionId, { updated_count }));

  return ok({ updated_count });
}
