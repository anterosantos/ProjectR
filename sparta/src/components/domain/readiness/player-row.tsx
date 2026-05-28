"use client";

/**
 * PlayerRow — Linha individual de jogador no Painel de Prontidão.
 *
 * AC #4: jersey + nome + SemaforoBadge alinhado à direita
 * AC #7: InsufficientDataIndicator com role="tooltip" + aria-describedby (P-14)
 * AC #8: ARIA label completo (nome, número, posição, estado)
 *
 * P-14: Tooltip acessível via role="tooltip" + aria-describedby no button (antes: aria-hidden total)
 * P-16: data_sufficient === false (explícito; antes !undefined também disparava)
 * P-17: jerseyNum != null para suportar camisola 0 (antes: 0 exibia "—")
 */

import { HelpCircle } from "lucide-react";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import type { PlayerReadinessData } from "@/types/supabase";

const STATE_LABEL: Record<string, string> = {
  ready: "Pronto",
  caution: "Cuidado",
  alert: "Alerta",
  neutral: "Sem dados",
};

/**
 * Indicator for players with insufficient historical data.
 * P-14: Tooltip acessível via role="tooltip" + id linkado por aria-describedby no button pai.
 * O icon é aria-hidden; o texto do tooltip é exposto a AT via aria-describedby.
 */
function InsufficientDataIndicator({ id }: { id: string }) {
  return (
    <span
      className="relative inline-flex items-center group shrink-0"
      data-testid="insufficient-data-indicator"
    >
      <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
      {/* role="tooltip" expõe o texto a AT; CSS hover para utilizadores com visão */}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Em construção. Precisa de 4 semanas de dados.
      </span>
    </span>
  );
}

export interface PlayerRowProps {
  snapshot: PlayerReadinessData;
  position: string;
  onSelect?: (snapshot: PlayerReadinessData) => void;
  flashed?: boolean;
}

export function PlayerRow({ snapshot, position, onSelect, flashed = false }: PlayerRowProps) {
  const { playerName, jerseyNum, state, data_sufficient, player_id } = snapshot;
  const stateLabel = STATE_LABEL[state] ?? state;
  // P-16: comparação explícita para não disparar com undefined
  const hasInsufficientData = data_sufficient === false;
  // TR-010: Use compound ID to avoid collision if PlayerRow instances duplicated
  const tooltipId = hasInsufficientData ? `insufficient-${player_id}-tooltip` : undefined;

  const ariaLabel = [
    playerName,
    // P-17: jerseyNum != null para suportar camisola 0 (antes: 0 era falsy)
    // TR-005: Type coercion guard — ensure jerseyNum is converted to string safely
    jerseyNum != null ? `Número ${String(jerseyNum)}` : null,
    `Posição ${position}`,
    `Estado ${stateLabel}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={`w-full px-4 py-3 flex items-center justify-between rounded-lg cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring${
        flashed
          ? " motion-safe:bg-primary/10 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:bg-muted/50"
          : " hover:bg-muted/50 transition-colors"
      }`}
      data-flashed={flashed ? "true" : undefined}
      aria-label={ariaLabel}
      // P-14: aria-describedby aponta para tooltip acessível (role="tooltip")
      aria-describedby={tooltipId}
      onClick={() => onSelect?.(snapshot)}
    >
      {/* Jersey number — P-17: suporta camisola 0 */}
      <span className="text-sm text-muted-foreground w-6 shrink-0 text-right" aria-hidden="true">
        {jerseyNum != null ? jerseyNum : "—"}
      </span>

      {/* Player name */}
      <span className="flex-1 mx-3 text-sm font-medium text-foreground flex items-center gap-1.5" aria-hidden="true">
        {playerName}
      </span>

      {/* P-14: InsufficientDataIndicator fora do span aria-hidden para que role="tooltip" seja exposto */}
      {hasInsufficientData && <InsufficientDataIndicator id={tooltipId!} />}

      {/* Semáforo badge */}
      <SemaforoBadge
        state={state}
        size="md"
        className="shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}
