import { drainOutbox } from './drain'

let lastDrainTime = 0
const DRAIN_DEBOUNCE_MS = 1000

export function registerDrainTriggers(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const debouncedDrain = () => {
    const now = Date.now()
    if (now - lastDrainTime < DRAIN_DEBOUNCE_MS) {
      return
    }
    lastDrainTime = now
    void drainOutbox()
  }

  const handleOnline = () => {
    debouncedDrain()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      debouncedDrain()
    }
  }

  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
