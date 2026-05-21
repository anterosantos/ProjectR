import Dexie, { type Table } from 'dexie'

export interface PendingMutation {
  id: string
  kind: string
  payload: unknown
  createdAt: string
  status: 'pending' | 'synced' | 'failed'
  retryCount: number
}

export interface CacheEntry {
  key: string
  payload: unknown
  updatedAt: string
}

class OutboxDatabase extends Dexie {
  outbox!: Table<PendingMutation, string>
  cache!: Table<CacheEntry, string>

  constructor() {
    super('sparta')
    this.version(1).stores({
      outbox: 'id, kind, status, createdAt, retryCount',
      cache: 'key, payload, updatedAt',
    })
  }
}

export const db = new OutboxDatabase()
