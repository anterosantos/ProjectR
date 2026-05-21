import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/outbox/db'
import { newId } from '@/lib/uuid'

beforeEach(async () => {
  await db.outbox.clear()
  await db.cache.clear()
})

describe('OutboxDatabase', () => {
  it('can insert and read a pending mutation', async () => {
    const id = newId()
    await db.outbox.add({
      id,
      kind: 'test',
      payload: { x: 1 },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    })
    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('pending')
    expect(entry?.kind).toBe('test')
  })

  it('can update status to synced', async () => {
    const id = newId()
    await db.outbox.add({
      id,
      kind: 'test',
      payload: {},
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    })
    await db.outbox.update(id, { status: 'synced' })
    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('synced')
  })

  it('can update status to failed', async () => {
    const id = newId()
    await db.outbox.add({
      id,
      kind: 'test',
      payload: {},
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    })
    await db.outbox.update(id, { status: 'failed', retryCount: 3 })
    const entry = await db.outbox.get(id)
    expect(entry?.status).toBe('failed')
    expect(entry?.retryCount).toBe(3)
  })

  it('can insert and read a cache entry', async () => {
    await db.cache.put({
      key: 'my-key',
      payload: { data: 'value' },
      updatedAt: new Date().toISOString(),
    })
    const entry = await db.cache.get('my-key')
    expect(entry?.payload).toEqual({ data: 'value' })
  })

  it('outbox and cache stores exist', async () => {
    expect(db.outbox).toBeDefined()
    expect(db.cache).toBeDefined()
  })
})
