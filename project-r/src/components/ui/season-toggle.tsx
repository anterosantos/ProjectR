"use client";

import { useSeasonView } from "@/hooks/useSeasonView";
import type { Season } from "@/lib/schemas/seasons";

interface SeasonToggleProps {
  currentSeason: Season | null;
}

export function SeasonToggle({ currentSeason }: SeasonToggleProps) {
  const [view, setView] = useSeasonView();

  if (!currentSeason) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem época atual definida.{" "}
        <a href="/configuracoes/epocas" className="underline">
          Configurar
        </a>
      </p>
    );
  }

  return (
    <div className="flex gap-1 rounded-full border p-0.5 text-sm">
      <button
        className={`rounded-full px-3 py-1 transition-colors ${
          view === "current"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setView("current")}
      >
        {currentSeason.name}
      </button>
      <button
        className={`rounded-full px-3 py-1 transition-colors ${
          view === "cumulative"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setView("cumulative")}
      >
        Cumulativo
      </button>
    </div>
  );
}
