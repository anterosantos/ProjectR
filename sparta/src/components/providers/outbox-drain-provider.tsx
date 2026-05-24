'use client';

/**
 * OutboxDrainProvider — Inicializa o hook useOutboxDrain() globalmente no layout do jogador.
 * Garante que o drain é ativado quando a conectividade é restaurada (Story 4.4).
 */

import { useOutboxDrain } from '@/hooks/useOutboxDrain';

export function OutboxDrainProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inicializar o hook para auto-drain quando online
  useOutboxDrain();

  return <>{children}</>;
}
