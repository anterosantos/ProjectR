'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/outbox/db';
import { drainPendingMutations } from '@/lib/outbox/drain';
import { useOnlineStatus } from './useOnlineStatus';

export interface UseOutboxDrainResult {
  pendingCount: number;
  isDraining: boolean;
  drain: () => Promise<void>;
}

/**
 * useOutboxDrain — Hook que gerencia o drain automático do outbox.
 * - Deteta transição online (false → true)
 * - Invoca drainPendingMutations('fatigue.submit') automaticamente
 * - Fornece função drain() para sync manual
 * - Retorna { pendingCount, isDraining, drain }
 */
export function useOutboxDrain(): UseOutboxDrainResult {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isDraining, setIsDraining] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const onlineAtRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scan pending count periodically with cleanup
  useEffect(() => {
    const updateCount = async () => {
      if (!isMountedRef.current) return;

      try {
        // Usar índice composto [kind+created_at] para performance
        const count = await db.outbox
          .where('kind')
          .equals('fatigue.submit')
          .filter(m => m.status === 'pending')
          .count();

        if (isMountedRef.current) {
          setPendingCount(Math.max(0, count)); // Garantir nunca negativo
        }
      } catch (err) {
        console.error('[useOutboxDrain] Failed to count pending:', err);
      }
    };

    // Scan imediatamente e após montagem
    updateCount();

    // Rescan a cada 2 segundos enquanto há pendentes
    intervalRef.current = setInterval(updateCount, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Cleanup de mounted flag
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-drain quando conectividade é restaurada (com proteção contra race condition)
  useEffect(() => {
    if (!isOnline) {
      onlineAtRef.current = 0;
      return;
    }

    // isOnline é true — primeira vez que detecta online?
    if (onlineAtRef.current === 0) {
      onlineAtRef.current = Date.now();

      // Auto-trigger drain
      void (async () => {
        if (!isMountedRef.current) return;

        setIsDraining(true);
        try {
          await drainPendingMutations('fatigue.submit');

          // Atualizar count após drain
          if (isMountedRef.current) {
            const count = await db.outbox
              .where('kind')
              .equals('fatigue.submit')
              .filter(m => m.status === 'pending')
              .count();
            setPendingCount(Math.max(0, count));
          }
        } catch (err) {
          console.error('[useOutboxDrain] Auto-drain failed:', err);
        } finally {
          if (isMountedRef.current) {
            setIsDraining(false);
          }
        }
      })();
    }
  }, [isOnline]);

  // Manual drain function
  const drain = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsDraining(true);
    try {
      await drainPendingMutations('fatigue.submit');

      // Atualizar count após drain
      if (isMountedRef.current) {
        const count = await db.outbox
          .where('kind')
          .equals('fatigue.submit')
          .filter(m => m.status === 'pending')
          .count();
        setPendingCount(Math.max(0, count));
      }
    } catch (err) {
      console.error('[useOutboxDrain] Manual drain failed:', err);
    } finally {
      if (isMountedRef.current) {
        setIsDraining(false);
      }
    }
  }, []);

  return { pendingCount, isDraining, drain };
}
