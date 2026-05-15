"use client"

import { Button } from "@/components/ui/button"

export interface HapticButtonProps extends React.ComponentProps<"button"> {
  children: React.ReactNode
  variant?: "primary" | "ghost" | "destructive"
  size?: "sm" | "default" | "lg"
}

export const HapticButton = ({ onClick, children, ...props }: HapticButtonProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10)
    }
    onClick?.(e)
  }

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}
