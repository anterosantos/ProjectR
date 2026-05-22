'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'

export type ErasureResult = { erased: true }

export type ExportResult = { async: boolean; url?: string }

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/

interface TokenValidationResponse {
  valid: boolean
  playerId?: string
  playerName?: string
  reason?: string
}

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
      return err({ code: 'internal', message: 'Falha na validação do token' })
    }

    const validation = await response.json() as TokenValidationResponse

    if (!validation.valid || !validation.playerId || !/^[0-9a-f-]{36}$/i.test(validation.playerId)) {
      return err({ code: 'unauthorized', message: 'Token inválido ou expirado' })
    }

    return ok(validation)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({ code: 'internal', message: 'Tempo limite excedido na validação do token' })
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
