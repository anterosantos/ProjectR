/**
 * ReadinessPanelHeader — Cabeçalho sticky com 3 números agregados e toggle de vista.
 *
 * AC #1: Toggle "Formação" ativo
 * AC #2: 3 grandes números (Verde/Amarelo/Vermelho) com labels PT-PT
 * AC #3: Botão "Atualizar" com RefreshCw fora da janela 4h (Story 5.7)
 * AC #8: aria-label em cada número; role/heading em secção
 */

import { RefreshCw } from "lucide-react";

export interface ReadinessPanelHeaderProps {
  readyCount: number;
  cautionCount: number;
  alertCount: number;
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
  view,
  onViewChange,
  onRefresh,
  isRefreshing = false,
  inWindow = false,
}: ReadinessPanelHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 bg-surface-container px-4 py-4 sm:px-6"
    >
      {/* Agregados */}
      <div
        className="flex items-center justify-around mb-4"
      >
        {/* Verde — prontos */}
        {/* P-15: role="img" movido para o div container (representa métrica visual composta) */}
        <div
          className="flex flex-col items-center gap-1"
          role="img"
          aria-label={`${readyCount} jogadores prontos`}
        >
          <span
            className="text-5xl font-bold leading-none"
            style={{ color: "#22c55e" }}
            aria-hidden="true"
          >
            {readyCount}
          </span>
          <span className="text-xs text-muted-foreground font-medium" aria-hidden="true">Prontos</span>
        </div>

        {/* Amarelo — cuidado */}
        <div
          className="flex flex-col items-center gap-1"
          role="img"
          aria-label={`${cautionCount} jogadores com cuidado`}
        >
          <span
            className="text-5xl font-bold leading-none"
            style={{ color: "#eab308" }}
            aria-hidden="true"
          >
            {cautionCount}
          </span>
          <span className="text-xs text-muted-foreground font-medium" aria-hidden="true">Cuidado</span>
        </div>

        {/* Vermelho — alerta */}
        <div
          className="flex flex-col items-center gap-1"
          role="img"
          aria-label={`${alertCount} jogadores em alerta`}
        >
          <span
            className="text-5xl font-bold leading-none"
            style={{ color: "#ef4444" }}
            aria-hidden="true"
          >
            {alertCount}
          </span>
          <span className="text-xs text-muted-foreground font-medium" aria-hidden="true">Alerta</span>
        </div>
      </div>

      {/* View toggle + botão Atualizar */}
      <div className="flex items-center justify-end gap-2" role="group" aria-label="Vista do painel">
        <button
          type="button"
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
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
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            view === "formation"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onViewChange("formation")}
          aria-pressed={view === "formation"}
        >
          Formação
        </button>

        {/* Botão Atualizar — apenas fora da janela 4h (AC #3) */}
        {!inWindow && onRefresh && (
          <button
            type="button"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Atualizando dados de prontidão" : "Atualizar dados de prontidão"}
            aria-busy={isRefreshing}
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </div>
  );
}
