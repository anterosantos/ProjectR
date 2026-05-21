import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '@/lib/outbox/db'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { useOutboxStatus } from '@/lib/outbox/status'

beforeEach(async () => {
  await db.outbox.clear()
})

describe('outbox pending count logic', () => {
  it('pending count is 0 when outbox is empty', async () => {
    const count = await db.outbox.where('status').equals('pending').count()
    expect(count).toBe(0)
  })

  it('pending count increments when mutations are enqueued', async () => {
    await enqueueMutation('kind_a', {})
    await enqueueMutation('kind_b', {})
    const count = await db.outbox.where('status').equals('pending').count()
    expect(count).toBe(2)
  })

  it('pending count decrements when mutation is synced', async () => {
    const id = await enqueueMutation('kind_a', {})
    await db.outbox.update(id, { status: 'synced' })
    const count = await db.outbox.where('status').equals('pending').count()
    expect(count).toBe(0)
  })

  it('failed mutations are not counted as pending', async () => {
    const id = await enqueueMutation('kind_a', {})
    await db.outbox.update(id, { status: 'failed' })
    const count = await db.outbox.where('status').equals('pending').count()
    expect(count).toBe(0)
  })

  it('only pending mutations are counted, not synced or failed', async () => {
    const id1 = await enqueueMutation('kind_a', {})
    const id2 = await enqueueMutation('kind_b', {})
    await enqueueMutation('kind_c', {})

    await db.outbox.update(id1, { status: 'synced' })
    await db.outbox.update(id2, { status: 'failed' })

    const count = await db.outbox.where('status').equals('pending').count()
    expect(count).toBe(1)
  })
})

describe('useOutboxStatus()', () => {
  it('returns pendingCount 0 when outbox is empty', async () => {
    const { result } = renderHook(() => useOutboxStatus())
    await waitFor(() => expect(result.current.pendingCount).toBe(0))
  })

  it('returns pendingCount matching pending entries', async () => {
    await enqueueMutation('kind_a', {})
    await enqueueMutation('kind_b', {})

    const { result } = renderHook(() => useOutboxStatus())
    await waitFor(() => expect(result.current.pendingCount).toBe(2))
  })

  it('unsubscribes without throwing on unmount', async () => {
    const { result, unmount } = renderHook(() => useOutboxStatus())
    await waitFor(() => expect(result.current.pendingCount).toBeDefined())
    expect(() => unmount()).not.toThrow()
  })
})
