/**
 * drain-fatigue-handler.test.ts
 *
 * Tests for the fatigue.submit handler registered in drain.ts.
 * Isolated in a separate file to scope the vi.mock() for @/lib/actions/fatigue.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock must be declared before the drain module is imported
vi.mock('@/lib/actions/fatigue', () => ({
  submitFatigueResponse: vi.fn(),
}))

import * as fatigueActions from '@/lib/actions/fatigue'
import { drainPendingMutations } from '@/lib/outbox/drain'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { db } from '@/lib/outbox/db'
import type { Result, AppError } from '@/lib/types'

const PLAYER_A  = 'a1000000-0000-4000-8000-000000000001'
const SESSION_A = 'b2000000-0000-4000-8000-000000000001'

const VALID_PAYLOAD = {
  id: 'f0000000-0000-4000-8000-000000000001',
  player_id: PLAYER_A,
  session_id: SESSION_A,
  phase: 'pre' as const,
  dim_energy: 3,
  dim_focus: 4,
  dim_sleep: 2,
  dim_soreness: 3,
  dim_mood: 4,
  srpe_value: null,
  submitted_via: 'offline-drain' as const,
}

beforeEach(async () => {
  await db.outbox.clear()
  vi.clearAllMocks()
})

describe('fatigue.submit drain handler', () => {
  it('marks entry synced when submitFatigueResponse returns ok:true', async () => {
    vi.mocked(fatigueActions.submitFatigueResponse).mockResolvedValueOnce({
      ok: true,
      data: undefined,
    } as unknown as Result<void, AppError>)

    const id = await enqueueMutation('fatigue.submit', VALID_PAYLOAD)

    const result = await drainPendingMutations('fatigue.submit')

    expect(fatigueActions.submitFatigueResponse).toHaveBeenCalledWith(VALID_PAYLOAD)
    expect(result.drained).toBe(1)
    expect(result.failed).toBe(0)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })

  it('increments retryCount when submitFatigueResponse returns ok:false', async () => {
    vi.mocked(fatigueActions.submitFatigueResponse).mockResolvedValueOnce({
      ok: false,
      error: { code: 'internal', message: 'Server error' },
    } as unknown as Result<void, AppError>)

    const id = await enqueueMutation('fatigue.submit', VALID_PAYLOAD)

    const result = await drainPendingMutations('fatigue.submit')

    expect(result.failed).toBe(1)

    const entry = await db.outbox.get(id)
    // First failure: retryCount=1, status=pending (not yet at max retries)
    expect(entry?.retryCount).toBe(1)
    expect(entry?.status).toBe('pending')
  })

  it('marks failed after 3 consecutive errors from submitFatigueResponse', async () => {
    vi.mocked(fatigueActions.submitFatigueResponse).mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: 'Persistent error' },
    } as unknown as Result<void, AppError>)

    const id = await enqueueMutation('fatigue.submit', VALID_PAYLOAD)

    await drainPendingMutations('fatigue.submit')
    await drainPendingMutations('fatigue.submit')
    await drainPendingMutations('fatigue.submit')

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('failed')
    expect(entry?.retryCount).toBe(3)
  })
})
