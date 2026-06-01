"use client";

import { useState, useEffect, useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";

export type TeamAggregateFilters = {
  ageGroup: "all" | "u14" | "u15" | "u17" | "u19" | "senior";
  competition: "all" | "jogo" | "amigavel" | "treino";
};

const STORAGE_KEY = "sparta:equipa-agregado:filters";

export const DEFAULT_FILTERS: TeamAggregateFilters = {
  ageGroup: "all",
  competition: "all",
};

const AGE_GROUP_OPTIONS: Array<{
  value: TeamAggregateFilters["ageGroup"];
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "u14", label: "Sub-14" },
  { value: "u15", label: "Sub-15" },
  { value: "u17", label: "Sub-17" },
  { value: "u19", label: "Sub-19" },
  { value: "senior", label: "Sénior" },
];

const COMPETITION_OPTIONS: Array<{
  value: TeamAggregateFilters["competition"];
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "jogo", label: "Jogos" },
  { value: "amigavel", label: "Amigáveis" },
  { value: "treino", label: "Treinos" },
];

function loadFiltersFromStorage(): TeamAggregateFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<TeamAggregateFilters>;

    const validAgeGroup = (
      ["all", "u14", "u15", "u17", "u19", "senior"] as readonly string[]
    ).includes(parsed.ageGroup as string)
      ? (parsed.ageGroup as TeamAggregateFilters["ageGroup"])
      : DEFAULT_FILTERS.ageGroup;

    const validCompetition = (
      ["all", "jogo", "amigavel", "treino"] as readonly string[]
    ).includes(parsed.competition as string)
      ? (parsed.competition as TeamAggregateFilters["competition"])
      : DEFAULT_FILTERS.competition;

    return { ageGroup: validAgeGroup, competition: validCompetition };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFiltersToStorage(filters: TeamAggregateFilters): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage may be unavailable
  }
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={`Remover filtro: ${label}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

interface TeamAggregateFiltersSheetProps {
  onFilter: (filters: TeamAggregateFilters) => void;
  initialFilters?: TeamAggregateFilters;
}

export function TeamAggregateFiltersSheet({
  onFilter,
  initialFilters,
}: TeamAggregateFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<TeamAggregateFilters>(
    initialFilters ?? DEFAULT_FILTERS
  );
  const [draft, setDraft] = useState<TeamAggregateFilters>(
    initialFilters ?? DEFAULT_FILTERS
  );
  const headingId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = loadFiltersFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe sessionStorage sync
    setFilters(stored);
    setDraft(stored);
    onFilter(stored);

    return () => {
      // cleanup: no-op
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setFilters(draft);
    saveFiltersToStorage(draft);
    onFilter(draft);
    setOpen(false);
  };

  const closeAndReset = () => {
    setDraft(filters);
    setOpen(false);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
  };

  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filters.ageGroup !== "all") {
    const label =
      AGE_GROUP_OPTIONS.find((o) => o.value === filters.ageGroup)?.label ??
      filters.ageGroup;
    chips.push({
      label: `Grupo: ${label}`,
      onRemove: () => {
        const next = { ...filters, ageGroup: "all" as const };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  if (filters.competition !== "all") {
    const label =
      COMPETITION_OPTIONS.find((o) => o.value === filters.competition)?.label ??
      filters.competition;
    chips.push({
      label: `Competição: ${label}`,
      onRemove: () => {
        const next = { ...filters, competition: "all" as const };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {chips.map((chip) => (
            <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
        className="gap-2"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filtros
        {chips.length > 0 && (
          <span
            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
            aria-label={`${chips.length} filtros activos`}
          >
            {chips.length}
          </span>
        )}
      </Button>

      <DrillDownSheet
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeAndReset();
          else setOpen(true);
        }}
      >
        <div className="flex flex-col gap-5 px-4 py-6" aria-labelledby={headingId}>
          <h2 id={headingId} className="text-base font-semibold text-foreground">
            Filtros
          </h2>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Grupo etário
            </legend>
            <div className="flex flex-col gap-2">
              {AGE_GROUP_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="equipa-age-group"
                    value={opt.value}
                    checked={draft.ageGroup === opt.value}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, ageGroup: opt.value }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Competição
            </legend>
            <div className="flex flex-col gap-2">
              {COMPETITION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="equipa-competition"
                    value={opt.value}
                    checked={draft.competition === opt.value}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, competition: opt.value }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="flex-1">
              Limpar
            </Button>
            <Button size="sm" onClick={applyFilters} className="flex-1">
              Aplicar
            </Button>
          </div>
        </div>
      </DrillDownSheet>
    </div>
  );
}
