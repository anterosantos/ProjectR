'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'
import { validateToken } from '@/lib/actions/data-rights'

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  target_kind: string
  target_id: string | null
  occurred_at: string
  payload?: Record<string, unknown> | null
}

export interface ActorInfo {
  full_name: string
  role: string
}

export interface AuditVisibilityResult {
  entries: AuditLogEntry[]
  actorMap: Record<string, ActorInfo>
  totalCount: number
  hasMore: boolean
}

// =============================================================================
// Titular (authenticated) — can only see own logs (RLS enforces target_id = auth.uid())
// =============================================================================

export async function getAuditLogForSubject(
  subjectId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<Result<AuditVisibilityResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  if (user.id !== subjectId) {
    return err({ code: 'forbidden', message: 'Sem permissão para ver estes registos' })
  }

  return fetchAuditLogs(subjectId, page, pageSize, /* useServiceRole */ false)
}

// =============================================================================
// Encarregado (token-based) — service-role bypasses RLS, token validates child linkage
// =============================================================================

export async function getAuditLogForSubjectByToken(
  token: string,
  page: number = 1,
  pageSize: number = 50
): Promise<Result<AuditVisibilityResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const playerId = validationResult.data.playerId as string

  // Resolve player → profile_id (the uuid stored as target_id in audit_logs for player-based entries)
  const serviceRole = getServiceRoleClient()
  const { data: player } = await serviceRole
    .from('players')
    .select('id, profile_id')
    .eq('id', playerId)
    .maybeSingle()

  if (!player) {
    return err({ code: 'not_found', message: 'Jogador não encontrado' })
  }

  // audit_logs.target_id can be either player.id or player.profile_id depending on context.
  // We query by player.id (used in most health-data writes) AND profile_id to cover both.
  return fetchAuditLogsForPlayer(playerId, player.profile_id as string | null, page, pageSize)
}

// =============================================================================
// Internal helpers
// =============================================================================

async function fetchAuditLogs(
  subjectId: string,
  page: number,
  pageSize: number,
  _useServiceRole: boolean
): Promise<Result<AuditVisibilityResult, AppError>> {
  // For the titular route the authenticated client is used — RLS automatically
  // restricts to rows where target_id = auth.uid() and role = 'player'.
  const supabase = await createServerClient()

  const offset = (page - 1) * pageSize
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: rows, error: fetchError, count } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, target_kind, target_id, occurred_at, payload', { count: 'exact' })
    .eq('target_id', subjectId)
    .gte('occurred_at', twelveMonthsAgo.toISOString())
    .order('occurred_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (fetchError) {
    console.error('[audit-visibility] fetchAuditLogs error:', fetchError.message)
    return err({ code: 'internal', message: 'Falha ao carregar registos de acesso' })
  }

  const entries = (rows ?? []).map(rowToEntry)
  const totalCount = count ?? 0

  const actorMap = await buildActorMap(entries)

  return ok({
    entries,
    actorMap,
    totalCount,
    hasMore: offset + entries.length < totalCount,
  })
}

async function fetchAuditLogsForPlayer(
  playerId: string,
  profileId: string | null,
  page: number,
  pageSize: number
): Promise<Result<AuditVisibilityResult, AppError>> {
  const serviceRole = getServiceRoleClient()
  const offset = (page - 1) * pageSize
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  // Collect all target_ids that might belong to this player
  const targetIds: string[] = [playerId]
  if (profileId) targetIds.push(profileId)

  const { data: rows, error: fetchError, count } = await serviceRole
    .from('audit_logs')
    .select('id, actor_id, action, target_kind, target_id, occurred_at, payload', { count: 'exact' })
    .in('target_id', targetIds)
    .gte('occurred_at', twelveMonthsAgo.toISOString())
    .order('occurred_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (fetchError) {
    console.error('[audit-visibility] fetchAuditLogsForPlayer error:', fetchError.message)
    return err({ code: 'internal', message: 'Falha ao carregar registos de acesso' })
  }

  const entries = (rows ?? []).map(rowToEntry)
  const totalCount = count ?? 0

  const actorMap = await buildActorMap(entries)

  return ok({
    entries,
    actorMap,
    totalCount,
    hasMore: offset + entries.length < totalCount,
  })
}

function rowToEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    actor_id: (row.actor_id as string | null) ?? null,
    action: row.action as string,
    target_kind: row.target_kind as string,
    target_id: (row.target_id as string | null) ?? null,
    occurred_at: row.occurred_at as string,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
  }
}

async function buildActorMap(entries: AuditLogEntry[]): Promise<Record<string, ActorInfo>> {
  const actorIds = [...new Set(entries.map(e => e.actor_id).filter((id): id is string => id !== null))]

  if (actorIds.length === 0) {
    return {}
  }

  const serviceRole = getServiceRoleClient()
  const { data: profiles } = await serviceRole
    .from('profiles')
    .select('id, full_name, role')
    .in('id', actorIds)

  const actorMap: Record<string, ActorInfo> = {}
  for (const profile of profiles ?? []) {
    const id = profile.id as string
    actorMap[id] = {
      full_name: (profile.full_name as string | null) ?? 'Utilizador desconhecido',
      role: (profile.role as string | null) ?? 'staff',
    }
  }

  return actorMap
}
