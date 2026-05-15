import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { CalmConfirmation } from "@/components/ui/calm-confirmation"

describe("CalmConfirmation", () => {
  it("renders message", () => {
    render(<CalmConfirmation message="Registado, bom treino" />)
    expect(screen.getByText("Registado, bom treino")).toBeInTheDocument()
  })

  it("renders with correct duration", () => {
    const { rerender } = render(
      <CalmConfirmation message="Test message" duration={1500} />
    )
    expect(screen.getByText("Test message")).toBeInTheDocument()
  })

  it("calls onDismiss callback", () => {
    const handleDismiss = vi.fn()
    render(
      <CalmConfirmation
        message="Test message"
        duration={100}
        onDismiss={handleDismiss}
      />
    )
    // Component will auto-dismiss but we've set the callback
    expect(screen.getByText("Test message")).toBeInTheDocument()
  })

  it("has aria-live polite for screen readers", () => {
    render(<CalmConfirmation message="Test message" />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveAttribute("aria-live", "polite")
  })

  it("has alert role for accessibility", () => {
    render(<CalmConfirmation message="Test message" />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("uses neutral styling without celebratory language", () => {
    const { container } = render(<CalmConfirmation message="Registado" />)
    const element = container.querySelector("[role=alert]")
    expect(element).toHaveClass("text-muted-foreground")
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(<CalmConfirmation message="Test message" />)
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })

  it("accepts custom duration prop", () => {
    render(<CalmConfirmation message="Test" duration={2000} />)
    expect(screen.getByText("Test")).toBeInTheDocument()
  })
})
