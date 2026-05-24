/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'
import { defaultCache } from '@serwist/next/worker'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis

const serwist = new Serwist({
  precacheEntries: (self as WorkerGlobalScope).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

// ---------------------------------------------------------------------------
// Service Worker health check (ping/pong for notifications-settings.tsx)
// ---------------------------------------------------------------------------

/**
 * Responde ao ping do health check com um pong via MessagePort.
 * Usado para verificar se o SW está activo antes de criar subscrição.
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'ping' && event.ports[0]) {
    event.ports[0].postMessage({ type: 'pong' })
  }
})

// ---------------------------------------------------------------------------
// Web Push: receber notificações (Story 4.7, AC — service worker)
// ---------------------------------------------------------------------------

/**
 * Evento 'push': disparado quando o servidor envia uma notificação.
 * Payload esperado: { title, body, tag?, data?: { deepLink? } }
 */
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let title = 'SPARTA'
  let body = ''
  let tag = 'sparta-push'
  let deepLink = '/'

  try {
    const payload = event.data.json() as {
      title?: string
      body?: string
      tag?: string
      data?: { deepLink?: string }
    }
    title = payload.title ?? title
    body = payload.body ?? body
    tag = payload.tag ?? tag
    deepLink = payload.data?.deepLink ?? deepLink
  } catch {
    // Payload não é JSON válido — usar defaults
    body = event.data.text()
  }

  const showNotificationPromise = self.registration.showNotification(title, {
    body,
    tag,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: { deepLink },
  })

  event.waitUntil(showNotificationPromise)
})

// ---------------------------------------------------------------------------
// Web Push: clique na notificação (deep link)
// ---------------------------------------------------------------------------

/**
 * Evento 'notificationclick': disparado quando o utilizador toca na notificação.
 * Foca a janela existente ou abre nova aba com o deepLink.
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const deepLink = (event.notification.data as { deepLink?: string } | null)?.deepLink ?? '/'

  const focusOrOpenPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      // Se já existe uma janela com o deepLink, focar
      for (const client of clients) {
        if (client.url.endsWith(deepLink) && 'focus' in client) {
          return client.focus()
        }
      }
      // Caso contrário, abrir nova janela
      return self.clients.openWindow(deepLink)
    })

  event.waitUntil(focusOrOpenPromise)
})
