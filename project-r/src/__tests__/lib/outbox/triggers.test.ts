import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/outbox/drain', () => ({
  drainOutbox: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
}))

import { drainOutbox } from '@/lib/outbox/drain'

describe('registerDrainTriggers()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('registers online and visibilitychange listeners and returns cleanup', async () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener')
    const docAddEventSpy = vi.spyOn(document, 'addEventListener')

    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    expect(addEventSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(docAddEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    cleanup()
    addEventSpy.mockRestore()
    docAddEventSpy.mockRestore()
  })

  it('cleanup removes online and visibilitychange listeners', async () => {
    const removeEventSpy = vi.spyOn(window, 'removeEventListener')
    const docRemoveEventSpy = vi.spyOn(document, 'removeEventListener')

    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()
    cleanup()

    expect(removeEventSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(docRemoveEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    removeEventSpy.mockRestore()
    docRemoveEventSpy.mockRestore()
  })

  it('online event triggers drainOutbox', async () => {
    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    window.dispatchEvent(new Event('online'))
    await vi.runAllTimersAsync()

    expect(drainOutbox).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('visibilitychange to visible triggers drainOutbox', async () => {
    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.runAllTimersAsync()

    expect(drainOutbox).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('visibilitychange to hidden does not trigger drainOutbox', async () => {
    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.runAllTimersAsync()

    expect(drainOutbox).not.toHaveBeenCalled()
    cleanup()
  })

  it('debounce: second online event within 1s does not trigger drain again', async () => {
    vi.useRealTimers()
    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))

    await new Promise((r) => setTimeout(r, 10))
    expect(drainOutbox).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('returns no-op cleanup when window is undefined (SSR)', async () => {
    vi.stubGlobal('window', undefined)

    const { registerDrainTriggers } = await import('@/lib/outbox/triggers')
    const cleanup = registerDrainTriggers()

    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()

    vi.unstubAllGlobals()
  })
})
