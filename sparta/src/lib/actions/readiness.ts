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
import type { ReadinessSnapshot, PlayerReadinessData, SessionHistoryEntry, PlayerSessionHistory } from "@/types/supabase";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";
import { READINESS_STATE_PRIORITY } from "@/lib/readiness/thresholds";

export interface FormationEntry {
  player_id: string;
  role: 'starter' | 'bench';
}

export interface FormationResult {
  lineups: FormationEntry[];
  source: 'session_lineup' | 'recent_lineup' | 'none';
}

export interface DrillDownData {
  fatigueResponses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  attendanceNumerator: number;
  attendanceDenominator: number;
}

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
): Promise<Result<{ players: PlayerReadinessData[]; history: PlayerSessionHistory }, AppError>> {
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
    return ok({ players: [], history: {} });
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

      // Validate state is known
      if (!(snapshot.state in READINESS_STATE_PRIORITY)) {
        logger.warn('readiness.unknown_state', {
          player_id: snapshot.player_id,
          state: snapshot.state,
        });
      }

      // Validate ACWR band is complete or null
      const acwrComplete =
        snapshot.acwr != null &&
        snapshot.acwr_band_lo != null &&
        snapshot.acwr_band_hi != null;
      if ((snapshot.acwr != null || snapshot.acwr_band_lo != null || snapshot.acwr_band_hi != null) && !acwrComplete) {
        logger.warn('readiness.partial_acwr_band', {
          player_id: snapshot.player_id,
          acwr: snapshot.acwr,
          band_lo: snapshot.acwr_band_lo,
          band_hi: snapshot.acwr_band_hi,
        });
      }

      // Log missing player records (data consistency issue)
      if (!player) {
        logger.warn('readiness.missing_player_record', {
          player_id: snapshot.player_id,
          session_id: sessionId,
        });
      }

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

  // Fetch session history from session_metrics (srpe_value per session, last 8 per player)
  // Source: session_metrics, not readiness_snapshots — ensures all sessions with recorded
  // sRPE appear in the bar, regardless of whether a readiness snapshot was computed.
  const SESSION_HISTORY_COUNT = 8;
  const historyLookbackMs = 90 * 24 * 60 * 60 * 1000;
  const historyStart = new Date(Date.now() - historyLookbackMs);

  // eslint-disable-next-line custom/no-direct-health-data-read -- read inside staff-auth-guarded action; audit already logged above for this panel load
  const { data: historyRows } = await supabase
    .from('session_metrics')
    .select('player_id, session_id, srpe_value, computed_at')
    .in('player_id', playerIds)
    .eq('club_id', clubId)
    .gte('computed_at', historyStart.toISOString())
    .order('computed_at', { ascending: false });

  // Group by player_id, take first SESSION_HISTORY_COUNT (most recent), then reverse to oldest→newest
  const historyByPlayer = new Map<string, SessionHistoryEntry[]>();
  for (const row of historyRows ?? []) {
    const existing = historyByPlayer.get(row.player_id) ?? [];
    if (existing.length < SESSION_HISTORY_COUNT) {
      existing.push({
        sessionId: row.session_id,
        computedAt: row.computed_at,
        srpeValue: row.srpe_value,
      });
      historyByPlayer.set(row.player_id, existing);
    }
  }
  // Reverse each player's list so it's oldest→newest (for left-to-right display)
  const history: PlayerSessionHistory = {};
  for (const [playerId, entries] of historyByPlayer) {
    history[playerId] = entries.reverse();
  }

  return ok({ players, history });
}

/**
 * getFormationData — Returns lineup for the upcoming session (or most recent match).
 *
 * AUTHORIZATION: Staff only (coach/analyst). Players cannot access this (FR26).
 *
 * BEHAVIOR:
 * - If session is match/friendly with defined lineup → return it (source='session_lineup')
 * - Otherwise: search last 5 past match/friendly sessions for a full lineup (source='recent_lineup')
 * - If none found → return empty lineups (source='none')
 */
export async function getFormationData(
  sessionId: string
): Promise<Result<FormationResult, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!sessionId?.trim()) {
    return err({ code: 'not_found', message: 'Sessão inválida' });
  }

  const { clubId } = authResult.data;
  const supabase = await createServerClient();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('type')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single();

  if (sessionError) {
    logger.error('readiness.formation.session_fetch_failed', { session_id: sessionId, error: sessionError.message });
    return err({ code: 'db_error', message: 'Erro ao carregar sessão' });
  }
  if (!session) {
    return err({ code: 'not_found', message: 'Sessão não encontrada' });
  }

  const isMatch = session.type === 'match' || session.type === 'friendly';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchLineupTable = (supabase.from as any)('match_lineups');

  if (isMatch) {
    const { data: currentLineups, error: lineupError } = await matchLineupTable
      .select('player_id, role')
      .eq('session_id', sessionId) as { data: FormationEntry[] | null; error: { message?: string } | null };

    if (lineupError) {
      logger.error('readiness.formation.lineup_fetch_failed', { session_id: sessionId, error: lineupError.message ?? 'Unknown error' });
      return err({ code: 'db_error', message: 'Erro ao carregar convocatória' });
    }

    const starters = (currentLineups ?? []).filter((l) => l.role === 'starter');
    if (starters.length > 0) {
      return ok({ lineups: starters, source: 'session_lineup' });
    }
  }

  // Fallback: most recent match/friendly with a full lineup
  const now = new Date();
  const { data: recentSessions, error: recentError } = await supabase
    .from('sessions')
    .select('id')
    .eq('club_id', clubId)
    .in('type', ['match', 'friendly'])
    .lt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(5);

  if (recentError) {
    logger.error('readiness.formation.recent_sessions_failed', { error: recentError.message });
    return err({ code: 'db_error', message: 'Erro ao buscar convocatórias anteriores' });
  }

  for (const s of recentSessions ?? []) {
    if (s.id == null) continue;

    const { data: pastLineups, error: pastError } = await matchLineupTable
      .select('player_id, role')
      .eq('session_id', s.id) as { data: FormationEntry[] | null; error: { message?: string } | null };

    if (pastError) {
      logger.warn('readiness.formation.past_lineup_failed', { session_id: s.id, error: pastError.message ?? 'Unknown error' });
      continue;
    }

    const pastStarters = (pastLineups ?? []).filter((l) => l.role === 'starter');
    if (pastStarters.length >= 1) {
      return ok({ lineups: pastStarters, source: 'recent_lineup' });
    }
  }

  return ok({ lineups: [], source: 'none' });
}

/**
 * getPlayerDrillDownData — Returns 28-day fatigue series + attendance for drill-down sheet.
 *
 * AUTHORIZATION: Staff only (coach/analyst). Players cannot access this (FR26).
 * AUDIT: auditedRead() with action='readiness.drilldown' (AC #5, FR50, Story 3.11).
 * ESLint: fatigue_responses query is inside auditedRead() callback (no-direct-health-data-read).
 */
export async function getPlayerDrillDownData(
  playerId: string
): Promise<Result<DrillDownData, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!playerId?.trim()) {
    return err({ code: 'not_found', message: 'Recurso não encontrado' });
  }

  const { userId, clubId } = authResult.data;
  const supabase = await createServerClient();

  const now = new Date();
  const since28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Fetch fatigue responses via auditedRead + service role.
  // Service role bypasses RLS — application-level security already enforced:
  //   1. Caller authenticated (requireStaffRole above)
  //   2. Caller is coach/analyst of clubId (requireStaffRole above)
  // Explicit club_id + player_id filters maintain multi-tenant isolation.
  // (User client RLS may fail to propagate JWT when action is called from useEffect.)
  let fatigueRows: FatigueResponse[] = [];
  try {
    fatigueRows = await auditedRead<FatigueResponse[]>(
      {
        targetKind: 'fatigue_responses',
        targetId: playerId,
        action: 'readiness.drilldown',
        actorId: userId,
        clubId,
      },
      async () => {
        const serviceRole = getServiceRoleClient();
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
        const { data, error } = await serviceRole
          .from('fatigue_responses')
          .select(
            'id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via'
          )
          .eq('player_id', playerId)
          .eq('club_id', clubId)
          .gte('submitted_at', since28.toISOString())
          .order('submitted_at', { ascending: true });
        if (error) throw error;
        return (data ?? []) as FatigueResponse[];
      }
    );
  } catch (e) {
    logger.error('readiness.drilldown.fatigue_fetch_failed', {
      player_id: playerId,
      error: e instanceof Error ? e.message : String(e),
    });
    return err({ code: 'db_error', message: 'Erro ao carregar dados de fadiga' });
  }

  // Note: auditedRead() logs audit trail asynchronously (fire-and-forget pattern).
  // If audit logging fails, it is logged separately but does not block data return.

  // fatigueRows already has correct type; service role + DB NOT NULL guarantee valid dimensions.
  const fatigueResponses = fatigueRows;

  // Fetch all club sessions in the 28-day window for attendance denominator
  const { data: sessionRows, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type, scheduled_at')
    .eq('club_id', clubId)
    .gte('scheduled_at', since28.toISOString())
    .lte('scheduled_at', now.toISOString());

  if (sessionsError) {
    logger.error('readiness.drilldown.sessions_fetch_failed', {
      player_id: playerId,
      error: sessionsError.message,
    });
    return err({ code: 'db_error', message: 'Erro ao carregar sessões' });
  }

  const allSessions = sessionRows ?? [];
  const sessions: Record<string, SessionInfo> = {};
  for (const s of allSessions) {
    sessions[s.id] = { id: s.id, type: s.type, scheduled_at: s.scheduled_at };
  }

  const attendanceDenominator = allSessions.length;
  // Only count responses that are linked to a known session (session_id may be null for offline/fallback submissions)
  const respondedSessionIds = new Set(
    fatigueResponses.flatMap((r) => (r.session_id != null ? [r.session_id] : []))
  );
  const attendanceNumerator = [...respondedSessionIds].filter((sid) => sid in sessions).length;

  return ok({
    fatigueResponses,
    sessions,
    attendanceNumerator,
    attendanceDenominator,
  });
}

// ─── Dossier ──────────────────────────────────────────────────────────────────

export interface FatigueTrendPoint {
  submittedAt: string;
  avg: number; // average of 5 dimensions (1–5)
}

export interface LatestQuestionnaire {
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
  srpe_value: number | null;
  submittedAt: string;
  phase: string;
}

export interface PlayerDossierData {
  acwrRatio: number | null;
  acwrState: 'ready' | 'caution' | 'alert' | 'neutral';
  acwrBandLo: number;
  acwrBandHi: number;
  acuteLoad: number;
  chronicLoad: number;
  dataSufficient: boolean;
  fatigueTrend: FatigueTrendPoint[]; // last ≤14 responses, oldest→newest
  latestQuestionnaire: LatestQuestionnaire | null;
}

/**
 * getPlayerDossierData — Returns ACWR + fatigue trend + latest questionnaire for the dossier tab.
 *
 * AUTHORIZATION: Staff only (coach/analyst). Players cannot access this (FR26).
 */
export async function getPlayerDossierData(
  playerId: string
): Promise<Result<PlayerDossierData, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;

  if (!playerId?.trim()) {
    return err({ code: 'not_found', message: 'Recurso não encontrado' });
  }

  const { userId, clubId } = authResult.data;
  const serviceRole = getServiceRoleClient();
  const asOf = new Date();

  // 1. ACWR computation (uses service role — same pattern as snapshot refresh)
  const { computeAcwr } = await import('@/lib/readiness/acwr');
  const acwr = await computeAcwr(serviceRole, { playerId, asOf });

  // 2. Fatigue responses — last 28 days, for trend + latest questionnaire
  const since28 = new Date(asOf.getTime() - 28 * 24 * 60 * 60 * 1000);

  let fatigueRows: FatigueResponse[] = [];
  try {
    fatigueRows = await auditedRead<FatigueResponse[]>(
      {
        targetKind: 'fatigue_responses',
        targetId: playerId,
        action: 'readiness.dossier',
        actorId: userId,
        clubId,
      },
      async () => {
        // eslint-disable-next-line custom/no-direct-health-data-read -- inside auditedRead() callback; audit logging handled by wrapper
        const { data, error } = await serviceRole
          .from('fatigue_responses')
          .select('id, player_id, session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, srpe_value, submitted_at, submitted_via')
          .eq('player_id', playerId)
          .eq('club_id', clubId)
          .gte('submitted_at', since28.toISOString())
          .order('submitted_at', { ascending: true });
        if (error) throw error;
        return (data ?? []) as FatigueResponse[];
      }
    );
  } catch (e) {
    return err({ code: 'db_error', message: 'Erro ao carregar dados de fadiga' });
  }

  // 3. Fatigue trend — last 14 responses
  const trendRows = fatigueRows.slice(-14);
  const fatigueTrend: FatigueTrendPoint[] = trendRows.map((r) => ({
    submittedAt: r.submitted_at,
    avg: (r.dim_energy + r.dim_focus + r.dim_sleep + r.dim_soreness + r.dim_mood) / 5,
  }));

  // 4. Latest questionnaire — most recent response
  const latestRow = fatigueRows.at(-1) ?? null;
  const latestQuestionnaire: LatestQuestionnaire | null = latestRow
    ? {
        dim_energy: latestRow.dim_energy,
        dim_focus: latestRow.dim_focus,
        dim_sleep: latestRow.dim_sleep,
        dim_soreness: latestRow.dim_soreness,
        dim_mood: latestRow.dim_mood,
        srpe_value: latestRow.srpe_value,
        submittedAt: latestRow.submitted_at,
        phase: latestRow.phase,
      }
    : null;

  return ok({
    acwrRatio: acwr.ratio,
    acwrState: acwr.state,
    acwrBandLo: acwr.threshold.lo,
    acwrBandHi: acwr.threshold.hi,
    acuteLoad: acwr.acute,
    chronicLoad: acwr.chronic,
    dataSufficient: acwr.dataSufficient,
    fatigueTrend,
    latestQuestionnaire,
  });
}
