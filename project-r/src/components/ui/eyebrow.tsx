import { cn } from "@/lib/utils"

interface EyebrowProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Eyebrow({ children, className, style }: EyebrowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3",
        className
      )}
      style={style}
    >
      <span className="w-3 h-px bg-ink-3 shrink-0" aria-hidden="true" />
      {children}
    </div>
  )
}
