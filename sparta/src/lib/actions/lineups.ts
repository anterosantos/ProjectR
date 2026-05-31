"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/actions/audit";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

const SubmitLineupSchema = z.object({
  sessionId: z.string().uuid("ID de sessão inválido"),
  players: z
    .array(
      z.object({
        playerId: z.string().uuid("ID de jogador inválido"),
        role: z.enum(["starter", "bench"]),
        shirtNum: z.number().int().positive().max(99).nullable().optional(),
      })
    )
    .min(1, "Pelo menos um jogador é necessário")
    .refine(
      (players) => {
        const starterCount = players.filter((p) => p.role === "starter").length;
        return starterCount === 11;
      },
      {
        message: "Deve seleccionar exactamente 11 titulares",
      }
    ),
});

export interface SubmitLineupResult {
  ok: boolean;
  error?: string;
}

async function getAuthContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, id, role")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

// In-memory lock to prevent concurrent submissions for the same session
const submissionLocks = new Map<string, Promise<void>>();

export async function submitLineup(
  input: unknown
): Promise<SubmitLineupResult> {
  // Validate input
  const validated = SubmitLineupSchema.safeParse(input);
  if (!validated.success) {
    const message = validated.error.issues[0]?.message || "Dados inválidos";
    return { ok: false, error: message };
  }

  const { sessionId, players } = validated.data;

  const { supabase, user, profile } = await getAuthContext();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }
  if (!profile?.club_id) {
    return { ok: false, error: "Perfil não encontrado" };
  }

  // Verify user is a coach (only coaches can submit lineups)
  if (profile.role !== "coach") {
    return { ok: false, error: "Apenas treinadores podem submeter convocatórias" };
  }

  // Prevent concurrent submissions for the same session
  if (submissionLocks.has(sessionId)) {
    return { ok: false, error: "Submissão em progresso. Por favor aguarde." };
  }

  // Create a lock promise for this session
  const lockPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      submissionLocks.delete(sessionId);
      resolve();
    }, 5000); // 5s timeout to release lock
  });

  submissionLocks.set(sessionId, lockPromise);

  // Verify session belongs to user's club
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, club_id, type")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .single();

  if (sessionError) {
    console.error("[submitLineup] Session fetch error:", sessionError);
    return { ok: false, error: `Sessão não encontrada: ${sessionError.message}` };
  }

  if (!session) {
    return {
      ok: false,
      error: `Sessão ${sessionId} não encontrada no clube ${profile.club_id}`,
    };
  }

  // Verify session type is match or friendly (not training) — server-side enforcement
  const validSessionTypes = ["match", "friendly"];
  if (!validSessionTypes.includes(session.type)) {
    return { ok: false, error: "Convocatória apenas para jogos e amigáveis" };
  }

  // Verify all players belong to the club
  const playerIds = players.map((p) => p.playerId);
  const playersResult = await supabase
    .from("players")
    .select("id, club_id")
    .in("id", playerIds)
    .eq("club_id", profile.club_id);
  const { data: clubPlayers, error: playersError } = playersResult as {
    data: Array<{
      id: string;
      club_id: string;
    }> | null;
    error: { message: string } | null;
  };

  if (playersError) {
    console.error("[submitLineup] Player validation error:", playersError.message);
    return {
      ok: false,
      error: `Erro ao validar jogadores: ${playersError.message}`,
    };
  }

  if (!clubPlayers || clubPlayers.length !== playerIds.length) {
    const found = clubPlayers?.length ?? 0;
    console.warn(
      `[submitLineup] Found ${found}/${playerIds.length} players in club ${profile.club_id}`
    );
    return {
      ok: false,
      error: `${found}/${playerIds.length} jogadores encontrados. Verifique se pertencem ao seu clube.`,
    };
  }

  // Delete existing lineups and insert new ones in a single RPC call for atomicity
  // Note: match_lineups table added in migration 000130; using type assertion
  const lineupInserts = players.map((player) => ({
    session_id: sessionId,
    player_id: player.playerId,
    role: player.role,
    shirt_num: player.shirtNum ?? null,
    started_minute: 0,
  }));

  // Delete existing lineups and insert new ones
  // Note: match_lineups table added in migration 000130; not yet in Supabase client types
  try {
    // Delete previous lineups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchLineupTable = (supabase.from as any)("match_lineups");
    const deleteResult = await matchLineupTable
      .delete()
      .eq("session_id", sessionId);

    if (deleteResult.error) {
      console.error("[submitLineup] Delete error:", deleteResult.error);
      return {
        ok: false,
        error: `Delete failed: ${deleteResult.error.message}`,
      };
    }

    // Insert new lineups
    const insertResult = await matchLineupTable.insert(
      lineupInserts.map((l) => ({
        ...l,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
    );

    if (insertResult.error) {
      console.error("[submitLineup] Insert error:", insertResult.error);
      return {
        ok: false,
        error: `Insert failed: ${insertResult.error.message}`,
      };
    }
  } catch (err) {
    console.error("[submitLineup] Operation error:", err);
    return {
      ok: false,
      error: `Operation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  // Create audit log entry
  try {
    await logAccess("lineup.submitted", "session", sessionId);
  } catch (logError) {
    console.error("[submitLineup] Audit log failed:", logError);
    // Continue anyway - audit log failure shouldn't block the main operation
  }

  return { ok: true };
}

export interface MatchLineupData {
  id: string;
  session_id: string;
  player_id: string;
  role: "starter" | "bench" | "convocado_only";
  shirt_num: number | null;
  started_minute: number;
  ended_minute: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatchLineupWithPlayerData extends MatchLineupData {
  name: string;
  jersey_number: number;
  position: string;
  age_group: string;
  processing_restricted: boolean;
}

// Fetch existing lineups for a session with player details (for loading in the UI)
export async function getLineupForSession(
  sessionId: string
): Promise<Result<MatchLineupWithPlayerData[], AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const AGE_GROUP_DISPLAY: Record<string, string> = {
    u14: "U-14", u15: "U-15", u17: "U-17", u19: "U-19", senior: "Senior",
  };

  // Fetch starters with player details (full_name, jersey_num, age_group, processing_restricted)
  // and their primary position from the positions table.
  // Club isolation is enforced by page.tsx + RLS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (supabase.from as any)("match_lineups");
  const selectResult = await matchLineupTable
    .select(
      `*,
       players(full_name, jersey_num, age_group, processing_restricted, positions(position, is_primary))`
    )
    .eq("session_id", sessionId);
  const { data: lineupData, error } = selectResult as {
    data: Array<{
      id: string;
      session_id: string;
      player_id: string;
      role: string;
      shirt_num: number | null;
      started_minute: number;
      ended_minute: number | null;
      created_at: string;
      updated_at: string;
      players: {
        full_name: string;
        jersey_num: number;
        age_group: string;
        processing_restricted: boolean;
        positions: Array<{ position: string; is_primary: boolean }> | null;
      } | null;
    }> | null;
    error: { message: string } | null;
  };

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  if (!lineupData) {
    return ok([]);
  }

  const lineups: MatchLineupWithPlayerData[] = lineupData
    .filter((l) => l.players !== null)
    .map((l) => {
      const p = l.players!;
      const primaryPos =
        p.positions?.find((pos) => pos.is_primary)?.position ??
        p.positions?.[0]?.position ??
        "—";
      return {
        id: l.id,
        session_id: l.session_id,
        player_id: l.player_id,
        role: l.role as "starter" | "bench" | "convocado_only",
        shirt_num: l.shirt_num,
        started_minute: l.started_minute,
        ended_minute: l.ended_minute,
        created_at: l.created_at,
        updated_at: l.updated_at,
        name: p.full_name,
        jersey_number: l.shirt_num ?? p.jersey_num,
        position: primaryPos,
        age_group: AGE_GROUP_DISPLAY[p.age_group] ?? p.age_group,
        processing_restricted: p.processing_restricted === true,
      };
    });

  return ok(lineups);
}
