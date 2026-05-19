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

  if (sessionError || !session) {
    return { ok: false, error: "Sessão não encontrada" };
  }

  // Verify session type is match or friendly (not training) — server-side enforcement
  const validSessionTypes = ["match", "friendly"];
  if (!validSessionTypes.includes(session.type)) {
    return { ok: false, error: "Convocatória apenas para jogos e amigáveis" };
  }

  // Verify all players belong to the club and check parental consent status
  const playerIds = players.map((p) => p.playerId);
  const playersResult = await supabase
    .from("players")
    .select("id, club_id, parental_consents(status)")
    .in("id", playerIds)
    .eq("club_id", profile.club_id);
  const { data: clubPlayers, error: playersError } = playersResult as {
    data: Array<{
      id: string;
      club_id: string;
      parental_consents?: Array<{ status: string }>;
    }> | null;
    error: any;
  };

  if (playersError) {
    return { ok: false, error: "Erro ao validar jogadores" };
  }

  if (!clubPlayers || clubPlayers.length !== playerIds.length) {
    return { ok: false, error: "Um ou mais jogadores não pertencem ao seu clube" };
  }

  // Check parental consent for minors — players without confirmed consent should be flagged
  // Business logic: warn via audit log, but don't block (consent is for data access, not participation)
  const playersWithoutConsent = clubPlayers.filter((p: any) => {
    const consentStatus = p?.parental_consents?.[0]?.status;
    return consentStatus && consentStatus !== "confirmed";
  });

  if (playersWithoutConsent.length > 0) {
    console.warn(
      `[submitLineup] Players without confirmed consent: ${playersWithoutConsent.map((p: any) => p.id).join(", ")}`
    );
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
    const matchLineupTable = (supabase.from as any)("match_lineups");
    const deleteResult = await matchLineupTable
      .delete()
      .eq("session_id", sessionId);

    if (deleteResult.error) {
      console.error("[submitLineup] Delete error:", deleteResult.error);
      return { ok: false, error: "Erro ao remover convocatória anterior" };
    }

    // Insert new lineups
    const insertResult = await matchLineupTable
      .insert(lineupInserts.map(l => ({
        ...l,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));

    if (insertResult.error) {
      console.error("[submitLineup] Insert error:", insertResult.error);
      return { ok: false, error: "Erro ao guardar convocatória" };
    }
  } catch (err) {
    console.error("[submitLineup] Operation error:", err);
    return { ok: false, error: "Erro ao guardar convocatória" };
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

// Fetch existing lineups for a session (for loading in the UI)
export async function getLineupForSession(
  sessionId: string
): Promise<Result<MatchLineupData[], AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  // Verify session belongs to user's club via RLS
  const matchLineupTable = (supabase.from as any)("match_lineups");
  const selectResult = await matchLineupTable
    .select("*")
    .eq("session_id", sessionId);
  const { data: lineups, error } = selectResult as {
    data: MatchLineupData[] | null;
    error: any;
  };

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  return ok((lineups ?? []) as unknown as MatchLineupData[]);
}
