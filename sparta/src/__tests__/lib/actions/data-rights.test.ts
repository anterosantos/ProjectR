import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import {
  requestDataExportForSelf,
  requestDataExportByToken,
  requestDataErasureForSelf,
  requestDataErasureByToken,
} from '@/lib/actions/data-rights'

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>

const PLAYER_ID = 'a0000000-0000-7000-8000-000000000001'
const USER_ID = 'b0000000-0000-7000-8000-000000000002'

function makeQueryChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

function setupAuth(user: unknown) {
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  })
}

function setupServiceRole(player: unknown) {
  const chain = makeQueryChain(player)
  mockGetServiceRoleClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  })
}

function mockFetchOk(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ))
}

function mockFetchFail(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response('error', { status })
  ))
}

describe('requestDataExportForSelf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sucesso: retorna ok=true com url quando sync', async () => {
    setupAuth({ id: USER_ID })
    setupServiceRole({ id: PLAYER_ID })
    mockFetchOk({ ok: true, async: false, url: 'https://example.com/export.zip' })

    const result = await requestDataExportForSelf()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.async).toBe(false)
      expect(result.data.url).toBe('https://example.com/export.zip')
    }
  })

  it('sem player: retorna err com code not_found', async () => {
    setupAuth({ id: USER_ID })
    setupServiceRole(null)

    const result = await requestDataExportForSelf()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })
})

describe('requestDataExportByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: re-valida e retorna ok=true', async () => {
    // First fetch: validate-subject-token → valid
    // Second fetch: export-csv → ok
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, playerId: PLAYER_ID, playerName: 'João' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, async: false, url: 'https://example.com/export.zip' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', mockFetch)

    const result = await requestDataExportByToken('valid-token-abc123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.url).toBe('https://example.com/export.zip')
    }
  })

  it('token inválido (formato errado): retorna err unauthorized sem fazer fetch', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const result = await requestDataExportByToken('bad token!!!')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('requestDataErasureForSelf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sucesso: retorna ok=true com erased:true e chama signOut', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null })
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
        signOut: mockSignOut,
      },
    })
    setupServiceRole({ id: PLAYER_ID })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, erased: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))

    const result = await requestDataErasureForSelf()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.erased).toBe(true)
    }
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('sem player: retorna err com code not_found', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
        signOut: vi.fn(),
      },
    })
    setupServiceRole(null)

    const result = await requestDataErasureForSelf()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })
})

describe('requestDataErasureByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: re-valida e retorna erased:true', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, playerId: PLAYER_ID, playerName: 'João' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, erased: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', mockFetch)

    const result = await requestDataErasureByToken('valid-token-abc123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.erased).toBe(true)
    }
  })

  it('token inválido (formato errado): retorna err unauthorized sem fetch', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const result = await requestDataErasureByToken('bad token!!!')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
