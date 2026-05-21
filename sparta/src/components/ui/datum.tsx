import { cn } from "@/lib/utils"

interface DatumProps {
  value: string | number
  label: string
  unit?: string
  valueSize?: number
  color?: string
  className?: string
}

export function Datum({ value, label, unit, valueSize = 22, color, className }: DatumProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div
        className="font-mono font-medium tabular-nums leading-none tracking-[-0.02em] flex items-baseline gap-1"
        style={{ fontSize: valueSize, color: color || undefined }}
      >
        <span>{value}</span>
        {unit && (
          <span
            className="text-ink-3 font-normal tracking-[0.04em]"
            style={{ fontSize: Math.max(9, valueSize * 0.42) }}
          >
            {unit}
          </span>
        )}
      </div>
      <div className="font-mono text-[8.5px] tracking-[0.12em] uppercase text-ink-3">
        {label}
      </div>
    </div>
  )
}
