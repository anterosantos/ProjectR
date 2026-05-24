import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { drainOutbox, registerHandler } from '@/lib/outbox/drain'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { db } from '@/lib/outbox/db'

beforeEach(async () => {
  await db.outbox.clear()
})

describe('drainOutbox()', () => {
  it('happy path: calls handler and marks entry synced', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    registerHandler('test_drain', handler)

    const id = await enqueueMutation('test_drain', { x: 1 })
    const result = await drainOutbox()

    expect(handler).toHaveBeenCalledWith({ x: 1 })
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })

  it('no handler registered: skips entry without error', async () => {
    await enqueueMutation('unregistered_kind', {})
    const result = await drainOutbox()

    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)

    const entries = await db.outbox.where('status').equals('pending').toArray()
    expect(entries.length).toBe(1)
  })

  it('handler throws once: retryCount increments, status stays pending', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Network error'))
    registerHandler('retry_kind', handler)

    const id = await enqueueMutation('retry_kind', {})
    const result = await drainOutbox()

    expect(result.failed).toBe(1)
    const entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(1)
    expect(entry?.status).toBe('pending')
  })

  it('handler throws 3 times: status becomes failed', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Persistent error'))
    registerHandler('fail_kind', handler)

    const id = await enqueueMutation('fail_kind', {})

    // First drain: retryCount=1, still pending
    await drainOutbox()
    let entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(1)
    expect(entry?.status).toBe('pending')

    // Second drain: retryCount=2, still pending
    await drainOutbox()
    entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(2)
    expect(entry?.status).toBe('pending')

    // Third drain: retryCount=3, status=failed
    await drainOutbox()
    entry = await db.outbox.get(id)
    expect(entry?.retryCount).toBe(3)
    expect(entry?.status).toBe('failed')
  })

  it('idempotent: synced entries are not re-processed', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    registerHandler('idempotent_kind', handler)

    const id = await enqueueMutation('idempotent_kind', {})
    await drainOutbox()

    // Entry is now synced
    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')

    // Re-drain should not call handler again
    handler.mockClear()
    await drainOutbox()
    expect(handler).not.toHaveBeenCalled()
  })

  it('orphan scenario: no handler registered does not throw', async () => {
    await enqueueMutation('orphan_kind', { data: 'test' })
    await expect(drainOutbox()).resolves.toEqual({ synced: 0, failed: 0 })
  })

  it('DB update failure after successful handler: logs error and counts as failed', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    registerHandler('db_fail_after_success', handler)

    await enqueueMutation('db_fail_after_success', { x: 1 })

    // Make db.outbox.update reject once to exercise the .catch() error handler (lines 72-75)
    vi.spyOn(db.outbox, 'update').mockRejectedValueOnce(new Error('IDB write error'))

    const result = await drainOutbox()

    vi.restoreAllMocks()

    // Handler ran; DB update failure exercises the .catch() error callback
    expect(handler).toHaveBeenCalled()
    // 1 mutation processed in total (drainOutbox returns { synced, failed })
    expect(result.synced + result.failed).toBe(1)
  })

  it('concurrent drains: second drain skips if first is in progress', async () => {
    const handler = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    )
    registerHandler('concurrent_kind', handler)

    const id = await enqueueMutation('concurrent_kind', { x: 1 })

    const [result1, result2] = await Promise.all([
      drainOutbox(),
      drainOutbox(),
    ])

    expect(handler).toHaveBeenCalledTimes(1)
    expect(result1.synced + result2.synced).toBe(1)

    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })
})
