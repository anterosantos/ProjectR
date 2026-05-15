"use client"

import { useState, useRef, useEffect } from "react"
import { HelpCircle, X } from "lucide-react"

export interface TooltipExplainProps {
  term: string
  definition: string
  formula?: string
}

export const TooltipExplain = ({ term, definition, formula }: TooltipExplainProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsOpen(!isOpen)
          }
          if (e.key === "Escape") {
            setIsOpen(false)
          }
        }}
        className="inline border-b border-dotted border-foreground text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`Explicação de ${term}`}
        aria-expanded={isOpen}
      >
        <span className="inline-flex items-center gap-1">
          {term}
          <HelpCircle className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 shadow-md"
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm text-popover-foreground">{definition}</p>
              {formula && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">{formula}</p>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-shrink-0 text-popover-foreground hover:opacity-70 focus:outline-none"
              aria-label="Fechar explicação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
