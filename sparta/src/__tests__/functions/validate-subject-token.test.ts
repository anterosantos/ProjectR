import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

vi.stubGlobal('Deno', {
  env: {
    get: (key: string) => {
      const env: Record<string, string> = {
        APP_URL: 'http://localhost:3000',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      }
      return env[key] ?? undefined
    },
  },
  serve: vi.fn(),
})

import { handler, checkRateLimit, TOKEN_PATTERN } from '../../../supabase/functions/validate-subject-token/index'

// Build a fluent Supabase query mock that resolves on .single()
function makeChainedQuery(resolvedValue: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {}
  q['select'] = () => q
  q['eq'] = () => q
  q['single'] = () => Promise.resolve(resolvedValue)
  return q
}

function makeRequest(token: string | null, clientIp = '1.2.3.4') {
  return new Request('http://localhost/validate-subject-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(token !== null ? { token } : {}),
  })
}

describe('checkRateLimit (pure function)', () => {
  it('allows the first request from a new IP', () => {
    expect(checkRateLimit('20.0.0.1')).toBe(true)
  })

  it('blocks the 11th request from the same IP within the window', () => {
    const ip = '20.0.0.2'
    for (let i = 0; i < 10; i++) checkRateLimit(ip)
    expect(checkRateLimit(ip)).toBe(false)
  })
})

describe('TOKEN_PATTERN validation', () => {
  it('accepts alphanumeric + hyphen + underscore tokens', () => {
    expect(TOKEN_PATTERN.test('abc123')).toBe(true)
    expect(TOKEN_PATTERN.test('valid-token_123')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(TOKEN_PATTERN.test('')).toBe(false)
  })

  it('rejects tokens over 256 characters', () => {
    expect(TOKEN_PATTERN.test('a'.repeat(257))).toBe(false)
  })

  it('rejects tokens with spaces or special characters', () => {
    expect(TOKEN_PATTERN.test('bad token')).toBe(false)
    expect(TOKEN_PATTERN.test('<script>')).toBe(false)
    expect(TOKEN_PATTERN.test('a@b.com')).toBe(false)
  })
})

describe('handler — token validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('valid non-expired token: retorna 200 com dados do jogador', async () => {
    const confirmedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

    const fromMock = vi.fn()
    // First call: parental_consents
    fromMock.mockReturnValueOnce(
      makeChainedQuery({
        data: { id: 'c1', player_id: 'p1', parent_email: 'parent@test.com', confirmed_at: confirmedAt },
        error: null,
      })
    )
    // Second call: players
    fromMock.mockReturnValueOnce(
      makeChainedQuery({ data: { id: 'p1', full_name: 'João Silva' }, error: null })
    )
    mockCreateClient.mockReturnValue({ from: fromMock })

    const res = await handler(makeRequest('valid-token-abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.valid).toBe(true)
    expect(body.playerId).toBe('p1')
    expect(body.parentEmail).toBe('parent@test.com')
    expect(body.playerName).toBe('João Silva')
  })

  it('token não encontrado: retorna valid=false reason=not_found', async () => {
    const fromMock = vi.fn().mockReturnValue(
      makeChainedQuery({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
    )
    mockCreateClient.mockReturnValue({ from: fromMock })

    const res = await handler(makeRequest('unknown-token-xyz'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('not_found')
  })

  it('token expirado (>30 dias): retorna valid=false reason=expired', async () => {
    const confirmedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
    const fromMock = vi.fn().mockReturnValue(
      makeChainedQuery({
        data: { id: 'c2', player_id: 'p2', parent_email: 'old@test.com', confirmed_at: confirmedAt },
        error: null,
      })
    )
    mockCreateClient.mockReturnValue({ from: fromMock })

    const res = await handler(makeRequest('expired-token-abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('expired')
  })

  it('confirmed_at null: retorna internal_error', async () => {
    const fromMock = vi.fn().mockReturnValue(
      makeChainedQuery({
        data: { id: 'c3', player_id: 'p3', parent_email: 'x@test.com', confirmed_at: null },
        error: null,
      })
    )
    mockCreateClient.mockReturnValue({ from: fromMock })

    const res = await handler(makeRequest('null-date-token'))
    const body = await res.json()

    expect(body.valid).toBe(false)
    expect(body.reason).toBe('internal_error')
  })

  it('token com caracteres inválidos: retorna 400', async () => {
    const res = await handler(makeRequest('bad token!@#'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.reason).toBe('missing_token')
  })

  it('rate limit: bloqueia o 11º pedido do mesmo IP com 429', async () => {
    const ip = '30.0.0.1'
    const fromMock = vi.fn().mockReturnValue(
      makeChainedQuery({ data: null, error: { code: 'PGRST116' } })
    )
    mockCreateClient.mockReturnValue({ from: fromMock })

    for (let i = 0; i < 10; i++) {
      await handler(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
          body: JSON.stringify({ token: 'dummy-token-abc' }),
        })
      )
    }

    const blocked = await handler(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ token: 'dummy-token-abc' }),
      })
    )
    expect(blocked.status).toBe(429)
    const body = await blocked.json()
    expect(body.reason).toBe('rate_limit_exceeded')
  })
})
