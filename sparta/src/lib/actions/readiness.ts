"use server";

/**
 * readiness.ts — Server Actions for processed readiness data (Epic 5 placeholder).
 *
 * DADOS MEDIADOS PRINCIPLE (FR26, Story 4.6):
 * Players MUST NOT access processed/derived readiness data directly.
 * Staff (coach/analyst) interprets and mediates the data to players.
 *
 * This file enforces the authorization boundary:
 * - Players → "Não autorizado" (generic error, no data shape revealed)
 * - Staff (coach/analyst) → allowed to read, club_id scoped via RLS
 *
 * NOTE: The readiness_snapshots table is created in Epic 5 (Story 5.3).
 * These actions are stubs that enforce the authorization contract today
 * so the enforcement exists before the data model does.
 */

import { createServerClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";

const STAFF_ROLES = ["coach", "analyst"] as const;

/**
 * Checks whether the currently authenticated user is staff (coach or analyst).
 * Returns their profile row if so, or an authorization error result.
 *
 * Used as a shared guard by all readiness Server Actions.
 */
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
    // Generic error — does not reveal whether resource exists or not (FR26)
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
 * getPlayerReadinessSnapshot — Returns the latest readiness snapshot for a player.
 *
 * AUTHORIZATION:
 * - Players cannot call this action (returns "Não autorizado")
 * - Only staff (coach/analyst) of the same club may read snapshots
 * - Club isolation enforced via application-level club_id check + RLS
 *
 * NOTE: readiness_snapshots table is created in Story 5.3.
 * Until then, this returns null data but enforces the authorization contract.
 */
export async function getPlayerReadinessSnapshot(
  playerId: string
): Promise<Result<{ playerId: string; snapshot: null }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    return authResult;
  }

  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Story 5.3 will implement the actual query against readiness_snapshots.
  // For now, the authorization contract is enforced: staff can proceed, players cannot.
  // Returns null snapshot to indicate no data yet (table doesn't exist until Epic 5).
  return ok({ playerId, snapshot: null });
}

/**
 * getPlayerAcwrTrend — Returns ACWR (Acute:Chronic Workload Ratio) trend data.
 *
 * AUTHORIZATION:
 * - Players cannot call this action — ACWR is processed/derived data (FR26)
 * - Only staff may read ACWR data
 *
 * NOTE: ACWR calculation engine is Story 5.2. Stub enforces authorization now.
 */
export async function getPlayerAcwrTrend(
  playerId: string
): Promise<Result<{ playerId: string; trend: null }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    return authResult;
  }

  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  // Story 5.2 will implement ACWR calculation.
  return ok({ playerId, trend: null });
}
