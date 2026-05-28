"use client";

import { useState, useEffect, useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import type { TrendFilters } from "@/lib/actions/trends";

const STORAGE_KEY = "sparta:trends:filters";

const DEFAULT_FILTERS: TrendFilters = {
  position: "all",
  ageGroup: "all",
  sortBy: "alphabetic",
};

const POSITION_OPTIONS = [
  { value: "all" as const, label: "Todas" },
  { value: "GR" as const, label: "GR" },
  { value: "DEF" as const, label: "DEF" },
  { value: "MED" as const, label: "MED" },
  { value: "AVA" as const, label: "AVA" },
];

const AGEGROUP_OPTIONS = [
  { value: "all" as const, label: "Todos" },
  { value: "u14" as const, label: "u14" },
  { value: "u15" as const, label: "u15" },
  { value: "u17" as const, label: "u17" },
  { value: "u19" as const, label: "u19" },
  { value: "senior" as const, label: "Senior" },
];

const SORTBY_OPTIONS = [
  { value: "delta" as const, label: "Por delta ↓" },
  { value: "alphabetic" as const, label: "Por nome A→Z" },
];

function loadFiltersFromStorage(): TrendFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<TrendFilters>;

    // Validate position
    const validPosition = (["all", "GR", "DEF", "MED", "AVA"] as const).includes(
      parsed.position as any
    )
      ? (parsed.position as TrendFilters["position"])
      : DEFAULT_FILTERS.position;

    // Validate ageGroup
    const validAgeGroup = (["all", "u14", "u15", "u17", "u19", "senior"] as const).includes(
      parsed.ageGroup as any
    )
      ? (parsed.ageGroup as TrendFilters["ageGroup"])
      : DEFAULT_FILTERS.ageGroup;

    // Validate sortBy
    const validSortBy = (["delta", "alphabetic"] as const).includes(parsed.sortBy as any)
      ? (parsed.sortBy as TrendFilters["sortBy"])
      : DEFAULT_FILTERS.sortBy;

    return {
      position: validPosition,
      ageGroup: validAgeGroup,
      sortBy: validSortBy,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFiltersToStorage(filters: TrendFilters): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage may be unavailable (private browsing)
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

interface TrendFiltersProps {
  onFilter: (filters: TrendFilters) => void;
  initialFilters?: TrendFilters;
}

export function TrendFilters({ onFilter, initialFilters }: TrendFiltersProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<TrendFilters>(initialFilters ?? DEFAULT_FILTERS);
  const [draft, setDraft] = useState<TrendFilters>(initialFilters ?? DEFAULT_FILTERS);
  const headingId = useId();

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = loadFiltersFromStorage();
    setFilters(stored);
    setDraft(stored);
    onFilter(stored);
  }, [onFilter]);

  const applyFilters = () => {
    setFilters(draft);
    saveFiltersToStorage(draft);
    onFilter(draft);
    setOpen(false);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
  };

  // Get active filter labels for chips
  const activeFilters: { label: string; key: keyof TrendFilters; value: string }[] = [];
  if (filters.position !== DEFAULT_FILTERS.position) {
    activeFilters.push({ label: `Posição: ${filters.position}`, key: "position", value: filters.position });
  }
  if (filters.ageGroup !== DEFAULT_FILTERS.ageGroup) {
    activeFilters.push({ label: `Escalão: ${filters.ageGroup}`, key: "ageGroup", value: filters.ageGroup });
  }
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
    activeFilters.push({ label: `Ordem: ${filters.sortBy}`, key: "sortBy", value: filters.sortBy });
  }

  const removeFilter = (key: keyof TrendFilters) => {
    const newFilters = { ...filters };
    if (key === "position") newFilters.position = DEFAULT_FILTERS.position;
    if (key === "ageGroup") newFilters.ageGroup = DEFAULT_FILTERS.ageGroup;
    if (key === "sortBy") newFilters.sortBy = DEFAULT_FILTERS.sortBy;
    setFilters(newFilters);
    setDraft(newFilters);
    saveFiltersToStorage(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="space-y-3">
      {/* Chips for active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-6">
          {activeFilters.map((filter) => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              onRemove={() => removeFilter(filter.key)}
            />
          ))}
        </div>
      )}

      {/* Filter trigger button */}
      <div className="px-4 sm:px-6">
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
        </Button>

        {/* Filter sheet */}
        <DrillDownSheet open={open} onOpenChange={setOpen}>
          <div
            className="flex flex-col gap-5 px-4 py-6"
            aria-labelledby={headingId}
          >
            <h2
              id={headingId}
              className="text-base font-semibold text-foreground"
            >
              Filtros
            </h2>

            {/* Position Filter */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Posição
              </legend>
              <div className="flex flex-col gap-2">
                {POSITION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="position"
                      value={option.value}
                      checked={draft.position === option.value}
                      onChange={() =>
                        setDraft({ ...draft, position: option.value })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Age Group Filter */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Escalão
              </legend>
              <div className="flex flex-col gap-2">
                {AGEGROUP_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="ageGroup"
                      value={option.value}
                      checked={draft.ageGroup === option.value}
                      onChange={() =>
                        setDraft({ ...draft, ageGroup: option.value })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Sort By Filter */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Ordenação
              </legend>
              <div className="flex flex-col gap-2">
                {SORTBY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="sortBy"
                      value={option.value}
                      checked={draft.sortBy === option.value}
                      onChange={() =>
                        setDraft({ ...draft, sortBy: option.value })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" onClick={resetFilters} className="flex-1">
                Limpar filtros
              </Button>
              <Button onClick={applyFilters} className="flex-1">
                Aplicar
              </Button>
            </div>
          </div>
        </DrillDownSheet>
      </div>
    </div>
  );
}
