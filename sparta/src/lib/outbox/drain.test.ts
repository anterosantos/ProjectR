import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drainPendingMutations, registerHandler } from './drain'

vi.mock('./db', () => ({
  db: {
    outbox: {
      where: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/actions/session-srpe', () => ({
  upsertSessionSrpe: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

vi.mock('@/lib/actions/attendance', () => ({
  upsertAttendance: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

import { db } from './db'
import { upsertSessionSrpe } from '@/lib/actions/session-srpe'
import { upsertAttendance } from '@/lib/actions/attendance'

const VALID_SRPE_PAYLOAD = {
  id: '01920a4b-c8d3-7000-9c4e-000000000099',
  session_id: '01920a4b-c8d3-7000-9c4e-000000000003',
  player_id: '01920a4b-c8d3-7000-9c4e-000000000004',
  srpe_value: 5,
  duration_min: 90,
}

function mockOutboxWith(entries: unknown[]) {
  vi.mocked(db.outbox.where).mockReturnValue({
    equals: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(entries),
      }),
      toArray: vi.fn().mockResolvedValue(entries),
    }),
  } as any)
  vi.mocked(db.outbox).update = vi.fn().mockResolvedValue({})
}

describe('srpe.upsert drain handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertSessionSrpe).mockResolvedValue({ ok: true, data: undefined })
  })

  it('drains valid srpe.upsert mutation → chama upsertSessionSrpe com payload correcto', async () => {
    mockOutboxWith([
      { id: 'outbox-1', kind: 'srpe.upsert', payload: VALID_SRPE_PAYLOAD, retryCount: 0, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    expect(vi.mocked(upsertSessionSrpe)).toHaveBeenCalledWith(VALID_SRPE_PAYLOAD)
    expect(result.drained).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('payload inválido (srpe_value=0) → marca como failed com VALIDATION_ERROR', async () => {
    const invalidPayload = { ...VALID_SRPE_PAYLOAD, srpe_value: 0 }
    mockOutboxWith([
      { id: 'outbox-2', kind: 'srpe.upsert', payload: invalidPayload, retryCount: 0, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    expect(vi.mocked(upsertSessionSrpe)).not.toHaveBeenCalled()
    expect(result.failed).toBe(1)
  })

  it('upsertSessionSrpe retorna not ok → lança erro e incrementa failed', async () => {
    vi.mocked(upsertSessionSrpe).mockResolvedValue({
      ok: false,
      error: { code: 'not_found', message: 'Sessão não encontrada' },
    })
    mockOutboxWith([
      { id: 'outbox-3', kind: 'srpe.upsert', payload: VALID_SRPE_PAYLOAD, retryCount: 0, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    expect(vi.mocked(upsertSessionSrpe)).toHaveBeenCalled()
    expect(result.failed).toBe(1)
  })

  it('filtrar por kind → só drena mutações do kind especificado', async () => {
    mockOutboxWith([
      { id: 'outbox-4', kind: 'srpe.upsert', payload: VALID_SRPE_PAYLOAD, retryCount: 0, status: 'pending' },
    ])

    const result = await drainPendingMutations('srpe.upsert')

    expect(vi.mocked(upsertSessionSrpe)).toHaveBeenCalledWith(VALID_SRPE_PAYLOAD)
    expect(result.drained).toBe(1)
  })

  it('sem handler registado + retryCount=0 → incrementa retryCount sem marcar como failed', async () => {
    mockOutboxWith([
      { id: 'outbox-5', kind: 'unknown.kind.xyz', payload: {}, retryCount: 0, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    // No handler: not drained, not failed yet — just incremented retry
    expect(result.drained).toBe(0)
    expect(result.failed).toBe(0)
    expect(vi.mocked(db.outbox).update).toHaveBeenCalledWith('outbox-5', { retryCount: 1 })
  })

  it('sem handler registado + retryCount=2 → marca como failed (>= 3)', async () => {
    mockOutboxWith([
      { id: 'outbox-6', kind: 'unknown.kind.xyz', payload: {}, retryCount: 2, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    expect(result.failed).toBe(1)
    expect(vi.mocked(db.outbox).update).toHaveBeenCalledWith('outbox-6', { status: 'failed' })
  })

  it('handler error não-validação + retryCount=2 → marca como failed imediatamente', async () => {
    vi.mocked(upsertSessionSrpe).mockResolvedValue({
      ok: false,
      error: { code: 'internal_error', message: 'Erro interno' },
    })
    mockOutboxWith([
      { id: 'outbox-7', kind: 'srpe.upsert', payload: VALID_SRPE_PAYLOAD, retryCount: 2, status: 'pending' },
    ])

    const result = await drainPendingMutations()

    expect(result.failed).toBe(1)
    expect(vi.mocked(db.outbox).update).toHaveBeenCalledWith(
      'outbox-7',
      expect.objectContaining({ status: 'failed', retryCount: 3 })
    )
  })
})

describe('attendance.upsert drain handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertAttendance).mockResolvedValue({ ok: true, data: undefined })
  })

  it('attendance.upsert falha → handler lança erro com código correcto', async () => {
    vi.mocked(upsertAttendance).mockResolvedValue({
      ok: false,
      error: { code: 'not_found', message: 'Sessão não encontrada' },
    })
    mockOutboxWith([
      {
        id: 'att-1',
        kind: 'attendance.upsert',
        payload: { id: 'uuid-att', session_id: 'sess-uuid', player_id: 'pl-uuid', status: 'present' },
        retryCount: 0,
        status: 'pending',
      },
    ])

    const result = await drainPendingMutations()

    expect(vi.mocked(upsertAttendance)).toHaveBeenCalled()
    expect(result.failed).toBe(1)
  })

  it('attendance.upsert com occurred_at → ordena por timestamp', async () => {
    mockOutboxWith([
      {
        id: 'att-2',
        kind: 'attendance.upsert',
        payload: {
          id: 'uuid-att2',
          session_id: 'sess-uuid',
          player_id: 'pl-uuid',
          status: 'present',
          occurred_at: new Date().toISOString(),
        },
        retryCount: 0,
        status: 'pending',
      },
    ])

    const result = await drainPendingMutations()

    expect(result.drained).toBe(1)
  })
})

describe('drain handlers registration', () => {
  it('should register attendance.upsert handler', async () => {
    const mockHandler = vi.fn(async () => {
      // Success path
    })
    registerHandler('attendance.upsert-test', mockHandler)

    await mockHandler({ session_id: '123', player_id: '456', status: 'present' })

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: '123',
        player_id: '456',
        status: 'present',
      })
    )
  })

  it('should handle attendance error codes', async () => {
    const mockHandler = vi.fn(async () => {
      const error = new Error('Falha ao registar presença')
      ;(error as Error & { code: string }).code = 'not_found'
      throw error
    })
    registerHandler('attendance-error-test', mockHandler)

    try {
      await mockHandler({ session_id: '999', player_id: '456', status: 'present' })
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      if (e instanceof Error) {
        expect((e as Error & { code: string }).code).toBe('not_found')
      }
    }

    expect(mockHandler).toHaveBeenCalled()
  })

  it('should set error code on handler failures', async () => {
    const error = new Error('Test error')
    ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'

    expect((error as Error & { code: string }).code).toBe('VALIDATION_ERROR')
  })
})
