'use server'

import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Result, AppError } from '@/lib/types'
import { ok, err } from '@/lib/types'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema para validar o objecto PushSubscription enviado pelo browser.
 * Formato: { endpoint: URL, keys: { p256dh: string, auth: string } }
 */
const PushSubscriptionSchema = z.object({
  endpoint: z.string().url('endpoint deve ser uma URL válida'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh é obrigatório'),
    auth: z.string().min(1, 'auth é obrigatório'),
  }),
})

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>

export type SubscribeResult = { activated_at: string }
export type UnsubscribeResult = { deactivated: true }
export type DeactivateResult = { deactivated: true }

// ---------------------------------------------------------------------------
// subscribeToNotifications
// ---------------------------------------------------------------------------

/**
 * Regista ou actualiza uma subscrição Web Push para o jogador autenticado.
 *
 * - Valida o payload via Zod (endpoint URL + keys p256dh/auth)
 * - Faz upsert na tabela push_subscriptions (por profile_id + endpoint)
 * - Se a subscrição já existe: actualiza keys_json e repõe is_active=true
 * - Se é nova: insere com club_id + profile_id do utilizador autenticado
 *
 * Chamada pelo Client Component NotificationsSettings após concessão de
 * permissão pelo browser.
 */
export async function subscribeToNotifications(
  subscription: unknown
): Promise<Result<SubscribeResult, AppError>> {
  // 1. Validar payload
  const parsed = PushSubscriptionSchema.safeParse(subscription)
  if (!parsed.success) {
    return err({
      code: 'validation',
      message: parsed.error.issues[0]?.message ?? 'Subscrição inválida',
      details: { issues: parsed.error.issues },
    })
  }

  const { endpoint, keys } = parsed.data

  // 2. Autenticação
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const profile_id = user.id

  // 3. Obter club_id do perfil
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', profile_id)
    .single()

  if (profileError || !profileData?.club_id) {
    console.error('[push] subscribeToNotifications: perfil não encontrado', {
      profile_id,
      error: profileError?.message,
    })
    return err({ code: 'internal', message: 'Perfil não encontrado' })
  }

  const club_id = profileData.club_id

  // 4. Upsert — se (profile_id, endpoint) já existe, actualizar keys + is_active
  const now = new Date().toISOString()
  const { error: upsertError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        profile_id,
        club_id,
        endpoint,
        keys_json: keys,
        is_active: true,
        // created_at não é incluído para preservar o valor original no conflito
      },
      {
        onConflict: 'profile_id,endpoint',
        ignoreDuplicates: false,
      }
    )

  if (upsertError) {
    console.error('[push] subscribeToNotifications: upsert falhou', {
      error: upsertError.message,
      profile_id,
      endpoint_prefix: endpoint.substring(0, 60),
    })
    return err({ code: 'internal', message: 'Erro ao activar notificações' })
  }

  // 5. Telemetria (fire-and-forget, falha silenciosa)
  supabase
    .from('telemetry_events')
    .insert({
      club_id,
      kind: 'push_subscribed',
      payload_json: { profile_id },
    })
    .then(({ error }) => {
      if (error) {
        console.error('[push] telemetry push_subscribed falhou', { error: error.message })
      }
    })

  return ok({ activated_at: now })
}

// ---------------------------------------------------------------------------
// unsubscribeFromNotifications
// ---------------------------------------------------------------------------

/**
 * Desactiva todas as subscrições push do jogador autenticado (is_active=false).
 *
 * - Não apaga linhas (audit trail preservado)
 * - Não invalida a sessão do jogador
 * - A remoção client-side da subscrição do browser é feita pelo Client Component
 *
 * AC #5: tolerant degradation — se o lado cliente falhar, is_active=false é
 * garantido no servidor.
 */
export async function unsubscribeFromNotifications(): Promise<
  Result<UnsubscribeResult, AppError>
> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const profile_id = user.id

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('profile_id', profile_id)

  if (error) {
    console.error('[push] unsubscribeFromNotifications: falhou', {
      error: error.message,
      profile_id,
    })
    return err({ code: 'internal', message: 'Erro ao desactivar notificações' })
  }

  // Telemetria (fire-and-forget)
  supabase
    .from('profiles')
    .select('club_id')
    .eq('id', profile_id)
    .single()
    .then(({ data: profile }) => {
      if (profile?.club_id) {
        supabase
          .from('telemetry_events')
          .insert({
            club_id: profile.club_id,
            kind: 'push_unsubscribed',
            payload_json: { profile_id },
          })
          .then(({ error: telErr }) => {
            if (telErr) {
              console.error('[push] telemetry push_unsubscribed falhou', { error: telErr.message })
            }
          })
      }
    })

  return ok({ deactivated: true })
}

// ---------------------------------------------------------------------------
// deactivateExpiredSubscription
// ---------------------------------------------------------------------------

/**
 * Desactiva uma subscrição expirada pelo endpoint.
 *
 * Chamada pela Edge Function send-push (Story 4.8) quando recebe HTTP 410 Gone
 * do serviço Web Push — indica que o browser revogou a subscrição.
 *
 * AC #6: logs para stdout com profile_id (sem PII no endpoint).
 */
export async function deactivateExpiredSubscription(
  endpoint: string
): Promise<Result<DeactivateResult, AppError>> {
  if (!endpoint || typeof endpoint !== 'string') {
    return err({ code: 'validation', message: 'endpoint inválido' })
  }

  const supabase = await createServerClient()

  // Buscar o profile_id antes de desactivar (para logging)
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('profile_id')
    .eq('endpoint', endpoint)
    .maybeSingle()

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('endpoint', endpoint)

  if (error) {
    console.error('[push] deactivateExpiredSubscription: falhou', {
      error: error.message,
      endpoint_prefix: endpoint.substring(0, 60),
    })
    return err({ code: 'internal', message: error.message })
  }

  // Log estruturado para audit (sem PII no endpoint, audit via profile_id)
  console.log(
    JSON.stringify({
      event: 'push_subscription_expired',
      endpoint_prefix: endpoint.substring(0, 60),
      profile_id: existing?.profile_id ?? 'unknown',
    })
  )

  return ok({ deactivated: true })
}

// ---------------------------------------------------------------------------
// getPushSubscriptionStatus (helper para UI)
// ---------------------------------------------------------------------------

/**
 * Retorna o estado da subscrição push do jogador autenticado.
 * Usado pelo Client Component para mostrar "Ativo desde X" ou "Inativo".
 */
export type PushSubscriptionStatus = {
  is_active: boolean
  created_at: string | null
  last_used_at: string | null
}

export async function getPushSubscriptionStatus(): Promise<
  Result<PushSubscriptionStatus | null, AppError>
> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('is_active, created_at, last_used_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[push] getPushSubscriptionStatus: falhou', { error: error.message })
    return err({ code: 'internal', message: 'Erro ao obter estado da subscrição' })
  }

  return ok(data ?? null)
}
