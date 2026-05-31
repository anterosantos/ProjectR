import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/readiness/snapshot', () => ({
  refreshSnapshotForSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/actions/auth', () => ({
  requireStaffRole: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { requireStaffRole as mockRequireStaffRole } from '@/lib/actions/auth'
import { upsertSessionSrpe, getSessionSrpeData } from '@/lib/actions/session-srpe'

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_UUID = '01920a4b-c8d3-7000-9c4e-000000000001'
const CLUB_UUID = '01920a4b-c8d3-7000-9c4e-000000000002'
const SESSION_UUID = '01920a4b-c8d3-7000-9c4e-000000000003'
const PLAYER_UUID = '01920a4b-c8d3-7000-9c4e-000000000004'
const SRPE_UUID = '01920a4b-c8d3-7000-9c4e-000000000005'
const PLAYER2_UUID = '01920a4b-c8d3-7000-9c4e-000000000006'

const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>
const mockRequireStaffRoleFn = mockRequireStaffRole as ReturnType<typeof vi.fn>

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function setupRequireStaffRole(userId = USER_UUID, clubId = CLUB_UUID, ok = true) {
  if (!ok) {
    mockRequireStaffRoleFn.mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' },
    })
  } else {
    mockRequireStaffRoleFn.mockResolvedValue({
      ok: true,
      data: { userId, clubId },
    })
  }
}

// ─── upsertSessionSrpe ────────────────────────────────────────────────────────

describe('upsertSessionSrpe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: upserts com srpe_value 5', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playerChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAYER_UUID, club_id: CLUB_UUID }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const upsertChain = { error: null }

    const attendanceChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return playerChain
        if (table === 'attendances') return attendanceChain
        if (table === 'session_metrics') return { upsert: vi.fn().mockResolvedValue(upsertChain) }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    })

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 5,
      duration_min: 90,
    })

    expect(result.ok).toBe(true)
  })

  it('override: analista sobrescreve valor do jogador', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playerChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAYER_UUID, club_id: CLUB_UUID }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const attendanceChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return playerChain
        if (table === 'attendances') return attendanceChain
        if (table === 'session_metrics') {
          return {
            upsert: vi
              .fn()
              .mockImplementation((payload: Record<string, unknown>) => {
                expect(payload.srpe_value).toBe(8)
                return Promise.resolve({ error: null })
              }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    })

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 8,
      duration_min: 90,
    })

    expect(result.ok).toBe(true)
  })

  it('idempotência: chamar 2x mesma sessão+jogador retorna ok ambas', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playerChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAYER_UUID, club_id: CLUB_UUID }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const upsertChain = { error: null }

    const attendanceChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return playerChain
        if (table === 'attendances') return attendanceChain
        if (table === 'session_metrics') return { upsert: vi.fn().mockResolvedValue(upsertChain) }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    })

    const input = {
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 5,
      duration_min: 90,
    }

    const r1 = await upsertSessionSrpe(input)
    const r2 = await upsertSessionSrpe(input)
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
  })

  it('sessão não encontrada → retorna not_found', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue(sessionChain),
    })

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 5,
      duration_min: 90,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('not_found')
    }
  })

  it('requireStaffRole falha → retorna unauthorized', async () => {
    setupRequireStaffRole(USER_UUID, CLUB_UUID, false)

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 5,
      duration_min: 90,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('unauthorized')
    }
  })

  it('isSrpeInputValid falha (srpe=0) → retorna validation error', async () => {
    setupRequireStaffRole()

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 0,
      duration_min: 90,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('validation')
    }
  })

  it('jogador não encontrado → retorna not_found', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playerChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return playerChain
        return {}
      }),
    })

    const result = await upsertSessionSrpe({
      id: SRPE_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      srpe_value: 5,
      duration_min: 90,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('not_found')
    }
  })
})

// ─── getSessionSrpeData ───────────────────────────────────────────────────────

describe('getSessionSrpeData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: retorna jogadores com presenças + valores jogador + valores analista', async () => {
    setupRequireStaffRole()

    const playerRows = [
      { id: PLAYER_UUID, full_name: 'João Silva', jersey_num: 10, is_active: true },
      { id: PLAYER2_UUID, full_name: 'Carlos Matos', jersey_num: 14, is_active: true },
    ]

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playersOrderChain = Promise.resolve({ data: playerRows, error: null })
    const playersEqIsArchived = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue(playersOrderChain),
    })
    const playersEqClub = vi.fn().mockReturnValue({
      eq: playersEqIsArchived,
    })
    const playersSelectChain = {
      eq: playersEqClub,
    }

    const attendanceRows = [
      { player_id: PLAYER_UUID, status: 'present' },
      { player_id: PLAYER2_UUID, status: 'absent' },
    ]

    const metricsRows = [{ player_id: PLAYER_UUID, srpe_value: 7 }]

    const fatigueRows = [
      { player_id: PLAYER_UUID, srpe_value: 5 },
      { player_id: PLAYER2_UUID, srpe_value: 6 },
    ]

    const posRows = [
      { player_id: PLAYER_UUID, position: 'MID' },
      { player_id: PLAYER2_UUID, position: 'DEF' },
    ]

    const posInChain = {
      eq: vi.fn().mockResolvedValue({ data: posRows, error: null }),
    }
    const posSelectChain = {
      in: vi.fn().mockReturnValue(posInChain),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return { select: vi.fn().mockReturnValue(playersSelectChain) }
        if (table === 'attendances') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: attendanceRows, error: null }),
                }),
            }),
          }
        }
        if (table === 'session_metrics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: metricsRows, error: null }),
                }),
            }),
          }
        }
        if (table === 'fatigue_responses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({ data: fatigueRows, error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'positions') return { select: vi.fn().mockReturnValue(posSelectChain) }
        return {}
      }),
    })

    const result = await getSessionSrpeData(SESSION_UUID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.players).toHaveLength(2)
      const joao = result.data.players.find((p) => p.player_id === PLAYER_UUID)
      expect(joao?.existing_analyst_srpe).toBe(7)
      expect(joao?.player_submitted_srpe).toBe(5)
      expect(joao?.attendance_status).toBe('present')
    }
  })

  it('sem presenças (fallback) → todos os jogadores com attendance_status null', async () => {
    setupRequireStaffRole()

    const playerRows = [{ id: PLAYER_UUID, full_name: 'João Silva', jersey_num: 10, is_active: true }]

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playersOrderChain = Promise.resolve({ data: playerRows, error: null })
    const playersEqIsArchived = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue(playersOrderChain),
    })
    const playersEqClub = vi.fn().mockReturnValue({
      eq: playersEqIsArchived,
    })
    const playersSelectChain = {
      eq: playersEqClub,
    }

    const posRows = [{ player_id: PLAYER_UUID, position: 'MID' }]
    const posInChain = {
      eq: vi.fn().mockResolvedValue({ data: posRows, error: null }),
    }
    const posSelectChain = {
      in: vi.fn().mockReturnValue(posInChain),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return { select: vi.fn().mockReturnValue(playersSelectChain) }
        if (table === 'attendances') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
          }
        }
        if (table === 'session_metrics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
          }
        }
        if (table === 'fatigue_responses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'positions') return { select: vi.fn().mockReturnValue(posSelectChain) }
        return {}
      }),
    })

    const result = await getSessionSrpeData(SESSION_UUID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.players).toHaveLength(1)
      expect(result.data.players[0]?.attendance_status).toBeNull()
    }
  })

  it('sessão não encontrada → retorna not_found', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue(sessionChain),
    })

    const result = await getSessionSrpeData(SESSION_UUID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('not_found')
    }
  })

  it('lista vazia (sem jogadores) → retorna array vazio', async () => {
    setupRequireStaffRole()

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID, duration_min: 90 }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }

    const playersOrderChain = Promise.resolve({ data: [], error: null })
    const playersEqIsArchived = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue(playersOrderChain),
    })
    const playersEqClub = vi.fn().mockReturnValue({
      eq: playersEqIsArchived,
    })
    const playersSelectChain = {
      eq: playersEqClub,
    }

    const twoEqChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }

    const fatigueChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sessions') return sessionChain
        if (table === 'players') return { select: vi.fn().mockReturnValue(playersSelectChain) }
        if (table === 'fatigue_responses') return fatigueChain
        return twoEqChain
      }),
    })

    const result = await getSessionSrpeData(SESSION_UUID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.players).toHaveLength(0)
    }
  })
})
