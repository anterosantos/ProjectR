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
  submitRectificationRequest,
  submitRectificationRequestByToken,
  approveRectification,
  rejectRectification,
  restrictProcessing,
  unrestrictProcessing,
  restrictProcessingByToken,
  checkProcessingRestricted,
  withdrawConsent,
  withdrawConsentByToken,
  __clearTokenValidationCache,
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
  beforeEach(async () => {
    vi.clearAllMocks()
    await __clearTokenValidationCache()
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
  beforeEach(async () => {
    vi.clearAllMocks()
    await __clearTokenValidationCache()
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

// =============================================================================
// Story 3.8: Direito de Retificação
// =============================================================================

const PLAYER_ID_3 = 'c0000000-0000-7000-8000-000000000003'
const REQUEST_ID = 'd0000000-0000-7000-8000-000000000004'

describe('submitRectificationRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sucesso: retorna submitted:true com requestId', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: REQUEST_ID }, error: null })
    const mockInsertChain = {
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
    }
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PLAYER_ID_3, club_id: 'club-1', full_name: 'João', birthdate: '2010-01-01', jersey_num: 5 },
              error: null,
            }),
          }
        }
        if (table === 'rectification_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnValue(mockInsertChain),
          }
        }
        return {}
      }),
    })

    const result = await submitRectificationRequest({
      fieldName: 'full_name',
      requestedValue: 'João Manuel Silva',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.submitted).toBe(true)
      expect(result.data.requestId).toBe(REQUEST_ID)
    }
  })

  it('sem player: retorna err not_found', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })

    const result = await submitRectificationRequest({
      fieldName: 'full_name',
      requestedValue: 'Novo Nome',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })
})

describe('submitRectificationRequestByToken', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await __clearTokenValidationCache()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: retorna submitted:true', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: REQUEST_ID }, error: null })
    const mockInsertChain = { select: vi.fn().mockReturnThis(), single: mockSingle }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ valid: true, playerId: PLAYER_ID_3, playerName: 'João' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PLAYER_ID_3, club_id: 'club-1', full_name: 'João', birthdate: '2010-01-01', jersey_num: 5 },
              error: null,
            }),
          }
        }
        if (table === 'rectification_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnValue(mockInsertChain),
          }
        }
        return {}
      }),
    })

    const result = await submitRectificationRequestByToken('valid-token-abc123', {
      fieldName: 'full_name',
      requestedValue: 'João Manuel',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.submitted).toBe(true)
    }
  })
})

describe('approveRectification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
    vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@test.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('staff aprova: retorna applied:true e audit log inserido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg1' }), { status: 200 })
    ))

    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
    const mockRequestUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockPlayerUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'coach', club_id: 'club-1' },
              error: null,
            }),
          }
        }
        if (table === 'rectification_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: mockRequestUpdate,
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: REQUEST_ID,
                status: 'pending',
                club_id: 'club-1',
                player_id: PLAYER_ID_3,
                field_name: 'full_name',
                requested_value: 'Novo Nome',
                current_value: 'Nome Antigo',
              },
              error: null,
            }),
          }
        }
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            update: mockPlayerUpdate,
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: USER_ID, full_name: 'João' },
              error: null,
            }),
          }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'joao@example.com' } }, error: null }),
        },
      },
    })

    const result = await approveRectification(REQUEST_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.applied).toBe(true)
    }
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.rectified',
        target_kind: 'player',
        target_id: PLAYER_ID_3,
      })
    )
  })
})

describe('rejectRectification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
    vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@test.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('staff rejeita com motivo: retorna rejected:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg1' }), { status: 200 })
    ))

    const mockRequestUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'coach', club_id: 'club-1' },
              error: null,
            }),
          }
        }
        if (table === 'rectification_requests') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: mockRequestUpdate,
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: REQUEST_ID,
                status: 'pending',
                club_id: 'club-1',
                player_id: PLAYER_ID_3,
                field_name: 'full_name',
              },
              error: null,
            }),
          }
        }
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: USER_ID, full_name: 'João' },
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'joao@example.com' } }, error: null }),
        },
      },
    })

    const result = await rejectRectification(REQUEST_ID, 'Dados já estão corretos no sistema')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.rejected).toBe(true)
    }
  })
})

// =============================================================================
// Story 3.9: Direito de Limitação do Tratamento
// =============================================================================

const CLUB_ID = 'e0000000-0000-7000-8000-000000000005'

describe('restrictProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso: retorna restricted:true e audit log inserido', async () => {
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { club_id: CLUB_ID }, error: null }),
            update: mockProfileUpdate,
          }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {}
      }),
    })

    const result = await restrictProcessing()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.restricted).toBe(true)
    }
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.restricted',
        target_kind: 'profile',
        target_id: USER_ID,
      })
    )
  })

  it('não autenticado: retorna err unauthorized', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const result = await restrictProcessing()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })
})

describe('unrestrictProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso: retorna restricted:false e audit log inserido', async () => {
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { club_id: CLUB_ID }, error: null }),
            update: mockProfileUpdate,
          }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {}
      }),
    })

    const result = await unrestrictProcessing()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.restricted).toBe(false)
    }
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.unrestricted',
        target_kind: 'profile',
        target_id: USER_ID,
      })
    )
  })
})

describe('restrictProcessingByToken', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await __clearTokenValidationCache()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: retorna restricted:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ valid: true, playerId: PLAYER_ID, playerName: 'João' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))

    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
    const mockPlayerUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { club_id: CLUB_ID }, error: null }),
            update: mockPlayerUpdate,
          }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {}
      }),
    })

    const result = await restrictProcessingByToken('valid-token-abc123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.restricted).toBe(true)
    }
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.restricted',
        target_kind: 'player',
        target_id: PLAYER_ID,
        actor_id: null,
      })
    )
  })
})

// =============================================================================
// Story 3.10: Direito de Retirada de Consentimento
// =============================================================================

const CLUB_ID_3_10 = 'f0000000-0000-7000-8000-000000000010'

describe('withdrawConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sucesso: retorna withdrawn:true, audit log subject.withdrew inserido, cascade chamado', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null })
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
        signOut: mockSignOut,
      },
    })

    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PLAYER_ID, club_id: CLUB_ID_3_10 },
              error: null,
            }),
          }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {}
      }),
    })

    // Mock erase-cascade Edge Function
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, erased: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))

    const result = await withdrawConsent()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.withdrawn).toBe(true)
    }

    // Verify audit log was inserted with correct action (compliance critical)
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.withdrew',
        actor_id: USER_ID,
        target_kind: 'player',
        target_id: PLAYER_ID,
      })
    )

    // Verify audit log was inserted BEFORE cascade (fetch call)
    // This ensures compliance ordering: audit log must exist before erasure
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    expect(mockAuditInsert.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetch.mock.invocationCallOrder[0] ?? Infinity
    )

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('não autenticado: retorna err unauthorized', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const result = await withdrawConsent()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('sem player: retorna err not_found', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    })
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const result = await withdrawConsent()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })
})

describe('withdrawConsentByToken', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await __clearTokenValidationCache()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: retorna withdrawn:true, parental_consents atualizado, audit log inserido', async () => {
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
    const mockParentalUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockProfileUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const mockFetch = vi.fn()
      // Primeira chamada: validate-subject-token
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, playerId: PLAYER_ID, playerName: 'João' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      // Segunda chamada: erase-cascade
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, erased: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', mockFetch)

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PLAYER_ID, club_id: CLUB_ID_3_10, profile_id: USER_ID },
              error: null,
            }),
          }
        }
        if (table === 'parental_consents') {
          return { update: mockParentalUpdate }
        }
        if (table === 'profiles') {
          return { update: mockProfileUpdate }
        }
        if (table === 'audit_logs') {
          return { insert: mockAuditInsert }
        }
        return {}
      }),
    })

    const result = await withdrawConsentByToken('valid-token-abc123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.withdrawn).toBe(true)
    }

    // Verify parental_consents.status update was called
    expect(mockParentalUpdate).toHaveBeenCalled()

    // Verify profiles.consent_status update was called
    expect(mockProfileUpdate).toHaveBeenCalled()

    // Verify audit log was inserted
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subject.withdrew',
        actor_id: null,
        target_kind: 'player',
        target_id: PLAYER_ID,
      })
    )
  })

  it('token inválido (formato errado): retorna err unauthorized sem fetch', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const result = await withdrawConsentByToken('bad token!!!')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('checkProcessingRestricted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna true quando processing_restricted=true', async () => {
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { processing_restricted: true }, error: null }),
      }),
    })

    const result = await checkProcessingRestricted(PLAYER_ID)
    expect(result).toBe(true)
  })

  it('retorna false quando processing_restricted=false', async () => {
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { processing_restricted: false }, error: null }),
      }),
    })

    const result = await checkProcessingRestricted(PLAYER_ID)
    expect(result).toBe(false)
  })
})
