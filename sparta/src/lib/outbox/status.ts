'use client'
import { liveQuery } from 'dexie'
import { useState, useEffect } from 'react'
import { db } from './db'

export function useOutboxStatus(): { pendingCount: number } {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const subscription = liveQuery(
      () => db.outbox.where('status').equals('pending').count()
    ).subscribe({
      next: (count) => setPendingCount(count),
      error: () => setPendingCount(0),
    })
    return () => subscription.unsubscribe()
  }, [])

  return { pendingCount }
}
