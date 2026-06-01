'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'
import type { ConsentReconfirmation } from '@/lib/schemas/reconfirmation'

// =============================================================================
// Auth helper — players only
// =============================================================================

async function getAuthenticatedPlayer(): Promise<
  Result<{ userId: string; clubId: string }, AppError>
> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Autenticação necessária.' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'player') {
    return err({ code: 'forbidden', message: 'Acesso restrito a jogadores.' })
  }

  if (!profile.club_id) {
    return err({ code: 'forbidden', message: 'Clube não atribuído.' })
  }

  return ok({ userId: user.id, clubId: profile.club_id as string })
}

// =============================================================================
// getReconfirmationByToken
// Used by the Server Component to load the page.
// =============================================================================

export async function getReconfirmationByToken(
  token: string
): Promise<Result<ConsentReconfirmation, AppError>> {
  const authResult = await getAuthenticatedPlayer()
  if (!authResult.ok) return authResult

  const { userId } = authResult.data

  const serviceRole = getServiceRoleClient()
  const { data: reconfirmation, error } = await serviceRole
    .from('consent_reconfirmations')
    .select('id, club_id, player_id, profile_id, token, status, created_at, confirmed_at, anonymized_at')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    logger.error('reconfirmation.getByToken.db_error', { error: error.message })
    return err({ code: 'internal', message: 'Falha ao carregar pedido de reconfirmação.' })
  }

  if (!reconfirmation) {
    return err({ code: 'not_found', message: 'Pedido de reconfirmação não encontrado.' })
  }

  if ((reconfirmation.profile_id as string) !== userId) {
    return err({ code: 'not_found', message: 'Pedido de reconfirmação não encontrado.' })
  }

  return ok(reconfirmation as ConsentReconfirmation)
}

// =============================================================================
// confirmReconfirmation
// Player confirms their own consent.
// =============================================================================

export async function confirmReconfirmation(
  token: string
): Promise<Result<undefined, AppError>> {
  const authResult = await getAuthenticatedPlayer()
  if (!authResult.ok) return authResult

  const { userId, clubId } = authResult.data

  const serviceRole = getServiceRoleClient()
  const { data: reconfirmation, error: fetchError } = await serviceRole
    .from('consent_reconfirmations')
    .select('id, player_id, profile_id, status')
    .eq('token', token)
    .maybeSingle()

  if (fetchError) {
    logger.error('reconfirmation.confirm.db_error', { error: fetchError.message })
    return err({ code: 'internal', message: 'Falha ao validar pedido.' })
  }

  if (!reconfirmation) {
    return err({ code: 'not_found', message: 'Pedido de reconfirmação não encontrado.' })
  }

  if ((reconfirmation.profile_id as string) !== userId) {
    return err({ code: 'unauthorized', message: 'Não tens permissão para confirmar este pedido.' })
  }

  if (reconfirmation.status !== 'pending') {
    return err({ code: 'conflict', message: 'Este pedido já foi processado.' })
  }

  // Atomic update: only succeeds if status still pending (race condition guard)
  const { error: updateError, count } = await serviceRole
    .from('consent_reconfirmations')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', reconfirmation.id)
    .eq('status', 'pending') // Double-check: prevent TOCTOU race

  if (count === 0) {
    // Another request updated this row between our read and write
    return err({ code: 'conflict', message: 'Este pedido foi processado por outro dispositivo.' })
  }

  if (updateError) {
    logger.error('reconfirmation.confirm.update_error', { error: updateError.message })
    return err({ code: 'internal', message: 'Falha ao confirmar consentimento.' })
  }

  const playerId = reconfirmation.player_id as string
  const reconfirmationId = reconfirmation.id as string

  void (async () => {
    try {
      await serviceRole.from('audit_logs').insert({
        club_id: clubId,
        actor_id: userId,
        action: 'consent.self_confirmed_at_18',
        target_kind: 'player',
        target_id: playerId,
        payload: { reconfirmation_id: reconfirmationId },
      })
    } catch (e) {
      logger.error('reconfirmation.confirm.audit_log_failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  })()

  return ok(undefined)
}

// =============================================================================
// eraseDataViaReconfirmation
// Player requests immediate erasure from the reconfirmation page.
// Triggers Story 3.7 erase-cascade Edge Function.
// =============================================================================

export async function eraseDataViaReconfirmation(
  token: string
): Promise<Result<undefined, AppError>> {
  const authResult = await getAuthenticatedPlayer()
  if (!authResult.ok) return authResult

  const { userId, clubId } = authResult.data

  const serviceRole = getServiceRoleClient()
  const { data: reconfirmation, error: fetchError } = await serviceRole
    .from('consent_reconfirmations')
    .select('id, player_id, profile_id, status')
    .eq('token', token)
    .maybeSingle()

  if (fetchError) {
    logger.error('reconfirmation.erase.db_error', { error: fetchError.message })
    return err({ code: 'internal', message: 'Falha ao validar pedido.' })
  }

  if (!reconfirmation) {
    return err({ code: 'not_found', message: 'Pedido de reconfirmação não encontrado.' })
  }

  if ((reconfirmation.profile_id as string) !== userId) {
    return err({ code: 'unauthorized', message: 'Não tens permissão para apagar estes dados.' })
  }

  if (reconfirmation.status !== 'pending') {
    return err({ code: 'conflict', message: 'Este pedido já foi processado.' })
  }

  const playerId = reconfirmation.player_id as string
  const reconfirmationId = reconfirmation.id as string

  // Trigger Story 3.7 cascade erasure (full delete, not PII-only anonymization)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return err({ code: 'internal', message: 'Configuração em falta.' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35000)

    let response: Response
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/erase-cascade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ playerId, actorId: userId }),
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeout)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logger.error('reconfirmation.erase.timeout', { timeout_ms: 35000 })
        return err({ code: 'internal', message: 'Tempo limite excedido no apagamento.' })
      }
      logger.error('reconfirmation.erase.fetch_error', { error: fetchError instanceof Error ? fetchError.message : String(fetchError) })
      return err({ code: 'internal', message: 'Erro de conectividade no apagamento.' })
    }

    clearTimeout(timeout)

    if (!response.ok) {
      logger.error('reconfirmation.erase.cascade_failed', { status: response.status })
      return err({ code: 'internal', message: 'Falha no apagamento de dados.' })
    }

    let result: { ok: boolean; error?: string }
    try {
      result = await response.json() as { ok: boolean; error?: string }
    } catch {
      return err({ code: 'internal', message: 'Resposta inválida do servidor.' })
    }

    if (!result.ok) {
      return err({ code: 'internal', message: 'Erro no apagamento de dados.' })
    }
  } catch (error) {
    logger.error('reconfirmation.erase.unexpected_error', { error: error instanceof Error ? error.message : String(error) })
    return err({ code: 'internal', message: 'Erro inesperado no apagamento de dados.' })
  }

  // Mark reconfirmation row as anonymized (only if status still pending — race condition guard)
  const { error: markError, count: markCount } = await serviceRole
    .from('consent_reconfirmations')
    .update({ status: 'anonymized', anonymized_at: new Date().toISOString() })
    .eq('id', reconfirmationId)
    .eq('status', 'pending')

  if (markError) {
    logger.error('reconfirmation.erase.mark_anonymized_error', { error: markError.message })
    // Non-fatal: erase-cascade already ran, just log the update failure
  }

  if (markCount === 0) {
    // Status changed between cascade and mark (unlikely but possible under contention)
    logger.warn('reconfirmation.erase.status_changed_after_cascade', { reconfirmationId })
  }

  void (async () => {
    try {
      await serviceRole.from('audit_logs').insert({
        club_id: clubId,
        actor_id: userId,
        action: 'consent.self_erased_at_18',
        target_kind: 'player',
        target_id: playerId,
        payload: { reconfirmation_id: reconfirmationId },
      })
    } catch (e) {
      logger.error('reconfirmation.erase.audit_log_failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  })()

  return ok(undefined)
}
