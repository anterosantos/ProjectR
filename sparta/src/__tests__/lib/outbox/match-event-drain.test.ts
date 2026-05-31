/**
 * match-event-drain.test.ts
 *
 * Tests for match-event.submit and lineup.substitution handlers in drain.ts.
 * Mocks must be declared before drain module is imported.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/actions/events', () => ({
  submitMatchEvent: vi.fn().mockResolvedValue({ ok: true, data: { id: 'mock-id' } }),
}))

vi.mock('@/lib/actions/substitutions', () => ({
  registerSubstitution: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  getMatchLineupForSubs: vi.fn(),
  closeMatchRecord: vi.fn(),
}))

vi.mock('@/lib/actions/fatigue', () => ({
  submitFatigueResponse: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

import * as eventsActions from '@/lib/actions/events'
import * as substitutionsActions from '@/lib/actions/substitutions'
import { drainPendingMutations } from '@/lib/outbox/drain'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { db } from '@/lib/outbox/db'

const VALID_MATCH_EVENT_PAYLOAD = {
  id: '01920000-0000-7000-8000-000000000001',
  action: 'ball_loss' as const,
  zone: 'def_left' as const,
  player_id: '01920000-0000-7000-8000-000000000002',
  session_id: '01920000-0000-7000-8000-000000000003',
  occurred_at: new Date().toISOString(),
  captured_via: 'offline-drain' as const,
}

const VALID_SUB_PAYLOAD = {
  sessionId: '01920000-0000-7000-8000-000000000003',
  outPlayerId: '01920000-0000-7000-8000-000000000002',
  inPlayerId: '01920000-0000-7000-8000-000000000004',
  minute: 30,
}

beforeEach(async () => {
  await db.outbox.clear()
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(eventsActions.submitMatchEvent).mockResolvedValue({ ok: true, data: { id: 'mock-id' } } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(substitutionsActions.registerSubstitution).mockResolvedValue({ ok: true, data: undefined } as any)
})

describe('handler "match-event.submit"', () => {
  it('happy path: chama submitMatchEvent com payload correcto e marca synced', async () => {
    const id = await enqueueMutation('match-event.submit', VALID_MATCH_EVENT_PAYLOAD)

    const result = await drainPendingMutations('match-event.submit')

    expect(eventsActions.submitMatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: VALID_MATCH_EVENT_PAYLOAD.id,
      action: 'ball_loss',
      zone: 'def_left',
    }))
    expect(result.drained).toBe(1)
    expect(result.failed).toBe(0)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })

  it('payload inválido (UUID inválido): lança VALIDATION_ERROR — não faz retry, marca failed na 1ª tentativa', async () => {
    const invalidPayload = { ...VALID_MATCH_EVENT_PAYLOAD, id: 'not-a-uuid' }
    const id = await enqueueMutation('match-event.submit', invalidPayload)

    const result = await drainPendingMutations('match-event.submit')

    expect(eventsActions.submitMatchEvent).not.toHaveBeenCalled()
    expect(result.failed).toBe(1)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('failed')
  })

  it('Server Action retorna ok:false: lança erro genérico — incrementa retryCount (faz retry)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(eventsActions.submitMatchEvent).mockResolvedValueOnce({
      ok: false,
      error: { code: 'unknown', message: 'Erro de servidor' },
    } as any)

    const id = await enqueueMutation('match-event.submit', VALID_MATCH_EVENT_PAYLOAD)

    const result = await drainPendingMutations('match-event.submit')

    expect(result.failed).toBe(1)

    const entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(1)
    expect(entry?.status).toBe('pending')
  })
})

describe('handler "lineup.substitution"', () => {
  it('happy path: chama registerSubstitution com args correctos e marca synced', async () => {
    const id = await enqueueMutation('lineup.substitution', VALID_SUB_PAYLOAD)

    const result = await drainPendingMutations('lineup.substitution')

    expect(substitutionsActions.registerSubstitution).toHaveBeenCalledWith(
      VALID_SUB_PAYLOAD.sessionId,
      VALID_SUB_PAYLOAD.outPlayerId,
      VALID_SUB_PAYLOAD.inPlayerId,
      VALID_SUB_PAYLOAD.minute,
    )
    expect(result.drained).toBe(1)
    expect(result.failed).toBe(0)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })

  it('payload inválido (campo em falta): lança VALIDATION_ERROR — marca failed', async () => {
    const invalidPayload = { sessionId: 'sess', outPlayerId: 'p1' } // inPlayerId e minute em falta
    const id = await enqueueMutation('lineup.substitution', invalidPayload)

    const result = await drainPendingMutations('lineup.substitution')

    expect(substitutionsActions.registerSubstitution).not.toHaveBeenCalled()
    expect(result.failed).toBe(1)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('failed')
  })

  it('Server Action retorna ok:false: lança erro — incrementa retryCount', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(substitutionsActions.registerSubstitution).mockResolvedValueOnce({
      ok: false,
      error: { code: 'unknown', message: 'Falha de rede' },
    } as any)

    const id = await enqueueMutation('lineup.substitution', VALID_SUB_PAYLOAD)

    const result = await drainPendingMutations('lineup.substitution')

    expect(result.failed).toBe(1)

    const entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(1)
    expect(entry?.status).toBe('pending')
  })
})

describe('drain ordering — subs antes de eventos', () => {
  it('drena lineup.substitution antes de match-event.submit independentemente da ordem de enqueue', async () => {
    const callOrder: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(eventsActions.submitMatchEvent).mockImplementation(async () => {
      callOrder.push('event')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ok: true, data: { id: 'mock-id' } } as any
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(substitutionsActions.registerSubstitution).mockImplementation(async () => {
      callOrder.push('sub')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ok: true, data: undefined } as any
    })

    // Enfileirar evento primeiro, substituição depois (ordem invertida intencional)
    await enqueueMutation('match-event.submit', VALID_MATCH_EVENT_PAYLOAD)
    await enqueueMutation('lineup.substitution', VALID_SUB_PAYLOAD)

    // Drain em dois passos — substituições ANTES de eventos (como useMatchOutboxDrain faz)
    await drainPendingMutations('lineup.substitution')
    await drainPendingMutations('match-event.submit')

    expect(callOrder).toEqual(['sub', 'event'])
  })
})
