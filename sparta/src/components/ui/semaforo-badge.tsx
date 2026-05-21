import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, AlertTriangle, AlertOctagon, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"

const semaforoBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium",
  {
    variants: {
      state: {
        ready: "bg-signal-ready/10 text-signal-ready",
        caution: "bg-signal-caution/10 text-signal-caution",
        alert: "bg-signal-alert/10 text-signal-alert",
        neutral: "bg-signal-neutral/10 text-signal-neutral",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      state: "neutral",
      size: "md",
    },
  }
)

export interface SemaforoBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof semaforoBadgeVariants> {}

export const SemaforoBadge = ({
  state = "neutral",
  size = "md",
  className,
  ...props
}: SemaforoBadgeProps) => {
  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const currentIconSize = iconSize[size ?? "md"]

  const iconMap = {
    ready: <CheckCircle2 className={currentIconSize} />,
    caution: <AlertTriangle className={currentIconSize} />,
    alert: <AlertOctagon className={currentIconSize} />,
    neutral: <CircleDashed className={currentIconSize} />,
  }

  const labelMap = {
    ready: "Estado: pronto",
    caution: "Estado: atenção",
    alert: "Estado: não recomendado",
    neutral: "Estado: sem dados",
  } as const

  const currentState = state ?? "neutral"
  const isValidState = (s: unknown): s is "ready" | "caution" | "alert" | "neutral" => {
    return typeof s === "string" && s in iconMap
  }

  let validState: "ready" | "caution" | "alert" | "neutral" = "neutral"
  if (isValidState(currentState)) {
    validState = currentState
  } else if (process.env.NODE_ENV === "development" && currentState !== "neutral") {
    console.warn(`SemaforoBadge: invalid state "${currentState}", defaulting to "neutral"`)
  }

  const label = labelMap[validState]
  const icon = iconMap[validState]

  return (
    <div
      className={cn(semaforoBadgeVariants({ state: validState, size }), className)}
      aria-label={label}
      role="img"
      {...props}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </div>
  )
}
