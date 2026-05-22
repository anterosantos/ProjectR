/**
 * Integration tests for getAuditLogForSubject / getAuditLogForSubjectByToken.
 *
 * These tests mock Supabase clients to verify:
 * - RLS isolation: titular cannot see other subject's logs
 * - Encarregado with valid token sees child's logs
 * - Unauthorized user gets forbidden error
 * - 12-month filter logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authModule from '@/lib/supabase/server'
import * as serviceRoleModule from '@/lib/supabase/service-role'
import * as dataRightsModule from '@/lib/actions/data-rights'

// Build a mock Supabase fluent query chain
function buildQueryMock(rows: unknown[], count: number, error: null | { message: string } = null) {
  const mock = {
    data: rows,
    error,
    count,
  }
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(mock),
  }
  return chain
}

describe('getAuditLogForSubject()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns forbidden when subjectId != authenticated user', async () => {
    vi.spyOn(authModule, 'createServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-a' } },
          error: null,
        }),
      },
    } as any)

    const { getAuditLogForSubject } = await import('./audit-visibility')
    const result = await getAuditLogForSubject('user-b', 1, 50)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden')
    }
  })

  it('returns unauthorized when not authenticated', async () => {
    vi.spyOn(authModule, 'createServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as any)

    const { getAuditLogForSubject } = await import('./audit-visibility')
    const result = await getAuditLogForSubject('any-id', 1, 50)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('returns empty result when user has no audit logs', async () => {
    const queryChain = buildQueryMock([], 0)

    vi.spyOn(authModule, 'createServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-a' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(queryChain),
    } as any)

    vi.spyOn(serviceRoleModule, 'getServiceRoleClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any)

    const { getAuditLogForSubject } = await import('./audit-visibility')
    const result = await getAuditLogForSubject('user-a', 1, 50)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.entries).toEqual([])
      expect(result.data.totalCount).toBe(0)
      expect(result.data.hasMore).toBe(false)
    }
  })

  it('applies 12-month filter (gte called with date ~12 months ago)', async () => {
    const queryChain = buildQueryMock([], 0)

    vi.spyOn(authModule, 'createServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-a' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(queryChain),
    } as any)

    vi.spyOn(serviceRoleModule, 'getServiceRoleClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any)

    const { getAuditLogForSubject } = await import('./audit-visibility')
    await getAuditLogForSubject('user-a', 1, 50)

    expect(queryChain.gte).toHaveBeenCalledWith('occurred_at', expect.any(String))
    const gteArg = queryChain.gte.mock.calls[0]?.[1] as string
    const gteDate = new Date(gteArg)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    // Allow ±10 seconds for test timing
    expect(Math.abs(gteDate.getTime() - twelveMonthsAgo.getTime())).toBeLessThan(10000)
  })

  it('returns paginated entries with hasMore=true when more exist', async () => {
    const sampleEntry = {
      id: 'log-1',
      actor_id: 'actor-1',
      action: 'viewed_fatigue_response',
      target_kind: 'fatigue_response',
      target_id: 'user-a',
      occurred_at: '2026-05-22T10:00:00.000Z',
      payload: null,
    }
    const queryChain = buildQueryMock([sampleEntry], 60)

    vi.spyOn(authModule, 'createServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-a' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(queryChain),
    } as any)

    vi.spyOn(serviceRoleModule, 'getServiceRoleClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'actor-1', full_name: 'Test Actor', role: 'coach' }],
          error: null,
        }),
      }),
    } as any)

    const { getAuditLogForSubject } = await import('./audit-visibility')
    const result = await getAuditLogForSubject('user-a', 1, 50)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.totalCount).toBe(60)
      expect(result.data.hasMore).toBe(true)
      expect(result.data.entries).toHaveLength(1)
    }
  })
})

describe('getAuditLogForSubjectByToken()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns unauthorized for invalid token', async () => {
    vi.spyOn(dataRightsModule, 'validateToken').mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', message: 'Token inválido ou expirado' },
    })

    const { getAuditLogForSubjectByToken } = await import('./audit-visibility')
    const result = await getAuditLogForSubjectByToken('bad-token', 1, 50)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('returns audit logs for valid token (Encarregado sees child logs)', async () => {
    vi.spyOn(dataRightsModule, 'validateToken').mockResolvedValue({
      ok: true,
      data: { valid: true, playerId: 'player-123', playerName: 'Tomás' },
    })

    const sampleEntry = {
      id: 'log-1',
      actor_id: 'actor-1',
      action: 'viewed_fatigue_response',
      target_kind: 'fatigue_response',
      target_id: 'player-123',
      occurred_at: '2026-05-22T10:00:00.000Z',
      payload: null,
    }

    const queryChain = buildQueryMock([sampleEntry], 1)

    vi.spyOn(serviceRoleModule, 'getServiceRoleClient').mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'player-123', profile_id: 'profile-abc' },
              error: null,
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'actor-1', full_name: 'João Silva', role: 'coach' }],
              error: null,
            }),
          }
        }
        return queryChain
      }),
    } as any)

    const { getAuditLogForSubjectByToken } = await import('./audit-visibility')
    const result = await getAuditLogForSubjectByToken('valid-token', 1, 50)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.entries).toHaveLength(1)
      expect(result.data.actorMap['actor-1']).toBeDefined()
    }
  })

  it('returns not_found when player does not exist', async () => {
    vi.spyOn(dataRightsModule, 'validateToken').mockResolvedValue({
      ok: true,
      data: { valid: true, playerId: 'missing-player', playerName: 'Ghost' },
    })

    vi.spyOn(serviceRoleModule, 'getServiceRoleClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any)

    const { getAuditLogForSubjectByToken } = await import('./audit-visibility')
    const result = await getAuditLogForSubjectByToken('valid-token', 1, 50)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })
})
