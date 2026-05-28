"use client";

import { useState, useCallback } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonToggle } from "@/components/ui/season-toggle";
import { useSeasonView } from "@/hooks/useSeasonView";
import { LoadFiltersSheet } from "@/components/domain/LoadFiltersSheet";
import { PlayerLoadRow } from "@/components/domain/PlayerLoadRow";
import { exportLoadCsv } from "@/lib/utils/export";
import type { PlayerLoadData, LoadFilters } from "@/lib/actions/load";
import type { Season } from "@/lib/schemas/seasons";

const DEFAULT_FILTERS: LoadFilters = {
  position: "all",
  sortBy: "load",
};

interface LoadDashboardProps {
  players: PlayerLoadData[];
  currentSeason: Season | null;
}

export function LoadDashboard({ players, currentSeason }: LoadDashboardProps) {
  const [filters, setFilters] = useState<LoadFilters>(DEFAULT_FILTERS);
  const [seasonView] = useSeasonView();

  const handleFilter = useCallback((newFilters: LoadFilters) => {
    setFilters(newFilters);
  }, []);

  // Apply position filter
  let filtered = players;
  if (filters.position !== "all") {
    filtered = filtered.filter((p) => p.position === filters.position);
  }

  // Sort (always create new array to ensure immutability)
  if (filters.sortBy === "load") {
    filtered = [...filtered].sort((a, b) => {
      const aLoad = seasonView === "current" ? a.currentSeasonLoad : a.totalLoad;
      const bLoad = seasonView === "current" ? b.currentSeasonLoad : b.totalLoad;
      return bLoad - aLoad;
    });
  } else if (filters.sortBy === "sessions") {
    filtered = [...filtered].sort((a, b) => {
      const aSess = seasonView === "current" ? a.currentSeasonSessions : a.totalSessions;
      const bSess = seasonView === "current" ? b.currentSeasonSessions : b.totalSessions;
      return bSess - aSess;
    });
  } else {
    // sortBy === "alphabetic": already ordered by name from server, but ensure array copy
    filtered = [...filtered];
  }

  // Calculate season average for threshold badges
  // Note: Excludes players with zero load (intentional — badges only apply to players with non-zero load)
  const activePlayers = filtered.filter(
    (p) => (seasonView === "current" ? p.currentSeasonLoad : p.totalLoad) > 0
  );
  const seasonAvg =
    activePlayers.length > 0
      ? activePlayers.reduce(
          (s, p) => s + (seasonView === "current" ? p.currentSeasonLoad : p.totalLoad),
          0
        ) / activePlayers.length
      : 0;

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      return;
    }
    exportLoadCsv(filtered, seasonView);
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SeasonToggle currentSeason={currentSeason} />
        <div className="ml-auto flex items-center gap-2">
          <LoadFiltersSheet onFilter={handleFilter} initialFilters={filters} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Player list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum jogador encontrado"
          description="Nenhum jogador corresponde aos filtros activos."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2 px-4">Nome</th>
                <th className="hidden sm:table-cell py-2 px-4">Posição</th>
                <th className="hidden sm:table-cell py-2 px-4">Escalão</th>
                <th className="py-2 px-4">Carga Total</th>
                <th className="py-2 px-4">Por mês</th>
                <th className="py-2 px-4">Sessões</th>
                <th className="py-2 px-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => {
                const load = seasonView === "current" ? player.currentSeasonLoad : player.totalLoad;
                const monthly =
                  seasonView === "current" ? player.currentSeasonMonthly : player.allTimeMonthly;
                const sessions =
                  seasonView === "current" ? player.currentSeasonSessions : player.totalSessions;
                return (
                  <PlayerLoadRow
                    key={player.playerId}
                    player={player}
                    seasonAvg={seasonAvg}
                    load={load}
                    monthly={monthly}
                    sessions={sessions}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
