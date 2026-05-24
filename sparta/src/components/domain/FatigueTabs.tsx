"use client";

import { useState, useEffect, useCallback } from "react";
import { LineChart, Table } from "lucide-react";
import { FatigueChart } from "@/components/domain/FatigueChart";
import { FatigueTable } from "@/components/domain/FatigueTable";
import { FatigueFilters } from "@/components/domain/FatigueFilters";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";
import type { FilterState } from "@/components/domain/FatigueFilters";
import type { DimensionKey } from "@/components/domain/FatigueChart";

type TabValue = "chart" | "table";

const TAB_STORAGE_KEY = "sparta-fatigue-tab";

function loadTabFromStorage(): TabValue {
  if (typeof window === "undefined") return "chart";
  try {
    const v = sessionStorage.getItem(TAB_STORAGE_KEY);
    // Strict string comparison to prevent injection
    if (typeof v === "string" && (v === "chart" || v === "table")) return v;
  } catch {
    // quota exceeded / unavailable
  }
  return "chart";
}

function saveTabToStorage(tab: TabValue): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // ignore
  }
}

export interface FatigueTabsProps {
  playerId: string;
  playerName: string;
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
}

export function FatigueTabs({
  playerId,
  playerName,
  responses,
  sessions,
}: FatigueTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("chart");
  const [filters, setFilters] = useState<FilterState>({
    phase: undefined,
    dimensions: [
      "dim_energy",
      "dim_focus",
      "dim_sleep",
      "dim_soreness",
      "dim_mood",
    ],
    dateFrom: undefined,
    dateTo: undefined,
  });

  // Hydrate tab from sessionStorage (AC #5).
  // Legitimate external-store sync; suppress set-state-in-effect false-positive.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(loadTabFromStorage());
  }, []);

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab);
    saveTabToStorage(tab);
  };

  const handleFilter = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Apply date filter to responses (timezone-aware)
  const dateFilteredResponses = responses.filter((r) => {
    if (filters.dateFrom) {
      // Normalize to UTC for comparison
      const submittedDate = new Date(r.submitted_at).toISOString().split("T")[0];
      if (submittedDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      // Include the full day of dateTo
      const submittedDate = new Date(r.submitted_at).toISOString().split("T")[0];
      if (submittedDate > filters.dateTo) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Tab header + filter button (AC #5, AC #6) */}
      <div className="mb-4 flex items-start justify-between gap-3">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Vista de fadiga"
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          <button
            role="tab"
            aria-selected={activeTab === "chart"}
            aria-controls="fadiga-panel-chart"
            id="fadiga-tab-chart"
            onClick={() => handleTabChange("chart")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] ${
              activeTab === "chart"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LineChart className="h-4 w-4" aria-hidden="true" />
            Gráfico
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "table"}
            aria-controls="fadiga-panel-table"
            id="fadiga-tab-table"
            onClick={() => handleTabChange("table")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] ${
              activeTab === "table"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table className="h-4 w-4" aria-hidden="true" />
            Tabela
          </button>
        </div>

        {/* Filters (AC #6) */}
        <FatigueFilters onFilter={handleFilter} />
      </div>

      {/* Active filter chips are rendered inside FatigueFilters above */}

      {/* Chart panel (AC #3, AC #7) */}
      <div
        id="fadiga-panel-chart"
        role="tabpanel"
        aria-labelledby="fadiga-tab-chart"
        hidden={activeTab !== "chart"}
      >
        <FatigueChart
          playerId={playerId}
          playerName={playerName}
          responses={dateFilteredResponses}
          sessions={sessions}
          activeDimensions={filters.dimensions as DimensionKey[]}
          activePhase={filters.phase}
        />
      </div>

      {/* Table panel (AC #4) */}
      <div
        id="fadiga-panel-table"
        role="tabpanel"
        aria-labelledby="fadiga-tab-table"
        hidden={activeTab !== "table"}
      >
        <FatigueTable
          playerId={playerId}
          playerName={playerName}
          responses={dateFilteredResponses}
          sessions={sessions}
          activeDimensions={filters.dimensions as DimensionKey[]}
          activePhase={filters.phase}
        />
      </div>
    </div>
  );
}
