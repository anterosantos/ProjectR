import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const TEST_DENO = {
  env: {
    get: (key: string): string | undefined => {
      const env: Record<string, string> = {
        APP_URL: 'http://localhost:3000',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      }
      return env[key]
    },
  },
  serve: vi.fn(),
}

import { handler } from '../../../supabase/functions/erase-cascade/index'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const PLAYER_ID = 'a0000000-0000-7000-8000-000000000001'
const ACTOR_ID = 'b0000000-0000-7000-8000-000000000002'
const PROFILE_ID = 'c0000000-0000-7000-8000-000000000003'

function makeRequest(body: unknown, serviceRoleKey = 'test-service-role-key') {
  return new Request('http://localhost/erase-cascade', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  })
}

function setupSupabaseMock(opts: {
  rpcResult?: { ok: boolean; erased?: boolean; profile_id?: string; error?: string }
  authDeleteError?: boolean
} = {}) {
  const rpcResult = opts.rpcResult ?? { ok: true, erased: true, profile_id: PROFILE_ID }

  const mockDeleteUser = vi.fn().mockResolvedValue({
    error: opts.authDeleteError ? { message: 'User not found' } : null,
  })

  mockCreateClient.mockReturnValue({
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
    auth: {
      admin: { deleteUser: mockDeleteUser },
    },
  })
}

describe('handler — erase-cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Deno', TEST_DENO)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cascata completa: executa sem erro e retorna ok:true, erased:true', async () => {
    setupSupabaseMock()

    const res = await handler(makeRequest({ playerId: PLAYER_ID, actorId: ACTOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.erased).toBe(true)
  })

  it('auth user deletion falha (já deletado): retorna sucesso por idempotência', async () => {
    setupSupabaseMock({ authDeleteError: true })

    const res = await handler(makeRequest({ playerId: PLAYER_ID, actorId: ACTOR_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.erased).toBe(true)
  })

  it('playerId inválido: retorna 400 com error invalid_player_id', async () => {
    const res = await handler(makeRequest({ playerId: 'not-a-uuid!!!', actorId: ACTOR_ID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('invalid_player_id')
  })

  it('actorId inválido: retorna 400 com error invalid_actor_id', async () => {
    const res = await handler(makeRequest({ playerId: PLAYER_ID, actorId: 'bad-actor' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('invalid_actor_id')
  })

  it('playerId não existe (not_found): retorna 404', async () => {
    setupSupabaseMock({ rpcResult: { ok: false, error: 'not_found' } })

    const res = await handler(makeRequest({ playerId: PLAYER_ID, actorId: ACTOR_ID }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('not_found')
  })
})
