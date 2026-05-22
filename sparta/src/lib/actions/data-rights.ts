'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'

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

export async function requestDataExportByToken(token: string): Promise<Result<ExportResult, AppError>> {
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
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout for token validation

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

    if (!validation.valid || !validation.playerId) {
      return err({ code: 'unauthorized', message: 'Token inválido ou expirado' })
    }

    return callExportCsv(validation.playerId)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err({ code: 'internal', message: 'Tempo limite excedido na validação do token' })
    }
    throw error
  }
}
