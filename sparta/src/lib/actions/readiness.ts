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
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { refreshSnapshotForSession } from "@/lib/readiness/snapshot";
import { err, ok } from "@/lib/types";
import { logger } from "@/lib/logger";
import type { Result, AppError } from "@/lib/types";
import type { ReadinessSnapshot, PlayerReadinessData } from "@/types/supabase";
import { READINESS_STATE_PRIORITY } from "@/lib/readiness/thresholds";

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
): Promise<Result<{ playerId: string; snapshot: ReadinessSnapshot | null }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) {
    return authResult;
  }

  if (!playerId?.trim()) {
    return err({ code: "not_found", message: "Recurso não encontrado" });
  }

  const supabase = await createServerClient();
  const { userId, clubId } = authResult.data;

  const queryResult = await auditedRead(
    {
      targetKind: 'readiness_snapshot',
      targetId: playerId,
      action: 'readiness.player_snapshot',
      actorId: userId,
      clubId,
    },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      supabase
        .from('readiness_snapshots')
        .select('*')
        .eq('player_id', playerId)
        .eq('club_id', clubId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
  );

  // Patch 10: Check for auditedRead errors before returning
  if (queryResult.error) {
    return err({
      code: 'db_error',
      message: 'Erro ao ler snapshot de prontidão',
    });
  }

  return ok({ playerId, snapshot: queryResult.data ?? null });
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

/**
 * refreshUpcomingReadiness — Refreshes readiness snapshots for scheduled sessions.
 *
 * AUTHORIZATION:
 * - Only staff (coach/analyst) may call this
 * - Players receive "Não autorizado" (FR26)
 *
 * BEHAVIOR:
 * - If sessionId provided: refresh that session
 * - If no sessionId: refresh all scheduled sessions in next 7 days
 *
 * RETURNS: { refreshed: number } = count of sessions refreshed
 */
export async function refreshUpcomingReadiness(
  sessionId?: string
): Promise<Result<{ refreshed: number }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  const serviceRole = getServiceRoleClient();
  let count = 0;

  if (sessionId) {
    // Patch 11: Verify session belongs to caller's club before refresh
    const { data: session, error } = await serviceRole
      .from('sessions')
      .select('club_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session || session.club_id !== authResult.data.clubId) {
      return err({
        code: 'not_found',
        message: 'Sessão não encontrada ou acesso negado',
      });
    }

    await refreshSnapshotForSession(serviceRole, sessionId);
    count = 1;
  } else {
    const { clubId } = authResult.data;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: sessions } = await serviceRole
      .from('sessions')
      .select('id')
      .eq('club_id', clubId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in7Days.toISOString());

    for (const s of sessions ?? []) {
      // P-8: guard contra null (não apenas undefined)
      if (s.id != null) {
        // P-9: só incrementar count em caso de sucesso
        try {
          await refreshSnapshotForSession(serviceRole, s.id);
          count++;
        } catch (e) {
          logger.error('refresh_upcoming_readiness.session_refresh_failed', {
            session_id: s.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  return ok({ refreshed: count });
}

/**
 * getClubReadinessSnapshots — Returns all readiness snapshots for a session, sorted by priority.
 *
 * AUTHORIZATION:
 * - Only staff (coach/analyst) may read
 * - Players receive "Não autorizado"
 *
 * RETURNS: { snapshots: ReadinessSnapshot[] } sorted by state priority (alert → caution → ready → neutral), then ACWR DESC
 */
export async function getClubReadinessSnapshots(
  sessionId: string
): Promise<Result<{ snapshots: ReadinessSnapshot[] }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  const supabase = await createServerClient();
  const { userId, clubId } = authResult.data;

  const result = await auditedRead(
    {
      targetKind: 'readiness_snapshot',
      targetId: sessionId,
      action: 'readiness.painel_read',
      actorId: userId,
      clubId,
    },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      supabase
        .from('readiness_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .eq('club_id', clubId)
  );

  if (result.error) {
    return err({
      code: 'db_error',
      message: 'Erro ao ler snapshots de prontidão',
    });
  }

  // P-4: usar READINESS_STATE_PRIORITY partilhado (DRY) + ?? -Infinity para NULLs last (AC #5)
  const snapshots = (result.data ?? []).sort((a, b) => {
    const pa = READINESS_STATE_PRIORITY[a.state] ?? 5;
    const pb = READINESS_STATE_PRIORITY[b.state] ?? 5;
    if (pa !== pb) return pa - pb;
    // NULLs last: ?? -Infinity (consistente com getReadinessPanelData)
    const acwrA = a.acwr ?? -Infinity;
    const acwrB = b.acwr ?? -Infinity;
    return acwrB - acwrA;
  });

  return ok({ snapshots });
}

/**
 * getUpcomingSession — Returns the next scheduled session within the next 7 days.
 *
 * AUTHORIZATION:
 * - Only staff (coach/analyst) may call this
 * - Players receive "Não autorizado" (FR26)
 *
 * RETURNS: { sessionId, scheduledAt } or null if no upcoming session
 */
export async function getUpcomingSession(): Promise<
  Result<{ sessionId: string; scheduledAt: string } | null, AppError>
> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  const { clubId } = authResult.data;
  const supabase = await createServerClient();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, scheduled_at')
    .eq('club_id', clubId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in7Days.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return err({ code: 'db_error', message: 'Erro ao buscar sessão' });
  }

  if (!session) {
    return ok(null);
  }

  return ok({ sessionId: session.id, scheduledAt: session.scheduled_at });
}

/**
 * getReadinessPanelData — Returns readiness snapshots enriched with player info.
 *
 * AUTHORIZATION:
 * - Only staff (coach/analyst) may call this
 * - Players receive "Não autorizado"
 *
 * RETURNS: { players: PlayerReadinessData[] } sorted by state priority + ACWR DESC,
 * each entry including playerName, jerseyNum, and primaryPosition.
 */
export async function getReadinessPanelData(
  sessionId: string
): Promise<Result<{ players: PlayerReadinessData[] }, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!sessionId?.trim()) {
    return err({ code: 'not_found', message: 'Sessão inválida' });
  }

  const { userId, clubId } = authResult.data;
  const supabase = await createServerClient();

  // Fetch snapshots with audit logging
  const snapshotResult = await auditedRead(
    {
      targetKind: 'readiness_snapshot',
      targetId: sessionId,
      action: 'readiness.painel_read',
      actorId: userId,
      clubId,
    },
    async () =>
      // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
      supabase
        .from('readiness_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .eq('club_id', clubId)
  );

  if (snapshotResult.error) {
    return err({ code: 'db_error', message: 'Erro ao carregar dados de prontidão' });
  }

  const snapshots: ReadinessSnapshot[] = snapshotResult.data ?? [];

  if (snapshots.length === 0) {
    return ok({ players: [] });
  }

  // Fetch player info (full_name, jersey_num) for these players
  const playerIds = snapshots.map((s) => s.player_id);

  const { data: playerRows, error: playersError } = await supabase
    .from('players')
    .select('id, full_name, jersey_num')
    .in('id', playerIds)
    .is('archived_at', null);

  if (playersError) {
    return err({ code: 'db_error', message: 'Erro ao carregar jogadores' });
  }

  // Fetch primary positions
  // P-3: verificar erro (antes: silenciado; em falha todos os jogadores ficavam como "MED")
  const { data: positionRows, error: positionsError } = await supabase
    .from('positions')
    .select('player_id, position')
    .in('player_id', playerIds)
    .eq('is_primary', true);

  if (positionsError) {
    logger.error('readiness.positions_fetch_failed', {
      session_id: sessionId,
      error: positionsError.message,
    });
    return err({ code: 'db_error', message: 'Erro ao carregar posições dos jogadores' });
  }

  // Build lookup maps
  const playerMap = new Map(
    (playerRows ?? []).map((p) => [p.id, p])
  );
  const positionMap = new Map(
    (positionRows ?? []).map((pos) => [pos.player_id, pos.position])
  );

  // P-22: usar READINESS_STATE_PRIORITY partilhado (DRY)
  const players: PlayerReadinessData[] = snapshots
    .map((snapshot) => {
      const player = playerMap.get(snapshot.player_id);
      return {
        ...snapshot,
        // P-11: trim + fallback para full_name vazio
        playerName: player?.full_name?.trim() || 'Jogador',
        jerseyNum: player?.jersey_num ?? 0,
        primaryPosition: positionMap.get(snapshot.player_id) ?? null,
      };
    })
    .sort((a, b) => {
      const pa = READINESS_STATE_PRIORITY[a.state] ?? 5;
      const pb = READINESS_STATE_PRIORITY[b.state] ?? 5;
      if (pa !== pb) return pa - pb;
      // Within same state: ACWR DESC (NULLs last — AC #5)
      const acwrA = a.acwr ?? -Infinity;
      const acwrB = b.acwr ?? -Infinity;
      return acwrB - acwrA;
    });

  return ok({ players });
}
