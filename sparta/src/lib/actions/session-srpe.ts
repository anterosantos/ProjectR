'use server'

import { err, ok } from '@/lib/types'
import type { Result, AppError } from '@/lib/types'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { requireStaffRole } from '@/lib/actions/auth'
import { UpsertSessionSrpeInputSchema, type UpsertSessionSrpeInput, type PlayerSrpeEntry } from '@/lib/schemas/session-srpe'
import { refreshSnapshotForSession } from '@/lib/readiness/snapshot'
import { isSrpeInputValid } from '@/lib/readiness/srpe'
import { logger } from '@/lib/logger'
import { auditedRead } from '@/lib/data/audited'
export async function getSessionSrpeData(
  sessionId: string
): Promise<Result<{ players: PlayerSrpeEntry[]; duration_min: number }, AppError>> {
  try {
    const authResult = await requireStaffRole()
    if (!authResult.ok) return authResult

    const { userId, clubId } = authResult.data
    const serviceRole = getServiceRoleClient()

    // Fetch session
    const { data: session, error: sessionError } = await serviceRole
      .from('sessions')
      .select('id, club_id, duration_min, scheduled_at')
      .eq('id', sessionId)
      .eq('club_id', clubId)
      .maybeSingle()

    if (sessionError || !session) {
      return err({ code: 'not_found', message: 'Sessão não encontrada' })
    }

    // Parallel fetch of all required data
    const [
      { data: players = [], error: playersError },
      { data: attendances = [], error: attendancesError },
      { data: metrics = [], error: metricsError },
      { data: fatigueResponses = [], error: fatigueError },
    ] = await Promise.all([
      // 1) Active players
      serviceRole
        .from('players')
        .select('id, full_name, jersey_num, is_active')
        .eq('club_id', clubId)
        .eq('is_archived', false)
        .order('full_name'),
      // 2) Attendance records for this session
      serviceRole
        .from('attendances')
        .select('player_id, status')
        .eq('session_id', sessionId)
        .eq('club_id', clubId),
      // 3) Existing session_metrics (analyst-recorded sRPE) — auditedRead per FR50
      auditedRead(
        { targetKind: 'session_metrics', targetId: sessionId, action: 'srpe.data_read', actorId: userId, clubId },
        // eslint-disable-next-line custom/no-direct-health-data-read
        async () => serviceRole.from('session_metrics').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId)
      ),
      // 4) Player-submitted sRPE via fatigue_responses (post-session) — auditedRead per FR50
      auditedRead(
        { targetKind: 'fatigue_responses', targetId: sessionId, action: 'srpe.data_read', actorId: userId, clubId },
        // eslint-disable-next-line custom/no-direct-health-data-read
        async () => serviceRole.from('fatigue_responses').select('player_id, srpe_value').eq('session_id', sessionId).eq('club_id', clubId).eq('phase', 'post').not('srpe_value', 'is', null)
      ),
    ])

    if (playersError || attendancesError || metricsError || fatigueError) {
      return err({ code: 'database_error', message: 'Erro ao carregar dados' })
    }

    const playerList = players ?? []
    const attendanceList = attendances ?? []
    const metricsList = metrics ?? []
    const fatigueList = fatigueResponses ?? []

    // Fetch primary positions (two-step)
    const playerIds = playerList.map((p) => p.id)
    let positionsMap: Record<string, string | null> = {}

    if (playerIds.length > 0) {
      const { data: positions = [] } = await serviceRole
        .from('positions')
        .select('player_id, position')
        .in('player_id', playerIds)
        .eq('is_primary', true)

      positionsMap = Object.fromEntries((positions ?? []).map((p) => [p.player_id, p.position]))
    }

    // Build maps for lookups
    const attendanceMap = new Map(attendanceList.map((a) => [a.player_id, a.status]))
    const metricsMap = new Map(metricsList.map((m) => [m.player_id, m.srpe_value]))
    const fatigueMap = new Map(fatigueList.map((f) => [f.player_id, f.srpe_value]))

    // Map players to entries
    const entries: PlayerSrpeEntry[] = playerList.map((player) => ({
      player_id: player.id,
      full_name: player.full_name,
      jersey_num: player.jersey_num ?? null,
      primary_position: positionsMap[player.id] ?? null,
      is_active: player.is_active,
      attendance_status: (attendanceMap.get(player.id) ?? null) as PlayerSrpeEntry['attendance_status'],
      existing_analyst_srpe: metricsMap.get(player.id) ?? null,
      player_submitted_srpe: fatigueMap.get(player.id) ?? null,
    }))

    return ok({
      players: entries,
      duration_min: session.duration_min ?? 90,
    })
  } catch (error) {
    logger.error('getSessionSrpeData.error', { error: error instanceof Error ? error.message : String(error) })
    return err({ code: 'internal_error', message: 'Erro interno ao carregar dados' })
  }
}

export async function upsertSessionSrpe(input: unknown): Promise<Result<undefined, AppError>> {
  try {
    const validated = UpsertSessionSrpeInputSchema.safeParse(input)
    if (!validated.success) {
      return err({ code: 'validation', message: 'Dados de entrada inválidos' })
    }

    const authResult = await requireStaffRole()
    if (!authResult.ok) return authResult

    const { userId, clubId } = authResult.data
    const serviceRole = getServiceRoleClient()

    // Verify session exists and belongs to club
    const { data: session, error: sessionError } = await serviceRole
      .from('sessions')
      .select('id, club_id, duration_min')
      .eq('id', validated.data.session_id)
      .eq('club_id', clubId)
      .maybeSingle()

    if (sessionError || !session) {
      return err({ code: 'not_found', message: 'Sessão não encontrada' })
    }

    // Verify player exists and belongs to club
    const { data: player, error: playerError } = await serviceRole
      .from('players')
      .select('id, club_id')
      .eq('id', validated.data.player_id)
      .eq('club_id', clubId)
      .maybeSingle()

    if (playerError || !player) {
      return err({ code: 'not_found', message: 'Jogador não encontrado' })
    }

    // Guard: cannot record sRPE for absent players (defence-in-depth, AC#3)
    const { data: attendanceRecord } = await serviceRole
      .from('attendances')
      .select('status')
      .eq('session_id', validated.data.session_id)
      .eq('player_id', validated.data.player_id)
      .maybeSingle()

    if (attendanceRecord?.status === 'absent') {
      return err({ code: 'validation', message: 'Jogador ausente — sRPE não pode ser registado' })
    }

    // Use session duration_min as source of truth
    const durationMin = session.duration_min ?? validated.data.duration_min

    // Validate sRPE input
    if (!isSrpeInputValid(validated.data.srpe_value, durationMin)) {
      return err({ code: 'validation', message: 'sRPE ou duração fora do intervalo válido' })
    }

    // Upsert session_metrics
    const { error: upsertError } = await serviceRole.from('session_metrics').upsert(
      {
        id: validated.data.id,
        club_id: clubId,
        session_id: validated.data.session_id,
        player_id: validated.data.player_id,
        srpe_value: validated.data.srpe_value,
        duration_min: durationMin,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,player_id', ignoreDuplicates: false }
    )

    if (upsertError) {
      return err({ code: 'database_error', message: 'Erro ao gravar sRPE' })
    }

    // Fire-and-forget audit log
    void (async () => {
      try {
        await serviceRole.from('audit_logs').insert({
          actor_id: userId,
          action: 'srpe.recorded',
          target_kind: 'session',
          target_id: validated.data.session_id,
          club_id: clubId,
          payload: {
            source: 'analyst',
            player_id: validated.data.player_id,
            srpe_value: validated.data.srpe_value,
            duration_min: durationMin,
          },
        })
      } catch (e) {
        logger.error('session_srpe.audit_log_failed', {
          error: e instanceof Error ? e.message : String(e),
        })
      }
    })()

    // Fire-and-forget readiness refresh
    void (async () => {
      try {
        await refreshSnapshotForSession(serviceRole, validated.data.session_id)
      } catch (e) {
        logger.error('session_srpe.readiness_refresh_failed', {
          session_id: validated.data.session_id,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    })()

    return ok(undefined)
  } catch (error) {
    logger.error('upsertSessionSrpe.error', { error: error instanceof Error ? error.message : String(error) })
    return err({ code: 'internal_error', message: 'Erro ao gravar sRPE' })
  }
}
