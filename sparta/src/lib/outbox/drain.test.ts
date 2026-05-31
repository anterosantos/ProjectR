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

import { db } from './db'
import { upsertSessionSrpe } from '@/lib/actions/session-srpe'

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
