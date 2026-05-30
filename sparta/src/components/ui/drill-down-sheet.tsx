"use client"

import { useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export interface DrillDownSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export const DrillDownSheet = ({
  open = false,
  onOpenChange,
  children,
}: DrillDownSheetProps) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)

  useEffect(() => {
    if (!open || !contentRef.current) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches?.[0]
      if (touch) {
        startYRef.current = touch.clientY
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches?.[0]
      if (touch) {
        const endY = touch.clientY
        const deltaY = endY - startYRef.current
        // Swipe down > 50px triggers close
        if (deltaY > 50) {
          onOpenChange?.(false)
        }
      }
    }

    const element = contentRef.current
    element.addEventListener("touchstart", handleTouchStart, false)
    element.addEventListener("touchend", handleTouchEnd, false)

    return () => {
      element.removeEventListener("touchstart", handleTouchStart)
      element.removeEventListener("touchend", handleTouchEnd)
    }
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border-0 border-t bg-background p-6 sm:rounded-lg data-[state=open]:slide-in-from-bottom-96 data-[state=open]:duration-200"
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
