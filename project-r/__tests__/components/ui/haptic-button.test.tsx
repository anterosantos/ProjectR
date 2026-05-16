import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "vitest-axe"
import { HapticButton } from "@/components/ui/haptic-button"

describe("HapticButton", () => {
  it("renders button with children", () => {
    render(<HapticButton>Click me</HapticButton>)
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument()
  })

  it("calls onClick handler", () => {
    const handleClick = vi.fn()
    render(<HapticButton onClick={handleClick}>Click me</HapticButton>)
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalled()
  })

  it("attempts to vibrate on click", () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      configurable: true,
    })
    render(<HapticButton>Click me</HapticButton>)
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(vibrateMock).toHaveBeenCalledWith(10)
  })

  it("handles missing vibrate API gracefully", () => {
    const handleClick = vi.fn()
    const originalVibrate = navigator.vibrate
    // @ts-expect-error deleting read-only property for test isolation
    delete navigator.vibrate
    render(<HapticButton onClick={handleClick}>Click me</HapticButton>)
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalled()
    // Restore
    Object.defineProperty(navigator, "vibrate", {
      value: originalVibrate,
      configurable: true,
    })
  })

  it("supports all button variants", () => {
    const { rerender } = render(
      <HapticButton variant="primary">Primary</HapticButton>
    )
    expect(screen.getByRole("button", { name: /primary/i })).toBeInTheDocument()

    rerender(<HapticButton variant="ghost">Ghost</HapticButton>)
    expect(screen.getByRole("button", { name: /ghost/i })).toBeInTheDocument()
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(<HapticButton>Click me</HapticButton>)
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })
})
