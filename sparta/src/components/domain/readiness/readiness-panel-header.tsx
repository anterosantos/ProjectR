/**
 * ReadinessPanelHeader — Cabeçalho sticky com summary bar + toggle de vista.
 */

import { RefreshCw } from "lucide-react";

export interface ReadinessPanelHeaderProps {
  readyCount: number;
  cautionCount: number;
  alertCount: number;
  neutralCount: number;
  sessionTime: string | null; // e.g. "16:00"
  view: "list" | "formation";
  onViewChange: (v: "list" | "formation") => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  inWindow?: boolean;
}

export function ReadinessPanelHeader({
  readyCount,
  cautionCount,
  alertCount,
  neutralCount,
  sessionTime,
  view,
  onViewChange,
  onRefresh,
  isRefreshing = false,
  inWindow = false,
}: ReadinessPanelHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 py-3 sm:px-6">
      {/* Session info + controls row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          {sessionTime ? `Jogo ${sessionTime} · ` : ""}
          <span className="text-foreground font-medium">Filtro: Todos</span>
        </p>

        <div className="flex items-center gap-1" role="group" aria-label="Vista do painel">
          <button
            type="button"
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
          >
            Lista
          </button>
          <button
            type="button"
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
              view === "formation"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onViewChange("formation")}
            aria-pressed={view === "formation"}
          >
            Formação
          </button>

          {!inWindow && onRefresh && (
            <button
              type="button"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-1"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Atualizando dados de prontidão" : "Atualizar dados de prontidão"}
              aria-busy={isRefreshing}
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm" role="status" aria-label="Resumo de prontidão">
        <span className="flex items-center gap-1.5 text-signal-ready font-medium">
          <span aria-hidden="true">✓</span>
          <span>{readyCount} Verdes</span>
        </span>
        <span className="flex items-center gap-1.5 text-signal-caution font-medium">
          <span aria-hidden="true">⚠</span>
          <span>{cautionCount} Atenção</span>
        </span>
        <span className="flex items-center gap-1.5 text-signal-alert font-medium">
          <span aria-hidden="true">×</span>
          <span>{alertCount} Alerta</span>
        </span>
        {neutralCount > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <span aria-hidden="true">—</span>
            <span>{neutralCount} Sem dados</span>
          </span>
        )}
      </div>
    </div>
  );
}
