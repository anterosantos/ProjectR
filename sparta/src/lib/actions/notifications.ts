'use server'

import { createServerClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/types'
import type { Result, AppError } from '@/lib/types'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  id: string | null // null quando ainda não existe row na DB (defaults)
  club_id: string
  pre_minutes: number
  post_minutes: number
  is_enabled: boolean
  event_edit_window_hours: number
  updated_at: string
}

export const NotificationSettingsSchema = z.object({
  pre_minutes: z.number().int().min(5).max(120),
  post_minutes: z.number().int().min(5).max(120),
  is_enabled: z.boolean(),
  event_edit_window_hours: z.number().int().min(1).max(168),
})

export type NotificationSettingsInput = z.infer<typeof NotificationSettingsSchema>

// ---------------------------------------------------------------------------
// getNotificationSettings
// ---------------------------------------------------------------------------

/**
 * Fetch current notification settings for the authenticated user's club.
 *
 * - Auth check: any authenticated user (will read their club_id from profiles)
 * - SELECT from notification_settings WHERE club_id = profile.club_id
 * - If no row exists: return defaults (pre_minutes: 30, post_minutes: 30, is_enabled: true)
 * - Used by both staff (read/edit) and players (read-only reference)
 */
export async function getNotificationSettings(): Promise<
  Result<NotificationSettings, AppError>
> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  // Fetch user's profile to get club_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.club_id) {
    logger.error('notifications.get_profile_failed', {
      user_id: user.id,
      error: profileError?.message,
    })
    return err({
      code: 'not_found',
      message: 'Perfil não encontrado',
    })
  }

  // Fetch notification settings for the club
  const { data: settings, error: settingsError } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('club_id', profile.club_id)
    .maybeSingle()

  if (settingsError) {
    logger.error('notifications.get_settings_failed', {
      club_id: profile.club_id,
      error: settingsError.message,
    })
    return err({
      code: 'internal',
      message: 'Erro ao procurar definições de notificações',
    })
  }

  // Return existing settings or defaults
  if (settings) {
    return ok(settings as NotificationSettings)
  }

  const defaults: NotificationSettings = {
    id: null, // ainda não persistido — será criado no primeiro updateNotificationSettings
    club_id: profile.club_id,
    pre_minutes: 30,
    post_minutes: 30,
    is_enabled: true,
    event_edit_window_hours: 24,
    updated_at: new Date().toISOString(),
  }

  return ok(defaults)
}

// ---------------------------------------------------------------------------
// updateNotificationSettings
// ---------------------------------------------------------------------------

/**
 * Update notification settings for the authenticated user's club.
 *
 * - Auth check: staff only (coach/analyst)
 * - Validates input via Zod (pre_minutes/post_minutes 5–120, is_enabled boolean)
 * - UPSERT into notification_settings ON CONFLICT (club_id) DO UPDATE
 * - Returns updated settings
 */
export async function updateNotificationSettings(
  input: unknown
): Promise<Result<NotificationSettings, AppError>> {
  // 1. Validate input
  const validated = NotificationSettingsSchema.safeParse(input)
  if (!validated.success) {
    return err({
      code: 'validation',
      message:
        validated.error.issues[0]?.message ?? 'Valores inválidos para notificações',
      details: { issues: validated.error.issues },
    })
  }

  // 2. Authenticate
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return err({ code: 'unauthorized', message: 'Não autenticado' })
  }

  // 3. Verify staff role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('club_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.club_id) {
    logger.error('notifications.update_profile_lookup_failed', {
      user_id: user.id,
      error: profileError?.message,
    })
    return err({
      code: 'not_found',
      message: 'Perfil não encontrado',
    })
  }

  if (!['coach', 'analyst'].includes(profile.role ?? '')) {
    return err({
      code: 'forbidden',
      message: 'Apenas staff pode alterar as definições de notificações',
    })
  }

  // 4. Upsert notification_settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: upsertError } = await (supabase as any)
    .from('notification_settings')
    .upsert(
      {
        club_id: profile.club_id,
        pre_minutes: validated.data.pre_minutes,
        post_minutes: validated.data.post_minutes,
        is_enabled: validated.data.is_enabled,
        event_edit_window_hours: validated.data.event_edit_window_hours,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'club_id' }
    )
    .select()
    .single()

  if (upsertError) {
    logger.error('notifications.update_failed', {
      club_id: profile.club_id,
      error: upsertError.message,
    })
    return err({
      code: 'internal',
      message: 'Erro ao guardar definições de notificações',
    })
  }

  logger.info('notifications.updated', {
    club_id: profile.club_id,
    pre_minutes: validated.data.pre_minutes,
    post_minutes: validated.data.post_minutes,
    is_enabled: validated.data.is_enabled,
    event_edit_window_hours: validated.data.event_edit_window_hours,
  })

  return ok(updated as NotificationSettings)
}
