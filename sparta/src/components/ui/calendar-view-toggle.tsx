"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

type Vista = "semana" | "mes"

export function CalendarViewToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get("vista") ?? "semana") as Vista

  const setVista = useCallback(
    (vista: Vista) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("vista", vista)
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div role="tablist" aria-label="Vista do calendário" className="flex gap-1">
      <button
        role="tab"
        aria-selected={current === "semana"}
        onClick={() => setVista("semana")}
        className={
          current === "semana"
            ? "bg-foreground text-background rounded px-3 py-1 text-sm font-medium"
            : "text-ink-3 px-3 py-1 text-sm"
        }
      >
        Semana
      </button>
      <button
        role="tab"
        aria-selected={current === "mes"}
        onClick={() => setVista("mes")}
        className={
          current === "mes"
            ? "bg-foreground text-background rounded px-3 py-1 text-sm font-medium"
            : "text-ink-3 px-3 py-1 text-sm"
        }
      >
        Mês
      </button>
    </div>
  )
}
