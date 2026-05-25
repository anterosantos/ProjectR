/**
 * ReadinessPanelHeader — Cabeçalho sticky com 3 números agregados e toggle de vista.
 *
 * AC #1: Toggle "Formação" desactivado com aria-disabled em MVP
 * AC #2: 3 grandes números (Verde/Amarelo/Vermelho) com labels PT-PT
 * AC #8: aria-label em cada número; role/heading em secção
 */

export interface ReadinessPanelHeaderProps {
  readyCount: number;
  cautionCount: number;
  alertCount: number;
  view: "list" | "formation";
  onViewChange: (v: "list" | "formation") => void;
}

export function ReadinessPanelHeader({
  readyCount,
  cautionCount,
  alertCount,
  view,
  onViewChange,
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

      {/* View toggle */}
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

        {/* Formação — desactivado em MVP (Story 5.6) */}
        {/* P-18: aria-disabled removido (redundante com disabled); aria-pressed sempre false */}
        <button
          type="button"
          className="text-sm font-medium px-3 py-1.5 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          aria-pressed={false}
          title="Em breve — vista de campo com formação táctica."
          disabled
        >
          Formação
          <span className="sr-only"> (em breve)</span>
        </button>
      </div>
    </div>
  );
}
