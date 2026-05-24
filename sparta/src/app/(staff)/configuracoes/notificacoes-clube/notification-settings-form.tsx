'use client'

import { useTransition, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import {
  getNotificationSettings,
  updateNotificationSettings,
  NotificationSettingsSchema,
  type NotificationSettingsInput,
} from '@/lib/actions/notifications'

export function NotificationSettingsForm() {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const form = useForm<NotificationSettingsInput>({
    resolver: zodResolver(NotificationSettingsSchema),
    defaultValues: {
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    },
  })

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await getNotificationSettings()
        if (result.ok) {
          form.reset({
            pre_minutes: result.data.pre_minutes,
            post_minutes: result.data.post_minutes,
            is_enabled: result.data.is_enabled,
          })
        } else {
          form.setError('root', { message: result.error.message })
        }
      } catch {
        form.setError('root', { message: 'Erro ao carregar definições' })
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [form])

  function onSubmit(data: NotificationSettingsInput) {
    startTransition(async () => {
      try {
        const result = await updateNotificationSettings(data)
        if (!result.ok) {
          form.setError('root', { message: result.error.message })
          return
        }
        setShowConfirmation(true)
        // Reset form with new values to clear dirty state
        form.reset({
          pre_minutes: result.data.pre_minutes,
          post_minutes: result.data.post_minutes,
          is_enabled: result.data.is_enabled,
        })
      } catch {
        form.setError('root', { message: 'Erro ao comunicar com servidor' })
      }
    })
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        A carregar...
      </div>
    )
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Definições guardadas"
          onDismiss={() => setShowConfirmation(false)}
        />
      )}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-lg border border-border/50 bg-card p-6"
      >
        {/* Global toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              id="is-enabled"
              type="checkbox"
              className="rounded border border-border"
              {...form.register('is_enabled')}
            />
            <label htmlFor="is-enabled" className="text-sm font-medium cursor-pointer">
              Enviar notificações de sessão
            </label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Quando desligado, nenhuma notificação será enviada aos jogadores.
          </p>
        </div>

        {/* Pre-session minutes */}
        <div className="space-y-2">
          <label htmlFor="pre-minutes" className="text-sm font-medium">
            X minutos antes da sessão <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pre-minutes"
              type="number"
              min="5"
              max="120"
              className="w-24 rounded border border-border px-3 py-2 text-sm"
              {...form.register('pre_minutes', { valueAsNumber: true })}
            />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
          {form.formState.errors.pre_minutes && (
            <p className="text-xs text-destructive">
              {form.formState.errors.pre_minutes.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Intervalo permitido: 5 a 120 minutos (padrão: 30)
          </p>
        </div>

        {/* Post-session minutes */}
        <div className="space-y-2">
          <label htmlFor="post-minutes" className="text-sm font-medium">
            Y minutos após a sessão <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="post-minutes"
              type="number"
              min="5"
              max="120"
              className="w-24 rounded border border-border px-3 py-2 text-sm"
              {...form.register('post_minutes', { valueAsNumber: true })}
            />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
          {form.formState.errors.post_minutes && (
            <p className="text-xs text-destructive">
              {form.formState.errors.post_minutes.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Intervalo permitido: 5 a 120 minutos (padrão: 30)
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-medium">ℹ️ Privacidade RGPD</p>
          <p className="mt-1 text-xs">
            As notificações são enviadas apenas aos jogadores com subscrição activa. O
            texto da notificação é opaco (sem dados de saúde ou tipo de sessão).
          </p>
        </div>

        {/* Error message */}
        {form.formState.errors.root && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        {/* Submit button */}
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending || !form.formState.isDirty}
            className="gap-2"
          >
            {isPending ? 'A guardar...' : 'Guardar definições'}
          </Button>
        </div>
      </form>
    </>
  )
}
