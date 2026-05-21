export interface PendingBadgeProps {
  count?: number
}

export const PendingBadge = ({ count }: PendingBadgeProps) => {
  const validCount = count ?? 0

  if (validCount < 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn("PendingBadge: count must be non-negative, received:", count)
    }
    return null
  }

  if (validCount === 0) {
    return null
  }

  return (
    <span
      className="inline-flex items-center rounded-full bg-signal-info/10 px-2 py-1 text-xs font-medium text-signal-info"
      aria-live="polite"
      role="status"
    >
      {validCount} pendentes
    </span>
  )
}
