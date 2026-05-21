"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type SessionTypeFilterValue = "all" | "training" | "matches";

interface SessionTypeFilterProps {
  activeFilter: SessionTypeFilterValue;
}

const FILTERS: { value: SessionTypeFilterValue; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "training", label: "Treinos" },
  { value: "matches", label: "Jogos" },
];

export function SessionTypeFilter({ activeFilter }: SessionTypeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(value: SessionTypeFilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tipo");
    } else {
      params.set("tipo", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Filtro por tipo de sessão">
      {FILTERS.map(({ value, label }) => {
        const isActive = activeFilter === value;
        return (
          <button
            key={value}
            type="button"
            onClick={isActive ? undefined : () => setFilter(value)}
            aria-pressed={isActive}
            className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
              isActive
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
