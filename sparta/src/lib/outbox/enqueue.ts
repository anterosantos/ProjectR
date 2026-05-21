import { db } from './db'
import { newId } from '@/lib/uuid'

export async function enqueueMutation(kind: string, payload: unknown): Promise<string> {
  const id = newId()
  await db.outbox.add({
    id,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  })
  return id
}
