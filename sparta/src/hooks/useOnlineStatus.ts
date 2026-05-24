'use client';

import { useEffect, useState } from 'react';

export interface OnlineStatusResult {
  isOnline: boolean;
  isDrain?: boolean;
}

/**
 * useOnlineStatus — Hook que deteta o status de conectividade do browser.
 * Usa window.navigator.onLine como source inicial.
 * Listeners 'online' e 'offline' atualizam estado dinâmico em tempo real.
 */
export function useOnlineStatus(): OnlineStatusResult {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Inicializar com estado actual
    if (typeof window !== 'undefined') {
      setIsOnline(window.navigator.onLine);
    }

    // Event listeners para mudanças dinâmicas
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
