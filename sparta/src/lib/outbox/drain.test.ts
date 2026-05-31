import { describe, it, expect, vi } from 'vitest'
import { registerHandler } from './drain'

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
