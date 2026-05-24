"use client";

import { useState, useEffect, useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";

const DIMENSIONS = [
  { key: "dim_energy",   label: "Energia" },
  { key: "dim_focus",    label: "Concentração" },
  { key: "dim_sleep",    label: "Sono" },
  { key: "dim_soreness", label: "Dores" },
  { key: "dim_mood",     label: "Estado emocional" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export type PhaseFilter = "pre" | "post" | undefined;

export interface FilterState {
  phase: PhaseFilter;
  dimensions: DimensionKey[];
  dateFrom: string | undefined;
  dateTo: string | undefined;
}

const DEFAULT_FILTERS: FilterState = {
  phase: undefined,
  dimensions: DIMENSIONS.map((d) => d.key),
  dateFrom: undefined,
  dateTo: undefined,
};

const STORAGE_KEY = "sparta-fatigue-filters";

function loadFiltersFromStorage(): FilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<FilterState>;

    // Validate phase strictly
    const validPhase = (["pre", "post", undefined] as Array<PhaseFilter>).includes(parsed.phase)
      ? parsed.phase
      : undefined;

    // Validate dimension keys strictly — filter to valid keys only
    const validDimensions = Array.isArray(parsed.dimensions)
      ? (parsed.dimensions as DimensionKey[]).filter((d) =>
          DIMENSIONS.some((dim) => dim.key === d)
        )
      : [];
    const safeDimensions = validDimensions.length > 0 ? validDimensions : DEFAULT_FILTERS.dimensions;

    // Validate date strings and logical order
    let dateFrom = typeof parsed.dateFrom === "string" ? parsed.dateFrom : undefined;
    let dateTo = typeof parsed.dateTo === "string" ? parsed.dateTo : undefined;

    // Ensure dateFrom <= dateTo if both exist
    if (dateFrom && dateTo && dateFrom > dateTo) {
      // Swap if inverted
      [dateFrom, dateTo] = [dateTo, dateFrom];
    }

    return {
      phase: validPhase,
      dimensions: safeDimensions,
      dateFrom,
      dateTo,
    };
  } catch (e) {
    console.warn("Invalid filter storage, resetting to defaults:", e);
    return DEFAULT_FILTERS;
  }
}

function saveFiltersToStorage(filters: FilterState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage may be unavailable (private browsing quota)
  }
}

const PHASE_OPTIONS: Array<{ value: PhaseFilter; label: string }> = [
  { value: undefined, label: "Todas" },
  { value: "pre",     label: "Pré-sessão" },
  { value: "post",    label: "Pós-sessão" },
];

interface ChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: ChipProps) {
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

interface FatigueFiltersProps {
  onFilter: (filters: FilterState) => void;
}

export function FatigueFilters({ onFilter }: FatigueFiltersProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const headingId = useId();

  // Hydrate from sessionStorage on mount (AC #6).
  // Legitimate external-store sync; suppress set-state-in-effect false-positive.
  useEffect(() => {
    const stored = loadFiltersFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(stored);
    setDraft(stored);
    // Wrap onFilter in useCallback on parent to avoid stale closure
    onFilter(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setFilters(draft);
    saveFiltersToStorage(draft);
    onFilter(draft);
    setOpen(false);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
  };

  const toggleDimension = (key: DimensionKey) => {
    setDraft((prev) => {
      const already = prev.dimensions.includes(key);
      const newDims = already
        ? prev.dimensions.filter((d) => d !== key)
        : [...prev.dimensions, key];
      // At least 1 dimension must stay selected
      if (newDims.length === 0) return prev;
      return { ...prev, dimensions: newDims };
    });
  };

  // Active filter chips (UX-DR35)
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filters.phase !== undefined) {
    const phaseLabel = filters.phase === "pre" ? "Pré-sessão" : "Pós-sessão";
    chips.push({
      label: phaseLabel,
      onRemove: () => {
        const next = { ...filters, phase: undefined };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  if (filters.dimensions.length < DIMENSIONS.length) {
    const hiddenDims = DIMENSIONS.filter((d) => !filters.dimensions.includes(d.key));
    hiddenDims.forEach((d) => {
      chips.push({
        label: `Sem ${d.label}`,
        onRemove: () => {
          const next = {
            ...filters,
            dimensions: [...filters.dimensions, d.key],
          };
          setFilters(next);
          setDraft(next);
          saveFiltersToStorage(next);
          onFilter(next);
        },
      });
    });
  }

  if (filters.dateFrom) {
    chips.push({
      label: `De ${filters.dateFrom}`,
      onRemove: () => {
        const next = { ...filters, dateFrom: undefined };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  if (filters.dateTo) {
    chips.push({
      label: `Até ${filters.dateTo}`,
      onRemove: () => {
        const next = { ...filters, dateTo: undefined };
        setFilters(next);
        setDraft(next);
        saveFiltersToStorage(next);
        onFilter(next);
      },
    });
  }

  return (
    <div>
      {/* Filter button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
        aria-label="Abrir filtros de fadiga"
        className="flex items-center gap-1.5"
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

      {/* Active filter chips (UX-DR35) */}
      {chips.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1.5"
          aria-label="Filtros activos"
        >
          {chips.map((chip) => (
            <FilterChip
              key={chip.label}
              label={chip.label}
              onRemove={chip.onRemove}
            />
          ))}
        </div>
      )}

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

          {/* Phase filter */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Fase
            </legend>
            <div className="flex flex-col gap-2">
              {PHASE_OPTIONS.map((opt) => (
                <label
                  key={String(opt.value)}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="phase"
                    value={String(opt.value)}
                    checked={draft.phase === opt.value}
                    onChange={() => setDraft((prev) => ({ ...prev, phase: opt.value }))}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Date range */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Intervalo de datas (DD/MM/AAAA)
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">De (DD/MM/AAAA)</span>
                <input
                  type="date"
                  value={draft.dateFrom ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      dateFrom: e.target.value || undefined,
                    }))
                  }
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Até (DD/MM/AAAA)</span>
                <input
                  type="date"
                  value={draft.dateTo ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      dateTo: e.target.value || undefined,
                    }))
                  }
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          </fieldset>

          {/* Dimensions */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">
              Dimensões
            </legend>
            <div className="flex flex-col gap-2">
              {DIMENSIONS.map((dim) => (
                <label
                  key={dim.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={draft.dimensions.includes(dim.key)}
                    onChange={() => toggleDimension(dim.key)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  {dim.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="flex-1"
            >
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
              className="flex-1"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </DrillDownSheet>
    </div>
  );
}
