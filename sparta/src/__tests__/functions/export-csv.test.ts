import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const { mockZipFile, mockGenerateAsync } = vi.hoisted(() => ({
  mockZipFile: vi.fn(),
  mockGenerateAsync: vi.fn().mockResolvedValue(new Uint8Array(100)),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('jszip', () => {
  class MockJSZip {
    file: ReturnType<typeof vi.fn>
    generateAsync: ReturnType<typeof vi.fn>
    constructor() {
      this.file = mockZipFile
      this.generateAsync = mockGenerateAsync
    }
  }
  return { default: MockJSZip }
})

const TEST_DENO = {
  env: {
    get: (key: string): string | undefined => {
      const env: Record<string, string> = {
        APP_URL: 'http://localhost:3000',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        BREVO_API_KEY: 'test-brevo-api-key',
        BREVO_SENDER_EMAIL: 'test@sparta.com',
      }
      return env[key]
    },
  },
  serve: vi.fn(),
}

import { handler } from '../../../supabase/functions/export-csv/index'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const PLAYER_ID = 'a0000000-0000-7000-8000-000000000001'

function makeDbChain(rows: unknown[] = [], throwOnSelect = false) {
  if (throwOnSelect) {
    return {
      select: () => { throw new Error('relation does not exist') },
    }
  }
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {
    then: (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(r, j),
    catch: (f: (e: unknown) => unknown) => Promise.resolve(result).catch(f),
    finally: (f: () => void) => Promise.resolve(result).finally(f),
    select: () => chain,
    eq: () => chain,
    insert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  }
  return chain
}

function setupSupabaseMock(opts: { fatigue_responsesShouldThrow?: boolean } = {}) {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'players') return makeDbChain([{ id: PLAYER_ID, full_name: 'João Silva' }])
    if (table === 'fatigue_responses' && opts.fatigue_responsesShouldThrow) {
      return makeDbChain([], true)
    }
    return makeDbChain([])
  })

  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-export.zip' },
      error: null,
    }),
  })

  mockCreateClient.mockReturnValue({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/export-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('handler — export-csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Deno', TEST_DENO)
    mockGenerateAsync.mockResolvedValue(new Uint8Array(100))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sync path (≤5MB): retorna signed URL com ok:true e async:false', async () => {
    setupSupabaseMock()

    const res = await handler(makeRequest({ playerId: PLAYER_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.async).toBe(false)
    expect(body.url).toBe('https://example.com/signed-export.zip')
  })

  it('async path (>5MB): envia email Brevo e retorna async:true sem url', async () => {
    setupSupabaseMock()
    mockGenerateAsync.mockResolvedValue(new Uint8Array(5 * 1024 * 1024 + 1))

    const mockFetch = vi.fn().mockResolvedValue(
      new Response('ok', { status: 200 })
    )
    vi.stubGlobal('fetch', mockFetch)

    const res = await handler(makeRequest({ playerId: PLAYER_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.async).toBe(true)
    expect(body.url).toBeUndefined()
  })

  it('playerId inválido: retorna 400 com error invalid_player_id', async () => {
    const res = await handler(makeRequest({ playerId: 'not-a-uuid!!' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('invalid_player_id')
  })

  it('tabela futura inexistente: não crasha — continua e retorna resultado', async () => {
    setupSupabaseMock({ fatigue_responsesShouldThrow: true })

    const res = await handler(makeRequest({ playerId: PLAYER_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
