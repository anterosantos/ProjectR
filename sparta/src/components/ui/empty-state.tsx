import { Button } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  cta?: {
    label: string
    onClick: () => void
    variant?: VariantProps<typeof buttonVariants>["variant"]
  }
}

export const EmptyState = ({ icon, title, description, cta }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {cta && (
        <Button variant={cta.variant ?? "primary"} onClick={cta.onClick}>
          {cta.label}
        </Button>
      )}
    </div>
  )
}
