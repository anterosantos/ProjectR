'use client'

import { useEffect, useState } from 'react'
import { BellOffIcon } from 'lucide-react'
import {
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getPushSubscriptionStatus,
  type PushSubscriptionStatus,
} from '@/lib/actions/push'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifica se o browser suporta Web Push.
 * Safari iOS < 16.4 não suporta PushManager.
 */
function hasPushSupport(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Converte uma chave base64url em Uint8Array<ArrayBuffer> para o VAPID applicationServerKey.
 * Necessário: browser espera ArrayBuffer, não string base64.
 * Nota: usa `new Uint8Array()` em vez de `Uint8Array.from()` para garantir
 * o tipo `Uint8Array<ArrayBuffer>` (compatível com PushSubscriptionOptionsInit).
 */
function base64UrlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/**
 * Converte ArrayBuffer em string base64url (formato esperado pelo servidor).
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Formata uma data como "há X dias/horas/minutos".
 */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (d > 0) return `${d} dia${d !== 1 ? 's' : ''}`
  if (h > 0) return `${h}h`
  return `${min}m`
}

/**
 * Formata uma data como "7 Maio, 14:30" (PT-PT).
 */
function formatActiveSince(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Health check do Service Worker via simple ping.
 * Garante que o SW está vivo antes de criar subscrição.
 */
async function checkServiceWorkerHealth(timeout = 2000): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration?.active) return false

    // Enviar ping ao SW e aguardar resposta
    const response = await Promise.race([
      new Promise<boolean>((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve(true)
        registration.active.postMessage({ type: 'ping' }, [channel.port2])
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout)),
    ])

    return response
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Dialog de confirmação de desactivação
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function UnsubscribeConfirmDialog({ onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsubscribe-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <h2 id="unsubscribe-dialog-title" className="text-base font-semibold">
          Desativar notificações?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Podes reativar a qualquer momento.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'A desativar...' : 'Desativar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotificationsSettings — componente principal
// ---------------------------------------------------------------------------

export function NotificationsSettings() {
  const [supportsPush] = useState(() => hasPushSupport())
  const [status, setStatus] = useState<PushSubscriptionStatus | null>(null)
  const [localIsSubscribed, setLocalIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Carregar estado inicial: combinação do estado DB + estado browser.
  // Definido inline no effect para evitar lint no-sync-set-state-in-effect.
  useEffect(() => {
    async function loadInitialStatus() {
      try {
        // Estado no servidor (DB)
        const result = await getPushSubscriptionStatus()
        if (result.ok) {
          setStatus(result.data)
        }

        // Estado no browser (serviceWorker)
        if (supportsPush) {
          const registration = await navigator.serviceWorker?.ready
          const sub = await registration?.pushManager?.getSubscription()
          setLocalIsSubscribed(!!sub)
        }
      } catch (e) {
        console.error('[NotificationsSettings] loadInitialStatus falhou', e)
      } finally {
        setIsInitializing(false)
      }
    }

    void loadInitialStatus()
  }, [supportsPush])

  // Subscrição activa: DB diz is_active=true E browser tem subscrição
  const isSubscribed = status?.is_active === true && localIsSubscribed

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSubscribe() {
    setIsLoading(true)
    setError(null)

    try {
      // Pedir permissão ao browser
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Permissão negada. Ativa notificações nas definições do browser.')
        return
      }

      // Obter chave pública VAPID
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setError('Configuração de notificações em falta. Contacta o suporte.')
        return
      }

      // Health check do Service Worker antes de subscribe
      const swHealthy = await checkServiceWorkerHealth()
      if (!swHealthy) {
        setError('Service Worker indisponível. Recarrega a página.')
        return
      }

      // Criar subscrição no browser
      const registration = await navigator.serviceWorker?.ready
      if (!registration) {
        setError('Service worker não disponível. Recarrega a página.')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      })

      // Validar que as chaves criptográficas foram geradas (podem ser null em browsers antigos)
      const p256dh = subscription.getKey('p256dh')
      const auth = subscription.getKey('auth')
      if (!p256dh || !auth) {
        setError('Browser não suporta Web Push completamente. Tenta com Chrome/Firefox/Edge.')
        await subscription.unsubscribe()
        return
      }

      // Enviar ao servidor
      const result = await subscribeToNotifications({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(p256dh),
          auth: arrayBufferToBase64Url(auth),
        },
      })

      if (result.ok) {
        // Actualizar estado local directamente (evitar re-fetch)
        setLocalIsSubscribed(true)
        setStatus({
          is_active: true,
          created_at: result.data.activated_at,
          last_used_at: null,
        })
      } else {
        setError(result.error.message)
        // Reverter subscrição no browser se o servidor falhou
        await subscription.unsubscribe()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao ativar notificações'
      setError(`Erro ao ativar. Tenta mais tarde. (${msg})`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnsubscribeConfirmed() {
    setIsLoading(true)
    setError(null)
    setShowConfirm(false)

    try {
      // Primeiro: desactivar no servidor (garantia even se browser falhar — AC #5)
      const result = await unsubscribeFromNotifications()

      if (!result.ok) {
        setError(result.error.message)
        setIsLoading(false)
        return
      }

      // Depois: revogar no browser (tolerant degradation)
      try {
        const registration = await navigator.serviceWorker?.ready
        const sub = await registration?.pushManager?.getSubscription()
        await sub?.unsubscribe()
      } catch (browserErr) {
        // Falha silenciosa no browser — servidor já marcou is_active=false
        console.warn('[push] browser unsubscribe falhou (tolerant)', browserErr)
      }

      setLocalIsSubscribed(false)
      setStatus((prev) => (prev ? { ...prev, is_active: false } : null))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao desativar'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render — sem suporte a push
  // ---------------------------------------------------------------------------

  if (!supportsPush) {
    return (
      <EmptyState
        icon={<BellOffIcon className="h-8 w-8 text-muted-foreground" />}
        title="Browser sem suporte"
        description="O teu browser ainda não suporta notificações. Usa Chrome, Firefox, Edge ou Safari 16.4+."
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Render — a carregar
  // ---------------------------------------------------------------------------

  if (isInitializing) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" aria-busy="true">
        A carregar estado das notificações...
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — principal
  // ---------------------------------------------------------------------------

  return (
    <>
      {showConfirm && (
        <UnsubscribeConfirmDialog
          onConfirm={handleUnsubscribeConfirmed}
          onCancel={() => setShowConfirm(false)}
          isLoading={isLoading}
        />
      )}

      <div className="space-y-4">
        {/* Card de estado */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {isSubscribed ? (
                  status?.created_at ? (
                    <>Ativo desde {formatActiveSince(status.created_at)}</>
                  ) : (
                    'Ativo'
                  )
                ) : (
                  'Inativo'
                )}
              </p>
              {isSubscribed && status?.last_used_at && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Última notificação há {formatRelativeTime(status.last_used_at)}
                </p>
              )}
              {!isSubscribed && status?.is_active === false && status.created_at && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Desativado. Podes reativar a qualquer momento.
                </p>
              )}
            </div>

            {isSubscribed ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                Desativar
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubscribe}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? 'A ativar...' : 'Ativar notificações'}
              </Button>
            )}
          </div>
        </div>

        {/* Erro inline */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Nota informativa */}
        <p className="text-xs text-muted-foreground">
          Receberás notificações antes e depois de cada sessão. Podes desativar a qualquer momento.
        </p>
      </div>
    </>
  )
}
