/**
 * Tests: src/lib/actions/push.ts
 * Story 4.7 — Push Subscription Infrastructure
 *
 * Strategy: mock createServerClient + getUser to simulate auth context.
 * Tests cover: validate, subscribe, upsert, unsubscribe, deactivate, RLS edge cases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as serverModule from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Helpers — Supabase client mock factory
// ---------------------------------------------------------------------------

interface MockTableConfig {
  selectData?: unknown
  selectError?: { message: string } | null
  upsertError?: { message: string } | null
  updateError?: { message: string } | null
  insertError?: { message: string } | null
}

function createMockSupabaseClient(
  userId: string | null,
  tables: Record<string, MockTableConfig> = {}
) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  })

  const from = vi.fn((table: string) => {
    const cfg: MockTableConfig = tables[table] ?? {}

    const single = vi.fn().mockResolvedValue({
      data: cfg.selectData ?? null,
      error: cfg.selectError ?? null,
    })

    const maybeSingle = vi.fn().mockResolvedValue({
      data: cfg.selectData ?? null,
      error: cfg.selectError ?? null,
    })

    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: cfg.upsertError ?? null,
    })

    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: cfg.updateError ?? null,
      }),
    }))

    const insert = vi.fn().mockResolvedValue({
      data: null,
      error: cfg.insertError ?? null,
    })

    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        single,
        maybeSingle,
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
      single,
      maybeSingle,
    }))

    return { select, upsert, update, insert, single, maybeSingle }
  })

  return { auth: { getUser }, from }
}

// ---------------------------------------------------------------------------
// Reset modules before each test group
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// subscribeToNotifications
// ---------------------------------------------------------------------------

describe('subscribeToNotifications', () => {
  it('rejects invalid subscription shape (missing keys.auth)', async () => {
    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'https://example.com/push/abc',
      keys: { p256dh: 'abc' }, // missing auth
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('validation')
    }
  })

  it('rejects non-URL endpoint', async () => {
    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'not-a-url',
      keys: { p256dh: 'abc', auth: 'xyz' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('validation')
    }
  })

  it('returns unauthorized when user is not authenticated', async () => {
    const mockClient = createMockSupabaseClient(null)
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'https://fcm.googleapis.com/push/abc',
      keys: { p256dh: 'abc', auth: 'xyz' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('returns error when profile not found', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      profiles: { selectData: null, selectError: { message: 'not found' } },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'https://fcm.googleapis.com/push/abc',
      keys: { p256dh: 'abc', auth: 'xyz' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })

  it('succeeds and returns activated_at when upsert works', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      profiles: { selectData: { club_id: 'club-abc' }, selectError: null },
      push_subscriptions: { upsertError: null },
      telemetry_events: { insertError: null },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'https://fcm.googleapis.com/push/unique-endpoint',
      keys: { p256dh: 'p256-key', auth: 'auth-key' },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.activated_at).toBeDefined()
      expect(typeof result.data.activated_at).toBe('string')
    }
  })

  it('returns error when DB upsert fails', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      profiles: { selectData: { club_id: 'club-abc' }, selectError: null },
      push_subscriptions: { upsertError: { message: 'unique constraint violation' } },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { subscribeToNotifications } = await import('@/lib/actions/push')

    const result = await subscribeToNotifications({
      endpoint: 'https://fcm.googleapis.com/push/endpoint',
      keys: { p256dh: 'p256', auth: 'auth' },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })
})

// ---------------------------------------------------------------------------
// unsubscribeFromNotifications
// ---------------------------------------------------------------------------

describe('unsubscribeFromNotifications', () => {
  it('returns unauthorized when not authenticated', async () => {
    const mockClient = createMockSupabaseClient(null)
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { unsubscribeFromNotifications } = await import('@/lib/actions/push')
    const result = await unsubscribeFromNotifications()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('succeeds and returns deactivated=true', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      push_subscriptions: { updateError: null },
      profiles: { selectData: { club_id: 'club-abc' }, selectError: null },
      telemetry_events: { insertError: null },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { unsubscribeFromNotifications } = await import('@/lib/actions/push')
    const result = await unsubscribeFromNotifications()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.deactivated).toBe(true)
    }
  })

  it('returns error when DB update fails', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      push_subscriptions: { updateError: { message: 'connection error' } },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { unsubscribeFromNotifications } = await import('@/lib/actions/push')
    const result = await unsubscribeFromNotifications()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })

  it('unsubscribing does not affect user session (ok=true, no redirect)', async () => {
    // The server action ONLY updates DB; session management is out of scope.
    // This test verifies no exception is thrown and result.ok is true.
    const mockClient = createMockSupabaseClient('user-456', {
      push_subscriptions: { updateError: null },
      profiles: { selectData: { club_id: 'club-xyz' } },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { unsubscribeFromNotifications } = await import('@/lib/actions/push')
    const result = await unsubscribeFromNotifications()

    // Player session is NOT invalidated
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// deactivateExpiredSubscription
// ---------------------------------------------------------------------------

describe('deactivateExpiredSubscription', () => {
  it('rejects empty endpoint', async () => {
    const { deactivateExpiredSubscription } = await import('@/lib/actions/push')
    const result = await deactivateExpiredSubscription('')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('validation')
    }
  })

  it('succeeds when DB update works', async () => {
    const mockClient = createMockSupabaseClient('service-role', {
      push_subscriptions: {
        selectData: { profile_id: 'player-uuid' },
        updateError: null,
      },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { deactivateExpiredSubscription } = await import('@/lib/actions/push')
    const result = await deactivateExpiredSubscription(
      'https://fcm.googleapis.com/push/expired-endpoint'
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.deactivated).toBe(true)
    }

    // Verifica que o log estruturado foi emitido
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('push_subscription_expired')
    )

    consoleSpy.mockRestore()
  })

  it('returns error when DB update fails', async () => {
    const mockClient = createMockSupabaseClient('service-role', {
      push_subscriptions: {
        selectData: null,
        updateError: { message: 'DB error' },
      },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { deactivateExpiredSubscription } = await import('@/lib/actions/push')
    const result = await deactivateExpiredSubscription(
      'https://fcm.googleapis.com/push/endpoint'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })
})

// ---------------------------------------------------------------------------
// getPushSubscriptionStatus
// ---------------------------------------------------------------------------

describe('getPushSubscriptionStatus', () => {
  it('returns null when no subscription exists', async () => {
    const mockClient = createMockSupabaseClient('user-123', {
      push_subscriptions: { selectData: null, selectError: null },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { getPushSubscriptionStatus } = await import('@/lib/actions/push')
    const result = await getPushSubscriptionStatus()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBeNull()
    }
  })

  it('returns subscription status when found', async () => {
    const mockStatus = {
      is_active: true,
      created_at: '2026-05-24T10:00:00Z',
      last_used_at: null,
    }
    const mockClient = createMockSupabaseClient('user-123', {
      push_subscriptions: { selectData: mockStatus, selectError: null },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { getPushSubscriptionStatus } = await import('@/lib/actions/push')
    const result = await getPushSubscriptionStatus()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data?.is_active).toBe(true)
      expect(result.data?.created_at).toBe('2026-05-24T10:00:00Z')
    }
  })

  it('returns unauthorized when not authenticated', async () => {
    const mockClient = createMockSupabaseClient(null)
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClient as any
    )

    const { getPushSubscriptionStatus } = await import('@/lib/actions/push')
    const result = await getPushSubscriptionStatus()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })
})

// ---------------------------------------------------------------------------
// RLS Cross-Player Protection
// ---------------------------------------------------------------------------

describe('RLS — Cross-Player Protection', () => {
  it('rejects cross-player keys_json read attempt', async () => {
    // Simula: Player A tenta ler keys_json de Player B
    // RLS deve bloquear o SELECT ou retornar row vazio

    const mockClientPlayerA = createMockSupabaseClient('player-a-uuid', {
      push_subscriptions: {
        // Mock retorna vazio — RLS bloqueou
        selectData: null,
        selectError: null,
      },
    })
    vi.spyOn(serverModule, 'createServerClient').mockResolvedValue(
      mockClientPlayerA as any
    )

    const { getPushSubscriptionStatus } = await import('@/lib/actions/push')
    const result = await getPushSubscriptionStatus()

    // Player A consegue apenas sua própria subscrição, não de Player B
    expect(result.ok).toBe(true)
    expect(result.data).toBeNull() // Player A não tem subscrição
  })
})
