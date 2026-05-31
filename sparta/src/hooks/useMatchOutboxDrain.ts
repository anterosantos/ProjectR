'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/outbox/db'
import { drainPendingMutations } from '@/lib/outbox/drain'
import { useOnlineStatus } from './useOnlineStatus'

export interface UseMatchOutboxDrainResult {
  pendingCount: number
  isDraining: boolean
  drain: () => Promise<void>
}

export function useMatchOutboxDrain(): UseMatchOutboxDrainResult {
  const { isOnline } = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [isDraining, setIsDraining] = useState(false)
  const isMountedRef = useRef(true)

  // PATCH A-1: Auth protection (AC #5 logout)
  // This hook assumes MatchEventCapture component is mounted only for authenticated users.
  // On logout, MatchEventCapture unmounts (page redirects). Drain will not execute post-logout.
  // If explicit auth check needed, caller should verify session before invoking drain().
  const onlineAtRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const countPending = async (): Promise<number> => {
    // PATCH C-1: Count ALL pending mutations (fatigue + match-events + substituições)
    // for logout protection (AC #5). User should not logout with any pending work.
    return db.outbox
      .where('status')
      .equals('pending')
      .count()
  }

  useEffect(() => {
    const update = async () => {
      if (!isMountedRef.current) return
      try {
        const count = await countPending()
        if (isMountedRef.current) setPendingCount(Math.max(0, count))
      } catch { /* silencioso */ }
    }
    update()
    intervalRef.current = setInterval(update, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const doDrain = useCallback(async () => {
    if (!isMountedRef.current) return
    setIsDraining(true)
    try {
      // Ordenação garantida: substituições ANTES de eventos de jogadores
      await drainPendingMutations('lineup.substitution')
      await drainPendingMutations('match-event.submit')
      if (isMountedRef.current) {
        const count = await countPending()
        setPendingCount(Math.max(0, count))
      }
    } catch (err) {
      console.error('[useMatchOutboxDrain] drain failed:', err)
    } finally {
      if (isMountedRef.current) setIsDraining(false)
    }
  }, [])

  // Auto-drain na transição offline→online
  useEffect(() => {
    if (!isOnline) { onlineAtRef.current = 0; return }
    if (onlineAtRef.current === 0) {
      onlineAtRef.current = Date.now()
      void doDrain()
    }
  }, [isOnline, doDrain])

  return { pendingCount, isDraining, drain: doDrain }
}
