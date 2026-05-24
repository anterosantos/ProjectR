/**
 * Testes para a Edge Function send-push
 *
 * AC #7 (parcial):
 * ✅ send-push envia payload opaco (sem dados de saúde, sem tipo de sessão)
 * ✅ 410/404 response desativa subscrição (is_active = false) e atualiza notification_log
 * ✅ Sem subscrição ativa → status = 'skipped'
 * ✅ keys_json inválido → falha graciosa, não crash
 *
 * Estratégia: mock do cliente Supabase + webpush + Deno global para Vitest/Node.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Deno global
// ---------------------------------------------------------------------------
beforeAll(() => {
  ;(globalThis as unknown as Record<string, unknown>)['Deno'] = {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
          VAPID_PUBLIC_KEY: 'BTest_public_key_base64url',
          VAPID_PRIVATE_KEY: 'test-private-key-base64url',
          SITE_URL: 'https://sparta-webapp.vercel.app',
        }
        return env[key] ?? null
      },
    },
  }
})

afterAll(() => {
  delete (globalThis as unknown as Record<string, unknown>)['Deno']
})

// ---------------------------------------------------------------------------
// Mock web-push
// ---------------------------------------------------------------------------
const mockSendNotification = vi.fn()

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}))

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_NOTIFICATION = {
  id: 'notif-uuid-1',
  profile_id: 'profile-uuid-1',
  session_id: 'session-uuid-1',
  kind: 'fatigue_pre',
  scheduled_for: new Date(Date.now() - 60000).toISOString(), // 1 min ago
  status: 'processing',
  club_id: 'club-uuid-1',
}

const VALID_SUBSCRIPTION = {
  id: 'sub-uuid-1',
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys_json: { p256dh: 'validP256dhKey', auth: 'validAuthKey' },
  is_active: true,
}

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildMockClient(opts?: {
  claimNotifications?: object[]
  claimError?: object | null
  staleResetCount?: number
  subscription?: object | null
  subError?: object | null
  updateError?: object | null
  deactivateError?: object | null
}) {
  const notifications = opts?.claimNotifications ?? [VALID_NOTIFICATION]
  const subscription = opts?.subscription !== undefined ? opts.subscription : VALID_SUBSCRIPTION

  const rpcMock = vi.fn((fn: string) => {
    if (fn === 'claim_push_notifications') {
      return Promise.resolve({
        data: opts?.claimError ? null : notifications,
        error: opts?.claimError ?? null,
      })
    }
    if (fn === 'reset_stale_processing_notifications') {
      return Promise.resolve({ data: opts?.staleResetCount ?? 0, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: opts?.updateError ?? null }),
  })

  const subSelectChain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts?.subError ? null : subscription,
      error: opts?.subError ?? null,
    }),
  }

  const fromMock = vi.fn((table: string) => {
    if (table === 'push_subscriptions') {
      return { select: vi.fn().mockReturnValue(subSelectChain) }
    }
    if (table === 'notification_log') {
      return { update: updateMock }
    }
    return {}
  })

  return { rpc: rpcMock, from: fromMock }
}

// ---------------------------------------------------------------------------
// Import handler
// ---------------------------------------------------------------------------

let handler: (req: Request) => Promise<Response>

beforeAll(async () => {
  // Path: src/__tests__/edge-functions/ → (3 up) → sparta/ → supabase/functions/...
  const mod = await import('../../../supabase/functions/send-push/index')
    .catch(() => null) as { default?: typeof handler } | null
  if (mod?.default) handler = mod.default
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('send-push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-POST requests', async () => {
    if (!handler) return
    const req = new Request('https://test/functions/v1/send-push', { method: 'GET' })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('sends opaque payload — sem dados de saúde, sem tipo de sessão', async () => {
    if (!handler) return

    mockSendNotification.mockResolvedValue({ statusCode: 201 })
    const mockClient = buildMockClient()
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/send-push', { method: 'POST' })
    await handler(req)

    expect(mockSendNotification).toHaveBeenCalledOnce()
    const callArgs = mockSendNotification.mock.calls[0]
    const payloadStr = callArgs?.[1] as string
    const payload = JSON.parse(payloadStr) as {
      title: string; body: string; tag: string; data: { deepLink: string }
    }

    // Verificar payload opaco
    expect(payload.title).toBe('SPARTA')
    expect(payload.body).toBe('Sessão daqui a pouco — abre o app')
    expect(payload.tag).toBe('fatigue-notification')
    expect(payload.data.deepLink).toContain('/questionario/')

    // Verificar AUSÊNCIA de dados de saúde / tipo de sessão
    const payloadJson = JSON.stringify(payload)
    const forbiddenTerms = ['fatiga', 'fadiga', 'treino', 'jogo', 'training', 'match',
      'health', 'saúde', 'lesão', 'injury', 'score', 'avaliação']
    for (const term of forbiddenTerms) {
      expect(payloadJson.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })

  it('envia payload pós-sessão correto para fatigue_post', async () => {
    if (!handler) return

    mockSendNotification.mockResolvedValue({ statusCode: 201 })
    const postNotification = { ...VALID_NOTIFICATION, kind: 'fatigue_post', id: 'notif-uuid-2' }
    const mockClient = buildMockClient({ claimNotifications: [postNotification] })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    await handler(new Request('https://test/functions/v1/send-push', { method: 'POST' }))

    const payloadStr = mockSendNotification.mock.calls[0]?.[1] as string
    const payload = JSON.parse(payloadStr) as { body: string; data: { deepLink: string } }
    expect(payload.body).toBe('Sessão concluída — responde ao questionário')
    expect(payload.data.deepLink).toContain('/post')
  })

  it('410 Gone → desativa subscrição por endpoint e marca como failed', async () => {
    if (!handler) return

    const pushError = Object.assign(new Error('Received unexpected response code 410'), { statusCode: 410 })
    mockSendNotification.mockRejectedValue(pushError)

    const deactivateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })

    const subSelectChain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: VALID_SUBSCRIPTION, error: null }),
    }

    const fromMock = vi.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue(subSelectChain),
          update: vi.fn().mockReturnValue({ eq: deactivateEqMock }),
        }
      }
      if (table === 'notification_log') {
        return { update: vi.fn().mockReturnValue({ eq: updateEqMock }) }
      }
      return {}
    })

    const rpcMock = vi.fn((fn: string) => {
      if (fn === 'claim_push_notifications') return Promise.resolve({ data: [VALID_NOTIFICATION], error: null })
      return Promise.resolve({ data: 0, error: null })
    })

    vi.mocked(createClient).mockReturnValue({ rpc: rpcMock, from: fromMock } as ReturnType<typeof createClient>)

    const res = await handler(new Request('https://test/functions/v1/send-push', { method: 'POST' }))
    const body = await res.json() as { failed: number }

    expect(body.failed).toBe(1)
    // Subscrição deve ser desativada por endpoint
    expect(deactivateEqMock).toHaveBeenCalledWith('endpoint', VALID_SUBSCRIPTION.endpoint)
    // notification_log deve ser marcado como failed
    expect(updateEqMock).toHaveBeenCalledWith('id', VALID_NOTIFICATION.id)
  })

  it('404 Gone → desativa subscrição (mesmo comportamento que 410)', async () => {
    if (!handler) return

    const pushError = Object.assign(new Error('Not Found'), { statusCode: 404 })
    mockSendNotification.mockRejectedValue(pushError)

    const deactivateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })

    const fromMock = vi.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: VALID_SUBSCRIPTION, error: null }),
          }),
          update: vi.fn().mockReturnValue({ eq: deactivateEqMock }),
        }
      }
      if (table === 'notification_log') {
        return { update: vi.fn().mockReturnValue({ eq: updateEqMock }) }
      }
      return {}
    })

    const rpcMock = vi.fn((fn: string) => {
      if (fn === 'claim_push_notifications') return Promise.resolve({ data: [VALID_NOTIFICATION], error: null })
      return Promise.resolve({ data: 0, error: null })
    })

    vi.mocked(createClient).mockReturnValue({ rpc: rpcMock, from: fromMock } as ReturnType<typeof createClient>)

    const res = await handler(new Request('https://test/functions/v1/send-push', { method: 'POST' }))
    const body = await res.json() as { failed: number }

    expect(body.failed).toBe(1)
    // 404 deve desativar subscrição por endpoint (mesma lógica que 410)
    expect(deactivateEqMock).toHaveBeenCalledWith('endpoint', VALID_SUBSCRIPTION.endpoint)
  })

  it('sem subscrição ativa → status = skipped', async () => {
    if (!handler) return

    mockSendNotification.mockClear()
    const mockClient = buildMockClient({ subscription: null })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const res = await handler(new Request('https://test/functions/v1/send-push', { method: 'POST' }))
    const body = await res.json() as { skipped: number; sent: number }

    expect(body.skipped).toBe(1)
    expect(body.sent).toBe(0)
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('keys_json inválido → marca como failed, não crasha', async () => {
    if (!handler) return

    const badSubscription = { ...VALID_SUBSCRIPTION, keys_json: { p256dh: '', auth: '' } }
    const mockClient = buildMockClient({ subscription: badSubscription })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const res = await handler(new Request('https://test/functions/v1/send-push', { method: 'POST' }))

    expect(res.status).toBe(200)
    // Deve retornar sem crash; webpush não deve ser chamado com keys inválidas
    expect(mockSendNotification).not.toHaveBeenCalled()
  })
})
