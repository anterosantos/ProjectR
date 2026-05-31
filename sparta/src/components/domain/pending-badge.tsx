'use client';

/**
 * PendingBadge — Badge que mostra contagem de submissões pendentes (Story 4.4, AC #3, #4)
 *
 * Props:
 * - count: número de submissões pendentes
 * - isDraining?: se true, mostra spinner em vez do ícone
 * - onSyncClick?: callback quando o badge é clicado (para force sync)
 *
 * - Renderiza "X pendentes" apenas se count > 0
 * - Cor: signal/info azul
 * - aria-live="polite" para a11y
 * - Tamanho mínimo 44×44px para toque mobile (NFR40)
 */

import { AlertCircle, Loader2 } from 'lucide-react';

export interface PendingBadgeProps {
  count: number;
  isDraining?: boolean;
  onSyncClick?: () => void;
  label?: string;
}

export function PendingBadge({
  count,
  isDraining = false,
  onSyncClick,
  label = 'pendentes',
}: PendingBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onSyncClick}
      disabled={isDraining}
      aria-live="polite"
      aria-label={`${count} ${label}`}
      className="flex items-center gap-2 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-[var(--signal-info-bg,theme(colors.blue.100))] text-[var(--signal-info-ink,theme(colors.blue.700))] transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDraining ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
      )}
      <span className="text-sm font-medium">{count} {label}</span>
    </button>
  );
}
