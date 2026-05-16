import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { db } from '@/lib/outbox/db'

beforeEach(async () => {
  await db.outbox.clear()
})

describe('enqueueMutation()', () => {
  it('creates a pending entry with the correct shape', async () => {
    const id = await enqueueMutation('test_kind', { value: 42 })
    const entry = await db.outbox.get(id)

    expect(entry).toBeDefined()
    expect(entry?.kind).toBe('test_kind')
    expect(entry?.payload).toEqual({ value: 42 })
    expect(entry?.status).toBe('pending')
    expect(entry?.retryCount).toBe(0)
    expect(entry?.createdAt).toBeTruthy()
  })

  it('returns a valid UUIDv7 id', async () => {
    const id = await enqueueMutation('test', {})
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('generates unique IDs for successive calls', async () => {
    const id1 = await enqueueMutation('kind_a', {})
    const id2 = await enqueueMutation('kind_b', {})
    expect(id1).not.toBe(id2)
  })

  it('stores the entry in the outbox', async () => {
    await enqueueMutation('my_kind', { data: 'test' })
    const count = await db.outbox.count()
    expect(count).toBe(1)
  })
})
