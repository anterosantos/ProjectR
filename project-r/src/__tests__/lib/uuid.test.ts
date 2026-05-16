import { describe, it, expect } from 'vitest'
import { newId } from '@/lib/uuid'

describe('newId()', () => {
  it('returns a valid UUIDv7 string', () => {
    const id = newId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('returns unique IDs', () => {
    const ids = Array.from({ length: 10 }, () => newId())
    const unique = new Set(ids)
    expect(unique.size).toBe(10)
  })

  it('produces monotonically non-decreasing IDs', () => {
    const a = newId()
    const b = newId()
    expect(a <= b).toBe(true)
  })
})
