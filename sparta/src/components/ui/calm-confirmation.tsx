"use client"

import { useEffect, useState } from "react"

export interface CalmConfirmationProps {
  message: string
  duration?: number
  onDismiss?: () => void
}

export const CalmConfirmation = ({
  message,
  duration = 1500,
  onDismiss,
}: CalmConfirmationProps) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  if (!isVisible) {
    return null
  }

  return (
    <div
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 animate-in fade-in-0 duration-150 rounded-lg border border-border bg-background text-muted-foreground px-4 py-3 shadow-sm sm:left-auto sm:right-auto sm:max-w-sm z-[var(--z-toast)]"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
