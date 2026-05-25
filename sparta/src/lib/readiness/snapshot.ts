import type { SupabaseClient } from '@supabase/supabase-js';
import type { AcwrState } from '@/lib/readiness/thresholds';
import { computeAcwr } from '@/lib/readiness/acwr';
import { logger } from '@/lib/logger';

export type ReadinessState = 'ready' | 'caution' | 'alert' | 'neutral';

export interface FatigueDimensions {
  dim_energy: number;
  dim_focus: number;
  dim_sleep: number;
  dim_soreness: number;
  dim_mood: number;
}

export interface ClassifyReadinessInput {
  acwrState: AcwrState;
  recentFatigueAvg: number | null;
  attendanceRate: number | null;
  dataSufficient: boolean;
}

export function classifyReadinessState(
  input: ClassifyReadinessInput
): ReadinessState {
  const {
    acwrState,
    recentFatigueAvg,
    attendanceRate,
    dataSufficient,
  } = input;

  if (!dataSufficient) return 'neutral';

  if (acwrState === 'alert') return 'alert';

  // Patch 8: Guard against NaN/Infinity in threshold comparisons
  if (recentFatigueAvg !== null && !isNaN(recentFatigueAvg) && isFinite(recentFatigueAvg) && recentFatigueAvg <= 2.0) return 'alert';
  if (attendanceRate !== null && !isNaN(attendanceRate) && isFinite(attendanceRate) && attendanceRate < 0.5) return 'alert';

  if (acwrState === 'caution') return 'caution';
  if (recentFatigueAvg !== null && !isNaN(recentFatigueAvg) && isFinite(recentFatigueAvg) && recentFatigueAvg <= 2.8) return 'caution';
  if (attendanceRate !== null && !isNaN(attendanceRate) && isFinite(attendanceRate) && attendanceRate < 0.7) return 'caution';

  return 'ready';
}

export function computeRecentFatigueAvg(
  responses: FatigueDimensions[]
): number | null {
  if (responses.length === 0) return null;

  const allValues = responses.flatMap((r) => {
    // Patch 3: Null safety — validate each dimension is defined
    const dims = [r.dim_energy, r.dim_focus, r.dim_sleep, r.dim_soreness, r.dim_mood];
    if (dims.some((d) => typeof d !== 'number' || isNaN(d))) return [];
    return dims;
  });

  if (allValues.length === 0) return null;
  const sum = allValues.reduce((acc, v) => acc + v, 0);
  return sum / allValues.length;
}

// Upsert com retry para erros transitórios (ex: lock timeout, network blip)
// P-2: Simplificado — retry genérico sem lógica de versão (version nunca era incrementado,
// tornando o branch anterior letra morta). A coluna `version` fica reservada para
// optimistic locking real em stories futuras.
async function upsertWithRetry(
  serviceRole: SupabaseClient,
  data: Record<string, unknown>,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error } = await serviceRole
      .from('readiness_snapshots')
      .upsert(data, { onConflict: 'player_id,session_id', ignoreDuplicates: false });

    if (!error) return;

    // Retry com backoff exponencial em erros transitórios; propagar na última tentativa
    if (attempt < maxRetries - 1) {
      const delayMs = 100 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw error;
  }
}

// Patch 7: UUID validation helper
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export async function refreshSnapshotForSession(
  serviceRole: SupabaseClient,
  sessionId: string
): Promise<void> {
  // Patch 7: Validate sessionId format before querying
  if (!sessionId || !isValidUUID(sessionId)) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'readiness_snapshot.invalid_session_id',
        session_id: sessionId,
      })
    );
    return;
  }

  // P-5: Verificar erro da query de session (antes: discarded silently)
  const { data: session, error: sessionError } = await serviceRole
    .from('sessions')
    .select('club_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'readiness_snapshot.session_fetch_failed',
        session_id: sessionId,
        error: sessionError.message,
      })
    );
    return;
  }

  if (!session) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'readiness_snapshot.session_not_found',
        session_id: sessionId,
      })
    );
    return;
  }

  // P-6: Guard club_id null (eq(null) em PostgREST → IS NULL query incorreta)
  if (!session.club_id) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'readiness_snapshot.session_missing_club_id',
        session_id: sessionId,
      })
    );
    return;
  }

  // P-5: Verificar erro da query de players
  const { data: players, error: playersError } = await serviceRole
    .from('players')
    .select('id, age_group')
    .eq('club_id', session.club_id)
    .is('archived_at', null);

  if (playersError) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'readiness_snapshot.players_fetch_failed',
        session_id: sessionId,
        club_id: session.club_id,
        error: playersError.message,
      })
    );
    return;
  }

  if (!players || players.length === 0) return;

  const asOf = new Date();
  const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const player of players) {
    try {
      const acwr = await computeAcwr(serviceRole, {
        playerId: player.id,
        asOf,
      });

      // eslint-disable-next-line custom/no-direct-health-data-read -- internal aggregation for snapshot materialization (not user-facing read; audit via getClubReadinessSnapshots)
      const { data: responses } = await serviceRole
        .from('fatigue_responses')
        .select('dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood')
        .eq('player_id', player.id)
        .gte('submitted_at', windowStart.toISOString())
        .lte('submitted_at', asOf.toISOString());

      const recentFatigueAvg = computeRecentFatigueAvg(responses ?? []);

      const state = classifyReadinessState({
        acwrState: acwr.state,
        recentFatigueAvg,
        attendanceRate: null,
        dataSufficient: acwr.dataSufficient,
      });

      // Patch 4: Null coalescing for acwr.ratio
      const acwrValue = acwr.ratio != null && !isNaN(acwr.ratio)
        ? Number(acwr.ratio.toFixed(2))
        : null;

      // P-10: Guard acwr.threshold contra undefined (ex: computeAcwr sem threshold definido)
      const acwrBandLo = acwr.threshold?.lo ?? null;
      const acwrBandHi = acwr.threshold?.hi ?? null;

      await upsertWithRetry(
        serviceRole,
        {
          player_id: player.id,
          session_id: sessionId,
          club_id: session.club_id,
          state,
          acwr: acwrValue,
          acwr_band_lo: acwrBandLo,
          acwr_band_hi: acwrBandHi,
          recent_fatigue_avg:
            recentFatigueAvg !== null
              ? Number(recentFatigueAvg.toFixed(2))
              : null,
          attendance_rate: null,
          data_sufficient: acwr.dataSufficient,
          derived_age_group: acwr.ageGroup,
          computed_at: asOf.toISOString(),
        }
      );
    } catch (error) {
      // P-23: Uniformizar para logger.error (antes: console.error)
      logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'readiness_snapshot.player_refresh_failed',
          player_id: player.id,
          session_id: sessionId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
