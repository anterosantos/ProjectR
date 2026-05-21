import { render } from "@testing-library/react"
import { axe } from "vitest-axe"
import { PendingBadge } from "@/components/ui/pending-badge"

describe("PendingBadge", () => {
  it("renders with correct count", () => {
    const { getByText } = render(<PendingBadge count={3} />)
    expect(getByText("3 pendentes")).toBeInTheDocument()
  })

  it("does not render when count is 0", () => {
    const { container } = render(<PendingBadge count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it("has aria-live attribute for screen reader updates", () => {
    const { getByRole } = render(<PendingBadge count={5} />)
    const badge = getByRole("status")
    expect(badge).toHaveAttribute("aria-live", "polite")
  })

  it("displays info color styling", () => {
    const { container } = render(<PendingBadge count={2} />)
    expect(container.firstChild).toHaveClass("text-signal-info")
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(<PendingBadge count={3} />)
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })
})
