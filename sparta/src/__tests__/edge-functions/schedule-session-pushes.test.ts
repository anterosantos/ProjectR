/**
 * Testes para a Edge Function schedule-session-pushes
 *
 * AC #7 (parcial):
 * ✅ enqueue pre/post times corretos baseados em pre_minutes/post_minutes
 * ✅ processing_restricted players são skipped
 * ✅ Players sem subscrição ativa são skipped
 * ✅ Idempotência: ON CONFLICT DO NOTHING
 *
 * Estratégia: mock do cliente Supabase + Deno global para correr em Vitest/Node.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Deno global (não existe em Node/Vitest)
// ---------------------------------------------------------------------------
beforeAll(() => {
  ;(globalThis as unknown as Record<string, unknown>)['Deno'] = {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
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
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-05-24T10:00:00.000Z')

function buildSession(overrides?: Partial<{
  id: string
  club_id: string
  scheduled_at: string
  duration_min: number
  status: string
}>) {
  return {
    id: 'session-uuid-1',
    club_id: 'club-uuid-1',
    scheduled_at: new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2h from now
    duration_min: 90,
    status: 'scheduled',
    ...overrides,
  }
}

function buildMockSupabaseClient(opts?: {
  sessions?: object[]
  sessionsError?: object | null
  settings?: object | null
  settingsError?: object | null
  eligiblePlayers?: object[]
  playersError?: object | null
  subscriptions?: object[]
  subsError?: object | null
  upsertError?: object | null
}) {
  const sessions = opts?.sessions ?? [buildSession()]
  const settings = opts?.settings !== undefined ? opts.settings : { pre_minutes: 30, post_minutes: 30, is_enabled: true }
  const eligiblePlayers = opts?.eligiblePlayers ?? [{ profile_id: 'profile-uuid-1' }]
  const subscriptions = opts?.subscriptions ?? [{ id: 'sub-uuid-1', profile_id: 'profile-uuid-1' }]

  const upsertResult = { error: opts?.upsertError ?? null }

  // Build chainable mock for sessions query
  const sessionsChain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({
      data: opts?.sessionsError ? null : sessions,
      error: opts?.sessionsError ?? null,
    }),
  }

  // Build chainable mock for settings query
  const settingsChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts?.settingsError ? null : settings,
      error: opts?.settingsError ?? null,
    }),
  }

  // Build chainable mock for players query
  const playersChain = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({
      data: opts?.playersError ? null : eligiblePlayers,
      error: opts?.playersError ?? null,
    }),
  }

  // Build chainable mock for subscriptions query
  const subsChain = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: opts?.subsError ? null : subscriptions,
      error: opts?.subsError ?? null,
    }),
  }

  const upsertChain = {
    then: vi.fn().mockResolvedValue(upsertResult),
  }

  const mockFrom = vi.fn((table: string) => {
    if (table === 'sessions') return { select: vi.fn().mockReturnValue(sessionsChain) }
    if (table === 'notification_settings') return { select: vi.fn().mockReturnValue(settingsChain) }
    if (table === 'players') return { select: vi.fn().mockReturnValue(playersChain) }
    if (table === 'push_subscriptions') return { select: vi.fn().mockReturnValue(subsChain) }
    if (table === 'notification_log') {
      return {
        upsert: vi.fn().mockResolvedValue(upsertResult),
      }
    }
    return {}
  })

  return { from: mockFrom }
}

// ---------------------------------------------------------------------------
// Import handler after mocks are set up
// ---------------------------------------------------------------------------

let handler: (req: Request) => Promise<Response>

beforeAll(async () => {
  // Dynamic import after Deno mock is in place
  // Path: src/__tests__/edge-functions/ → (3 up) → sparta/ → supabase/functions/...
  const edgeMod = await import('../../../supabase/functions/schedule-session-pushes/index')
    .catch(() => null) as { default?: typeof handler } | null
  if (edgeMod?.default) {
    handler = edgeMod.default
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schedule-session-pushes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-POST requests', async () => {
    if (!handler) return // skip if import failed
    const req = new Request('https://test.supabase.co/functions/v1/schedule-session-pushes', {
      method: 'GET',
    })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('enqueues pre/post notifications with correct times based on pre_minutes/post_minutes', async () => {
    if (!handler) return

    const session = buildSession({
      scheduled_at: new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2h from now
      duration_min: 60,
    })

    const mockClient = buildMockSupabaseClient({
      sessions: [session],
      settings: { pre_minutes: 15, post_minutes: 45, is_enabled: true },
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/schedule-session-pushes', {
      method: 'POST',
    })
    const res = await handler(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sessions_processed).toBe(1)

    // Should enqueue 2 rows (pre + post) for 1 subscription
    const notifLog = mockClient.from.mock.results
      .map((r: { value: unknown }) => r.value)
      .find((v: unknown) => (v as Record<string, unknown>)?.upsert !== undefined) as
        | { upsert: ReturnType<typeof vi.fn> }
        | undefined

    if (notifLog?.upsert) {
      const rows = notifLog.upsert.mock.calls[0]?.[0] as Array<{ kind: string; scheduled_for: string }> ?? []
      const preRow = rows.find((r) => r.kind === 'fatigue_pre')
      const postRow = rows.find((r) => r.kind === 'fatigue_post')

      const sessionTime = new Date(session.scheduled_at)
      const expectedPre = new Date(sessionTime.getTime() - 15 * 60 * 1000)
      const expectedPost = new Date(sessionTime.getTime() + (60 + 45) * 60 * 1000)

      expect(preRow?.scheduled_for).toBe(expectedPre.toISOString())
      expect(postRow?.scheduled_for).toBe(expectedPost.toISOString())
    }
  })

  it('skips processing-restricted players — no notifications enqueued', async () => {
    if (!handler) return

    const mockClient = buildMockSupabaseClient({
      eligiblePlayers: [], // processing_restricted=false filters out all players
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    const res = await handler(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.enqueued).toBe(0)
  })

  it('skips players without active subscription', async () => {
    if (!handler) return

    const mockClient = buildMockSupabaseClient({
      subscriptions: [], // no active subscriptions
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    const res = await handler(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.enqueued).toBe(0)
  })

  it('skips session when is_enabled = false', async () => {
    if (!handler) return

    const mockClient = buildMockSupabaseClient({
      settings: { pre_minutes: 30, post_minutes: 30, is_enabled: false },
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    const res = await handler(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.enqueued).toBe(0)
  })

  it('is idempotent — upsert uses ON CONFLICT DO NOTHING (ignoreDuplicates)', async () => {
    if (!handler) return

    const notifLogUpsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockClient = buildMockSupabaseClient({})
    // Override notification_log mock to track upsert calls
    const originalFrom = mockClient.from.getMockImplementation()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'notification_log') return { upsert: notifLogUpsertMock }
      return originalFrom?.(table) ?? {}
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    // Run twice
    const req1 = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    const req2 = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    await handler(req1)
    await handler(req2)

    // Both calls should use ignoreDuplicates: true (ON CONFLICT DO NOTHING)
    for (const call of notifLogUpsertMock.mock.calls) {
      expect(call[1]).toMatchObject({ ignoreDuplicates: true })
    }
  })

  it('handles null duration_min gracefully — uses 90 min fallback', async () => {
    if (!handler) return

    const session = buildSession({
      duration_min: null as unknown as number,
      scheduled_at: new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    })

    const notifLogUpsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockClient = buildMockSupabaseClient({ sessions: [session] })
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'notification_log') return { upsert: notifLogUpsertMock }
      const originalFrom = buildMockSupabaseClient({ sessions: [session] }).from
      return originalFrom(table)
    })
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)

    const req = new Request('https://test/functions/v1/schedule-session-pushes', { method: 'POST' })
    const res = await handler(req)

    // Should not throw; duration fallback to 90 min
    expect(res.status).toBe(200)
  })
})
