"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { TrendFilters } from "./TrendFilters";
import { FatigueTrendRow } from "./FatigueTrendRow";
import { EmptyState } from "@/components/ui/empty-state";
import type { PlayerTrendData, TrendFilters as TrendFiltersType } from "@/lib/actions/trends";

const DEFAULT_FILTERS: TrendFiltersType = {
  position: "all",
  ageGroup: "all",
  sortBy: "alphabetic",
};

interface TrendsDashboardProps {
  players: PlayerTrendData[];
}

export function TrendsDashboard({ players }: TrendsDashboardProps) {
  const [filters, setFilters] = useState<TrendFiltersType>(DEFAULT_FILTERS);

  const handleFilter = useCallback((newFilters: TrendFiltersType) => {
    setFilters(newFilters);
  }, []);

  // Apply filters client-side
  let filtered = players;

  // Filter by position
  if (filters.position !== "all") {
    filtered = filtered.filter((p) => p.position === filters.position);
  }

  // Filter by age group
  if (filters.ageGroup !== "all") {
    filtered = filtered.filter((p) => p.ageGroup === filters.ageGroup);
  }

  // Sort
  if (filters.sortBy === "delta") {
    filtered = [...filtered].sort((a, b) => {
      if (a.delta === null && b.delta === null) return 0;
      if (a.delta === null) return 1;
      if (b.delta === null) return -1;
      return b.delta - a.delta; // descendente
    });
  }
  // sortBy === "alphabetic": já ordenado do servidor

  return (
    <div className="space-y-4">
      <TrendFilters onFilter={handleFilter} initialFilters={DEFAULT_FILTERS} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum jogador encontrado"
          description="Nenhum jogador corresponde aos filtros activos."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="px-4 sm:px-6">
                  <th className="text-left py-3 px-4 sm:px-6 font-medium text-xs uppercase tracking-wide">
                    Jogador
                  </th>
                  <th className="text-left py-3 px-4 sm:px-6 font-medium text-xs uppercase tracking-wide">
                    Posição
                  </th>
                  <th className="hidden sm:table-cell text-left py-3 px-4 sm:px-6 font-medium text-xs uppercase tracking-wide">
                    Escalão
                  </th>
                  <th className="text-left py-3 px-4 sm:px-6 font-medium text-xs uppercase tracking-wide">
                    Tendências (28 dias)
                  </th>
                  <th className="text-left py-3 px-4 sm:px-6 font-medium text-xs uppercase tracking-wide">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <FatigueTrendRow key={player.playerId} player={player} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadados para accessibility */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} de {players.length} jogadores activos
      </div>
    </div>
  );
}
