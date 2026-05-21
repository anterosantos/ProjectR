import { db } from './db'

type MutationHandler = (payload: unknown) => Promise<void>

const handlers = new Map<string, MutationHandler>()
let draining = false

export function registerHandler(kind: string, handler: MutationHandler): void {
  handlers.set(kind, handler)
}

export async function drainOutbox(): Promise<{ synced: number; failed: number }> {
  if (draining) {
    console.warn('[outbox] drain already in progress, skipping concurrent call')
    return { synced: 0, failed: 0 }
  }

  draining = true
  try {
    const pending = await db.outbox.where('status').equals('pending').toArray()
    let synced = 0
    let failed = 0

    for (const mutation of pending) {
      const handler = handlers.get(mutation.kind)
      if (!handler) continue

      try {
        await handler(mutation.payload)
        try {
          await db.outbox.update(mutation.id, { status: 'synced' })
          synced++
        } catch (err) {
          console.error(`[outbox] failed to update status for ${mutation.id}:`, err)
          failed++
        }
      } catch (err) {
        console.error(`[outbox] handler error for kind=${mutation.kind}, id=${mutation.id}:`, err)
        const newRetryCount = mutation.retryCount + 1
        try {
          await db.outbox.update(mutation.id, {
            retryCount: newRetryCount,
            status: newRetryCount >= 3 ? 'failed' : 'pending',
          })
        } catch (updateErr) {
          console.error(`[outbox] failed to update retry count for ${mutation.id}:`, updateErr)
        }
        failed++
      }
    }

    return { synced, failed }
  } finally {
    draining = false
  }
}
