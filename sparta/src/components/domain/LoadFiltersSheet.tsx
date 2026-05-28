"use client";

import { useState, useEffect, useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { POSITION_VALUES } from "@/lib/actions/load";
import type { LoadFilters } from "@/lib/actions/load";

const STORAGE_KEY = "sparta:load:filters";

const DEFAULT_FILTERS: LoadFilters = {
  position: "all",
  sortBy: "load",
};

const POSITION_OPTIONS = [
  { value: "all" as const, label: "Todas" },
  { value: "GR" as const, label: "GR" },
  { value: "DEF" as const, label: "DEF" },
  { value: "MED" as const, label: "MED" },
  { value: "AVA" as const, label: "AVA" },
];

const SORTBY_OPTIONS = [
  { value: "load" as const, label: "Carga ↓" },
  { value: "sessions" as const, label: "Sessões ↓" },
  { value: "alphabetic" as const, label: "Nome A→Z" },
];

function loadFiltersFromStorage(): LoadFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<LoadFilters>;

    const validPosition = (POSITION_VALUES as readonly string[]).includes(parsed.position as string)
      ? (parsed.position as LoadFilters["position"])
      : DEFAULT_FILTERS.position;

    const validSortBy = (["load", "sessions", "alphabetic"] as const).includes(
      parsed.sortBy as LoadFilters["sortBy"]
    )
      ? (parsed.sortBy as LoadFilters["sortBy"])
      : DEFAULT_FILTERS.sortBy;

    return { position: validPosition, sortBy: validSortBy };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFiltersToStorage(filters: LoadFilters): void {
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

interface LoadFiltersSheetProps {
  onFilter: (f: LoadFilters) => void;
  initialFilters?: LoadFilters;
}

export function LoadFiltersSheet({ onFilter, initialFilters }: LoadFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<LoadFilters>(initialFilters ?? DEFAULT_FILTERS);
  const [draft, setDraft] = useState<LoadFilters>(initialFilters ?? DEFAULT_FILTERS);
  const headingId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = loadFiltersFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe sessionStorage sync: server renders defaults, effect updates after hydration to avoid mismatch
    setFilters(stored);
    setDraft(stored);
    onFilter(stored);
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

  // Build chips for active filters
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filters.position !== "all") {
    chips.push({
      label: `Posição: ${filters.position}`,
      onRemove: () => {
        const next = { ...filters, position: "all" as const };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
    const sortLabel = SORTBY_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? filters.sortBy;
    chips.push({
      label: `Ordem: ${sortLabel}`,
      onRemove: () => {
        const next = { ...filters, sortBy: DEFAULT_FILTERS.sortBy };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  return (
    <div className="space-y-3">
      {/* Active filter chips (UX-DR35) */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {chips.map((chip) => (
            <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      {/* Filter trigger button */}
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

      {/* Filter sheet */}
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

          {/* Position filter */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Posição</legend>
            <div className="flex flex-col gap-2">
              {POSITION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="load-position"
                    value={opt.value}
                    checked={draft.position === opt.value}
                    onChange={() => setDraft((prev) => ({ ...prev, position: opt.value }))}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Sort By filter */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Ordenação</legend>
            <div className="flex flex-col gap-2">
              {SORTBY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="load-sortby"
                    value={opt.value}
                    checked={draft.sortBy === opt.value}
                    onChange={() => setDraft((prev) => ({ ...prev, sortBy: opt.value }))}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Actions */}
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
