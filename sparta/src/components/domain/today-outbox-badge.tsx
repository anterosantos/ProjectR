'use client';

/**
 * TodayOutboxBadge — Renderiza o PendingBadge com botão "Sincronizar agora" na página /hoje.
 * Integra o hook useOutboxDrain para mostrar contagem e gerenciar sync manual.
 */

import { useOutboxDrain } from '@/hooks/useOutboxDrain';
import { PendingBadge } from './pending-badge';
import { CalmConfirmation } from '@/components/ui/calm-confirmation';
import { useState } from 'react';

export function TodayOutboxBadge() {
  const { pendingCount, isDraining, drain } = useOutboxDrain();
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false);

  const handleSync = async () => {
    await drain();
    // drain() actualiza pendingCount internamente via hook
    // Badge re-renderiza automaticamente com novo count
    if (pendingCount === 0) {
      setShowSyncConfirmation(true);
    }
  };

  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--signal-info-bg,theme(colors.blue.50))] rounded-lg border border-[var(--signal-info-ink,theme(colors.blue.200))]">
        <div className="flex items-center gap-2">
          <PendingBadge count={pendingCount} isDraining={isDraining} />
        </div>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={isDraining}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-current text-[var(--signal-info-ink,theme(colors.blue.700))] hover:bg-[var(--signal-info-bg,theme(colors.blue.100))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDraining ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>

      {showSyncConfirmation && (
        <CalmConfirmation
          message="Sincronizado com sucesso!"
          onDismiss={() => setShowSyncConfirmation(false)}
        />
      )}
    </>
  );
}
