import { describe, it, expect } from 'vitest'
import { formatAuditLogDateTime } from './date-time'

describe('formatAuditLogDateTime()', () => {
  it('formats a UTC ISO string in PT-PT locale', () => {
    const result = formatAuditLogDateTime('2026-05-22T10:30:45.000Z')
    // Accepts local timezone rendering; just validate structure and PT-PT months
    expect(result).toMatch(/\d{1,2} de \w+ de \d{4} às \d{2}:\d{2}/)
  })

  it('uses Portuguese month names', () => {
    const result = formatAuditLogDateTime('2026-01-15T08:00:00.000Z')
    expect(result).toContain('de janeiro de')
  })

  it('uses Portuguese month for maio', () => {
    const result = formatAuditLogDateTime('2026-05-07T10:30:00.000Z')
    expect(result).toContain('de maio de 2026')
  })

  it('formats time as HH:mm', () => {
    const result = formatAuditLogDateTime('2026-03-01T09:05:00.000Z')
    // Time part "às HH:mm" — exact value depends on local timezone in test env
    expect(result).toMatch(/às \d{2}:\d{2}$/)
  })

  it('handles midnight correctly', () => {
    const result = formatAuditLogDateTime('2026-06-15T00:00:00.000Z')
    expect(result).toMatch(/\d{1,2} de \w+ de \d{4} às \d{2}:\d{2}/)
  })

  it('handles end of year correctly', () => {
    const result = formatAuditLogDateTime('2025-12-31T23:59:00.000Z')
    expect(result).toMatch(/\d{1,2} de dezembro de/)
  })
})
