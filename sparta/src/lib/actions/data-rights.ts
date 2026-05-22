'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'
import { createHash } from 'crypto'

export type ErasureResult = { erased: true }

export type ExportResult = { async: boolean; url?: string }

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/

interface TokenValidationResponse {
  valid: boolean
  playerId?: string
  playerName?: string
  reason?: string
}

interface CacheEntry {
  data: TokenValidationResponse
  expiry: number
}

// Memoization cache for validateToken with 5-minute TTL
const tokenValidationCache = new Map<string, CacheEntry>()

async function callExportCsv(playerId: string): Promise<Result<ExportResult, AppError>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return err({ code: 'internal', message: 'Configuração em falta' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60s timeout

    const response = await fetch(`${supabaseUrl}/functions/v1/export-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ playerId }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error('[data-rights] export-csv failed', { status: response.status })
      return err({ code: 'internal', message: 'Falha ao gerar exportação' })
    }

    const result = await response.json() as { ok: boolean; async: boolean; url?: string }
    if (!result.ok) {
      return err({ code: 'internal', message: 'Erro na geração do ZIP' })
    }

    return ok({ async: result.async, url: result.url })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({ code: 'internal', message: 'Tempo limite excedido na exportação' })
    }
    throw error
  }
}

export async function requestDataExportForSelf(): Promise<Result<ExportResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: player } = await serviceRole
    .from('players')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!player) {
    return err({ code: 'not_found', message: 'Sem registo de jogador para este utilizador' })
  }

  return callExportCsv(player.id as string)
}

async function callEraseCascade(playerId: string, actorId: string): Promise<Result<ErasureResult, AppError>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return err({ code: 'internal', message: 'Configuração em falta' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35000) // 35s — SLA target <30s operacional

    const response = await fetch(`${supabaseUrl}/functions/v1/erase-cascade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ playerId, actorId }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error('[data-rights] erase-cascade failed', { status: response.status })
      return err({ code: 'internal', message: 'Falha no apagamento de dados' })
    }

    let result: { ok: boolean; error?: string }
    try {
      result = await response.json() as { ok: boolean; error?: string }
    } catch (jsonError) {
      console.error('[data-rights] erase-cascade invalid JSON response', { status: response.status })
      return err({ code: 'internal', message: 'Resposta inválida do servidor' })
    }

    if (!result.ok) {
      return err({ code: 'internal', message: 'Erro no apagamento de dados' })
    }

    return ok({ erased: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({ code: 'internal', message: 'Tempo limite excedido no apagamento' })
    }
    throw error
  }
}

export async function requestDataErasureForSelf(): Promise<Result<ErasureResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: player } = await serviceRole
    .from('players')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!player?.id) {
    return err({ code: 'not_found', message: 'Sem registo de jogador para este utilizador' })
  }

  const result = await callEraseCascade(player.id, user.id)

  if (result.ok) {
    // Sign out — invalida sessão local após apagamento da conta
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      // Log but don't fail — user may be already deleted; return success regardless
      console.warn('[data-rights] signOut failed during erasure:', signOutError instanceof Error ? signOutError.message : signOutError)
    }
  }

  return result
}

export async function requestDataExportByToken(token: string): Promise<Result<ExportResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const validation = validationResult.data
  return callExportCsv(validation.playerId as string)
}

async function validateToken(token: string): Promise<Result<TokenValidationResponse, AppError>> {
  if (!TOKEN_PATTERN.test(token)) {
    return err({ code: 'unauthorized', message: 'Token inválido ou expirado' })
  }

  // Check cache (5-minute TTL)
  const cached = tokenValidationCache.get(token)
  if (cached && cached.expiry > Date.now()) {
    return ok(cached.data)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return err({ code: 'internal', message: 'Configuração em falta' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${supabaseUrl}/functions/v1/validate-subject-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error('[data-rights] validate-subject-token failed', { status: response.status })
      return err({ code: 'token_validation_failed', message: 'Falha na validação do token' })
    }

    const validation = await response.json() as TokenValidationResponse

    if (!validation.valid || !validation.playerId || !/^[0-9a-f-]{36}$/i.test(validation.playerId)) {
      return err({ code: 'unauthorized', message: 'Token inválido ou expirado' })
    }

    // Cache the result
    tokenValidationCache.set(token, { data: validation, expiry: Date.now() + 300000 })
    return ok(validation)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({ code: 'token_validation_timeout', message: 'Tempo limite excedido na validação do token' })
    }
    throw error
  }
}

export async function requestDataErasureByToken(token: string): Promise<Result<ErasureResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const validation = validationResult.data
  return callEraseCascade(validation.playerId as string, validation.playerId as string)
}

// =============================================================================
// Story 3.8: Direito de Retificação — Server Action para busca de pendentes
// =============================================================================

export interface PendingRectificationRequest {
  id: string
  player_id: string
  field_name: string
  requested_value: string
  current_value: string | null
  reason: string | null
  created_at: string
  player_name: string
}

export async function getPendingRectifications(): Promise<Result<{ requests: PendingRectificationRequest[]; isStaff: boolean }, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['coach', 'analyst'].includes(profile.role as string)) {
    return ok({ requests: [], isStaff: false })
  }

  const clubId = profile.club_id as string

  const { data: rawRequests, error: reqError } = await serviceRole
    .from('rectification_requests')
    .select('id, player_id, field_name, requested_value, current_value, reason, created_at')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (reqError) {
    return err({ code: 'internal', message: 'Falha ao carregar pedidos' })
  }

  const requests = rawRequests ?? []
  const playerIds = [...new Set(requests.map(r => r.player_id as string))]
  const playerNameMap = new Map<string, string>()

  if (playerIds.length > 0) {
    const { data: players } = await serviceRole
      .from('players')
      .select('id, full_name')
      .in('id', playerIds)

    if (players) {
      for (const p of players as Array<{ id: string; full_name: string }>) {
        playerNameMap.set(p.id, p.full_name)
      }
    }
  }

  const enriched: PendingRectificationRequest[] = requests.map(r => ({
    id: r.id as string,
    player_id: r.player_id as string,
    field_name: r.field_name as string,
    requested_value: r.requested_value as string,
    current_value: (r.current_value as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    created_at: r.created_at as string,
    player_name: playerNameMap.get(r.player_id as string) ?? 'Jogador desconhecido',
  }))

  return ok({ requests: enriched, isStaff: true })
}

// =============================================================================
// Story 3.8: Direito de Retificação
// =============================================================================

export type RectificationResult = { submitted: true; requestId: string }

export type ApproveRectificationResult = { applied: true }

export type RejectRectificationResult = { rejected: true }

export type RectificationPayload = {
  fieldName: 'full_name' | 'birthdate' | 'jersey_num'
  requestedValue: string
  reason?: string
}

const ALLOWED_FIELDS = ['full_name', 'birthdate', 'jersey_num'] as const

function calcAgeGroup(birthdate: Date): string {
  const now = new Date()
  let age = now.getFullYear() - birthdate.getFullYear()
  const hadBirthdayThisYear = now >= new Date(now.getFullYear(), birthdate.getMonth(), birthdate.getDate())
  if (!hadBirthdayThisYear) age--
  if (age <= 14) return 'u14'
  if (age <= 15) return 'u15'
  if (age <= 17) return 'u17'
  if (age <= 19) return 'u19'
  return 'senior'
}

async function sendRectificationNotification(
  playerEmail: string,
  playerName: string,
  fieldLabel: string,
  outcome: 'applied' | 'rejected',
  rejectReason?: string
): Promise<void> {
  const brevoApiKey = process.env.BREVO_API_KEY
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL

  if (!brevoApiKey || !brevoSenderEmail) {
    console.warn('[data-rights] Brevo credentials em falta — email de notificação não enviado')
    return
  }

  const outcomeText = outcome === 'applied'
    ? `O campo "${fieldLabel}" foi atualizado conforme pedido.`
    : `O pedido de correção do campo "${fieldLabel}" foi rejeitado.${rejectReason ? ` Motivo: ${rejectReason}` : ''}`

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Pedido de retificação processado</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Pedido de retificação processado</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    ${playerName}, o teu pedido de retificação de dados pessoais foi processado pelo staff do clube.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-bottom:24px;">${outcomeText}</p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA — Gestão desportiva</p>
</body>
</html>`

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'SPARTA', email: brevoSenderEmail },
        to: [{ email: playerEmail }],
        subject: '[SPARTA] Pedido de retificação processado',
        htmlContent,
      }),
    })
  } catch (emailError) {
    console.warn('[data-rights] Falha ao enviar email de notificação:', emailError instanceof Error ? emailError.message : emailError)
  }
}

export async function submitRectificationRequest(payload: RectificationPayload): Promise<Result<RectificationResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  if (!(ALLOWED_FIELDS as readonly string[]).includes(payload.fieldName)) {
    return err({ code: 'validation', message: 'Campo não permitido' })
  }

  if (!payload.requestedValue || payload.requestedValue.trim().length === 0 || payload.requestedValue.length > 500) {
    return err({ code: 'validation', message: 'Valor inválido (máximo 500 caracteres)' })
  }

  const serviceRole = getServiceRoleClient()

  const { data: player } = await serviceRole
    .from('players')
    .select('id, club_id, full_name, birthdate, jersey_num')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!player?.id) {
    return err({ code: 'not_found', message: 'Sem registo de jogador para este utilizador' })
  }

  const { data: dup } = await serviceRole
    .from('rectification_requests')
    .select('id')
    .eq('player_id', player.id)
    .eq('field_name', payload.fieldName)
    .eq('status', 'pending')
    .maybeSingle()

  if (dup) {
    return err({ code: 'conflict', message: 'Já existe um pedido pendente para este campo' })
  }

  const currentValueMap: Record<string, string | null> = {
    full_name: player.full_name as string | null,
    birthdate: player.birthdate as string | null,
    jersey_num: player.jersey_num != null ? String(player.jersey_num) : null,
  }

  const currentValue = currentValueMap[payload.fieldName] ?? null

  const { data: inserted, error: insertError } = await serviceRole
    .from('rectification_requests')
    .insert({
      club_id: player.club_id,
      player_id: player.id,
      field_name: payload.fieldName,
      requested_value: payload.requestedValue,
      current_value: currentValue,
      reason: payload.reason ?? null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[data-rights] submitRectificationRequest insert error:', insertError?.message)
    return err({ code: 'internal', message: 'Falha ao submeter pedido' })
  }

  return ok({ submitted: true, requestId: inserted.id as string })
}

export async function submitRectificationRequestByToken(token: string, payload: RectificationPayload): Promise<Result<RectificationResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const validation = validationResult.data

  if (!(ALLOWED_FIELDS as readonly string[]).includes(payload.fieldName)) {
    return err({ code: 'validation', message: 'Campo não permitido' })
  }

  if (!payload.requestedValue || payload.requestedValue.trim().length === 0 || payload.requestedValue.length > 500) {
    return err({ code: 'validation', message: 'Valor inválido (máximo 500 caracteres)' })
  }

  const serviceRole = getServiceRoleClient()

  const { data: player } = await serviceRole
    .from('players')
    .select('id, club_id, full_name, birthdate, jersey_num')
    .eq('id', validation.playerId as string)
    .maybeSingle()

  if (!player?.id) {
    return err({ code: 'not_found', message: 'Jogador não encontrado' })
  }

  const { data: dup } = await serviceRole
    .from('rectification_requests')
    .select('id')
    .eq('player_id', player.id)
    .eq('field_name', payload.fieldName)
    .eq('status', 'pending')
    .maybeSingle()

  if (dup) {
    return err({ code: 'conflict', message: 'Já existe um pedido pendente para este campo' })
  }

  const currentValueMap: Record<string, string | null> = {
    full_name: player.full_name as string | null,
    birthdate: player.birthdate as string | null,
    jersey_num: player.jersey_num != null ? String(player.jersey_num) : null,
  }

  const currentValue = currentValueMap[payload.fieldName] ?? null

  const { data: inserted, error: insertError } = await serviceRole
    .from('rectification_requests')
    .insert({
      club_id: player.club_id,
      player_id: player.id,
      field_name: payload.fieldName,
      requested_value: payload.requestedValue,
      current_value: currentValue,
      reason: payload.reason ?? null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[data-rights] submitRectificationRequestByToken insert error:', insertError?.message)
    return err({ code: 'internal', message: 'Falha ao submeter pedido' })
  }

  return ok({ submitted: true, requestId: inserted.id as string })
}

export async function approveRectification(requestId: string): Promise<Result<ApproveRectificationResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  // Verificar papel via service-role (fonte de verdade)
  const serviceRole = getServiceRoleClient()
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['coach', 'analyst'].includes(profile.role as string)) {
    return err({ code: 'forbidden', message: 'Apenas staff pode aprovar retificações' })
  }

  // Carregar request verificando club_id
  const { data: request } = await serviceRole
    .from('rectification_requests')
    .select('id, status, club_id, player_id, field_name, requested_value, current_value')
    .eq('id', requestId)
    .eq('club_id', profile.club_id)
    .maybeSingle()

  if (!request) {
    return err({ code: 'not_found', message: 'Pedido não encontrado' })
  }

  if (request.status !== 'pending') {
    return err({ code: 'validation', message: 'Pedido já processado' })
  }

  const fieldName = request.field_name as string
  const requestedValue = request.requested_value as string
  const playerId = request.player_id as string

  // Aplicar alteração na tabela de origem
  if (fieldName === 'full_name') {
    const { error: updateError } = await serviceRole
      .from('players')
      .update({ full_name: requestedValue })
      .eq('id', playerId)

    if (updateError) {
      console.error('[data-rights] approveRectification full_name update error:', updateError.message)
      return err({ code: 'internal', message: 'Falha ao aplicar retificação' })
    }
  } else if (fieldName === 'birthdate') {
    const parsedDate = new Date(requestedValue)
    if (isNaN(parsedDate.getTime())) {
      return err({ code: 'validation', message: 'Data de nascimento inválida' })
    }
    if (parsedDate.getFullYear() < 1900 || parsedDate > new Date()) {
      return err({ code: 'validation', message: 'Data de nascimento fora do intervalo permitido' })
    }

    const ageGroup = calcAgeGroup(parsedDate)
    const { error: updateError } = await serviceRole
      .from('players')
      .update({ birthdate: requestedValue, age_group: ageGroup })
      .eq('id', playerId)

    if (updateError) {
      console.error('[data-rights] approveRectification birthdate update error:', updateError.message)
      return err({ code: 'internal', message: 'Falha ao aplicar retificação' })
    }
  } else if (fieldName === 'jersey_num') {
    const newJerseyNum = parseInt(requestedValue, 10)
    if (isNaN(newJerseyNum) || newJerseyNum < 1 || newJerseyNum > 99) {
      return err({ code: 'validation', message: 'Número de camisola inválido (1-99)' })
    }

    const { error: updateError } = await serviceRole
      .from('players')
      .update({ jersey_num: newJerseyNum })
      .eq('id', playerId)

    if (updateError) {
      if (updateError.message.includes('idx_players_jersey_club_active') || updateError.code === '23505') {
        return err({ code: 'conflict', message: 'Número de camisola já em uso neste clube' })
      }
      console.error('[data-rights] approveRectification jersey_num update error:', updateError.message)
      return err({ code: 'internal', message: 'Falha ao aplicar retificação' })
    }
  } else {
    return err({ code: 'validation', message: 'Campo não permitido' })
  }

  // Actualizar status do request
  const { error: statusError } = await serviceRole
    .from('rectification_requests')
    .update({
      status: 'applied',
      applied_at: new Date().toISOString(),
      applied_by: user.id,
    })
    .eq('id', requestId)

  if (statusError) {
    console.error('[data-rights] approveRectification status update error:', statusError.message)
    return err({ code: 'internal', message: 'Falha ao actualizar estado do pedido' })
  }

  // Audit log (síncrono — compliance crítico)
  const { error: auditError } = await serviceRole.from('audit_logs').insert({
    club_id: request.club_id as string,
    actor_id: user.id,
    action: 'subject.rectified',
    target_kind: 'player',
    target_id: playerId,
    payload: {
      field: fieldName,
      before: request.current_value as string | null,
      after: requestedValue,
    },
  })

  if (auditError) {
    console.error('[data-rights] audit insert failed:', auditError.message)
    return err({ code: 'internal', message: 'Falha no registo de auditoria' })
  }

  // Obter email do titular para notificação (fire-and-forget)
  const { data: playerProfile } = await serviceRole
    .from('players')
    .select('profile_id, full_name')
    .eq('id', playerId)
    .maybeSingle()

  if (playerProfile?.profile_id) {
    const { data: authUserData } = await serviceRole.auth.admin.getUserById(playerProfile.profile_id as string)
    const playerEmail = authUserData?.user?.email
    const playerName = playerProfile.full_name as string ?? 'Jogador'

    const FIELD_LABELS: Record<string, string> = {
      full_name: 'Nome completo',
      birthdate: 'Data de nascimento',
      jersey_num: 'Número de camisola',
    }
    const fieldLabel = FIELD_LABELS[fieldName] ?? fieldName

    if (playerEmail) {
      void sendRectificationNotification(playerEmail, playerName, fieldLabel, 'applied')
      void serviceRole
        .from('rectification_requests')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', requestId)
    }
  }

  return ok({ applied: true })
}

// =============================================================================
// Story 3.9: Direito de Limitação do Tratamento (RGPD Art. 18 — FR49)
// =============================================================================

export type RestrictionResult = { restricted: boolean; restrictedAt?: string | null }

export async function getRestrictionStatus(): Promise<Result<{ restricted: boolean; restrictedAt: string | null }, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('processing_restricted, restricted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return err({ code: 'not_found', message: 'Perfil não encontrado' })
  }

  return ok({
    restricted: profile.processing_restricted as boolean,
    restrictedAt: (profile.restricted_at as string | null) ?? null,
  })
}

export async function restrictProcessing(): Promise<Result<RestrictionResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()

  const { data: profile } = await serviceRole
    .from('profiles')
    .select('club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return err({ code: 'not_found', message: 'Perfil não encontrado' })
  }

  if (!profile.club_id) {
    return err({ code: 'validation', message: 'Perfil sem clube atribuído' })
  }

  const now = new Date()

  const { error: updateError } = await serviceRole
    .from('profiles')
    .update({ processing_restricted: true, restricted_at: now.toISOString() })
    .eq('id', user.id)

  if (updateError) {
    if (updateError.message.includes('column')) {
      console.error('[data-rights] restrictProcessing schema error:', updateError.message)
      return err({ code: 'schema_mismatch', message: 'Falha ao limitar tratamento (schema)' })
    }
    console.error('[data-rights] restrictProcessing update error:', updateError.message)
    return err({ code: 'internal', message: 'Falha ao limitar tratamento' })
  }

  const { error: auditError } = await serviceRole.from('audit_logs').insert({
    club_id: profile.club_id as string,
    actor_id: user.id,
    action: 'subject.restricted',
    target_kind: 'profile',
    target_id: user.id,
    payload: { restricted_at: now.toISOString() },
  })

  if (auditError) {
    console.error('[data-rights] restrictProcessing audit insert error:', auditError.message)
    return err({ code: 'internal', message: 'Falha no registo de auditoria' })
  }

  return ok({ restricted: true, restrictedAt: now.toISOString() })
}

export async function unrestrictProcessing(): Promise<Result<RestrictionResult, AppError>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()

  const { data: profile } = await serviceRole
    .from('profiles')
    .select('club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return err({ code: 'not_found', message: 'Perfil não encontrado' })
  }

  if (!profile.club_id) {
    return err({ code: 'validation', message: 'Perfil sem clube atribuído' })
  }

  const now = new Date()

  const { error: updateError } = await serviceRole
    .from('profiles')
    .update({ processing_restricted: false, restricted_at: null })
    .eq('id', user.id)

  if (updateError) {
    console.error('[data-rights] unrestrictProcessing update error:', updateError.message)
    return err({ code: 'internal', message: 'Falha ao remover limitação' })
  }

  const { error: auditError } = await serviceRole.from('audit_logs').insert({
    club_id: profile.club_id as string,
    actor_id: user.id,
    action: 'subject.unrestricted',
    target_kind: 'profile',
    target_id: user.id,
    payload: { unrestricted_at: now.toISOString() },
  })

  if (auditError) {
    console.error('[data-rights] unrestrictProcessing audit insert error:', auditError.message)
    return err({ code: 'internal', message: 'Falha no registo de auditoria' })
  }

  return ok({ restricted: false, restrictedAt: null })
}

export async function restrictProcessingByToken(token: string): Promise<Result<RestrictionResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const validation = validationResult.data
  const playerId = validation.playerId as string

  const serviceRole = getServiceRoleClient()

  const { data: player } = await serviceRole
    .from('players')
    .select('club_id')
    .eq('id', playerId)
    .maybeSingle()

  if (!player) {
    return err({ code: 'not_found', message: 'Jogador não encontrado' })
  }

  if (!player.club_id) {
    return err({ code: 'validation', message: 'Jogador sem clube atribuído' })
  }

  const now = new Date()

  const { error: updateError } = await serviceRole
    .from('players')
    .update({ processing_restricted: true, restricted_at: now.toISOString() })
    .eq('id', playerId)

  if (updateError) {
    console.error('[data-rights] restrictProcessingByToken update error:', updateError.message)
    return err({ code: 'internal', message: 'Falha ao limitar tratamento' })
  }

  // Embed token fingerprint in audit payload for identification
  const tokenFingerprint = createHash('sha256').update(token).digest('hex').slice(0, 16)

  const { error: auditError } = await serviceRole.from('audit_logs').insert({
    club_id: player.club_id as string,
    actor_id: null,
    action: 'subject.restricted',
    target_kind: 'player',
    target_id: playerId,
    payload: { restricted_at: now.toISOString(), token_fingerprint: tokenFingerprint },
  })

  if (auditError) {
    console.error('[data-rights] restrictProcessingByToken audit insert error:', auditError.message)
    return err({ code: 'internal', message: 'Falha no registo de auditoria' })
  }

  return ok({ restricted: true, restrictedAt: now.toISOString() })
}

export async function unrestrictProcessingByToken(token: string): Promise<Result<RestrictionResult, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    return validationResult
  }

  const validation = validationResult.data
  const playerId = validation.playerId as string

  const serviceRole = getServiceRoleClient()

  const { data: player } = await serviceRole
    .from('players')
    .select('club_id')
    .eq('id', playerId)
    .maybeSingle()

  if (!player) {
    return err({ code: 'not_found', message: 'Jogador não encontrado' })
  }

  if (!player.club_id) {
    return err({ code: 'validation', message: 'Jogador sem clube atribuído' })
  }

  const now = new Date()

  const { error: updateError } = await serviceRole
    .from('players')
    .update({ processing_restricted: false, restricted_at: null })
    .eq('id', playerId)

  if (updateError) {
    console.error('[data-rights] unrestrictProcessingByToken update error:', updateError.message)
    return err({ code: 'internal', message: 'Falha ao remover limitação' })
  }

  // Embed token fingerprint in audit payload for identification
  const tokenFingerprint = createHash('sha256').update(token).digest('hex').slice(0, 16)

  const { error: auditError } = await serviceRole.from('audit_logs').insert({
    club_id: player.club_id as string,
    actor_id: null,
    action: 'subject.unrestricted',
    target_kind: 'player',
    target_id: playerId,
    payload: { unrestricted_at: now.toISOString(), token_fingerprint: tokenFingerprint },
  })

  if (auditError) {
    console.error('[data-rights] unrestrictProcessingByToken audit insert error:', auditError.message)
    return err({ code: 'internal', message: 'Falha no registo de auditoria' })
  }

  return ok({ restricted: false, restrictedAt: null })
}

export async function getPlayerRestrictionStatus(token: string): Promise<Result<{ restricted: boolean; restrictedAt?: string | null }, AppError>> {
  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    // Expose different error codes for timeout vs invalid token
    return validationResult
  }

  const playerId = validationResult.data.playerId as string
  const serviceRole = getServiceRoleClient()

  const { data: player } = await serviceRole
    .from('players')
    .select('processing_restricted, restricted_at')
    .eq('id', playerId)
    .maybeSingle()

  return ok({
    restricted: (player?.processing_restricted as boolean | null | undefined) === true,
    restrictedAt: (player?.restricted_at as string | null | undefined) ?? null,
  })
}

export async function checkProcessingRestricted(playerId: string): Promise<boolean> {
  const serviceRole = getServiceRoleClient()
  const { data: player } = await serviceRole
    .from('players')
    .select('processing_restricted')
    .eq('id', playerId)
    .maybeSingle()

  return (player?.processing_restricted as boolean | null | undefined) === true
}

export async function rejectRectification(requestId: string, reason: string): Promise<Result<RejectRectificationResult, AppError>> {
  if (!reason || reason.trim().length === 0 || reason.length > 1000) {
    return err({ code: 'validation', message: 'Motivo obrigatório (máx. 1000 caracteres)' })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const serviceRole = getServiceRoleClient()
  const { data: profile } = await serviceRole
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['coach', 'analyst'].includes(profile.role as string)) {
    return err({ code: 'forbidden', message: 'Apenas staff pode rejeitar retificações' })
  }

  const { data: request } = await serviceRole
    .from('rectification_requests')
    .select('id, status, club_id, player_id, field_name')
    .eq('id', requestId)
    .eq('club_id', profile.club_id)
    .maybeSingle()

  if (!request) {
    return err({ code: 'not_found', message: 'Pedido não encontrado' })
  }

  if (request.status !== 'pending') {
    return err({ code: 'validation', message: 'Pedido já processado' })
  }

  const { error: rejectError } = await serviceRole
    .from('rectification_requests')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: user.id,
      reject_reason: reason,
    })
    .eq('id', requestId)

  if (rejectError) {
    console.error('[data-rights] rejectRectification update error:', rejectError.message)
    return err({ code: 'internal', message: 'Falha ao rejeitar pedido' })
  }

  // Notificar titular (fire-and-forget)
  const { data: playerProfile } = await serviceRole
    .from('players')
    .select('profile_id, full_name')
    .eq('id', request.player_id)
    .maybeSingle()

  if (playerProfile?.profile_id) {
    const { data: authUserData } = await serviceRole.auth.admin.getUserById(playerProfile.profile_id as string)
    const playerEmail = authUserData?.user?.email
    const playerName = playerProfile.full_name as string ?? 'Jogador'

    const FIELD_LABELS: Record<string, string> = {
      full_name: 'Nome completo',
      birthdate: 'Data de nascimento',
      jersey_num: 'Número de camisola',
    }
    const fieldLabel = FIELD_LABELS[request.field_name as string] ?? (request.field_name as string)

    if (playerEmail) {
      void sendRectificationNotification(playerEmail, playerName, fieldLabel, 'rejected', reason)
      void serviceRole
        .from('rectification_requests')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', requestId)
    }
  }

  return ok({ rejected: true })
}
