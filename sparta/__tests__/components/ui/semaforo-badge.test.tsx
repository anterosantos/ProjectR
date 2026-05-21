import { render } from "@testing-library/react"
import { axe } from "vitest-axe"
import { SemaforoBadge } from "@/components/ui/semaforo-badge"

describe("SemaforoBadge", () => {
  it("renders with correct state and aria-label", () => {
    const { getByRole } = render(<SemaforoBadge state="ready" />)
    const badge = getByRole("img")
    expect(badge).toHaveAttribute("aria-label", "Estado: pronto")
  })

  it("sets aria-label for caution state", () => {
    const { getByRole } = render(<SemaforoBadge state="caution" />)
    const badge = getByRole("img")
    expect(badge).toHaveAttribute("aria-label", "Estado: atenção")
  })

  it("sets aria-label for alert state", () => {
    const { getByRole } = render(<SemaforoBadge state="alert" />)
    const badge = getByRole("img")
    expect(badge).toHaveAttribute("aria-label", "Estado: não recomendado")
  })

  it("sets aria-label for neutral state", () => {
    const { getByRole } = render(<SemaforoBadge state="neutral" />)
    const badge = getByRole("img")
    expect(badge).toHaveAttribute("aria-label", "Estado: sem dados")
  })

  it("applies correct color classes for each state", () => {
    const { container: readyContainer } = render(<SemaforoBadge state="ready" />)
    expect(readyContainer.firstChild).toHaveClass("text-signal-ready")

    const { container: cautionContainer } = render(<SemaforoBadge state="caution" />)
    expect(cautionContainer.firstChild).toHaveClass("text-signal-caution")

    const { container: alertContainer } = render(<SemaforoBadge state="alert" />)
    expect(alertContainer.firstChild).toHaveClass("text-signal-alert")
  })

  it("renders with size variants", () => {
    const { container: smContainer } = render(<SemaforoBadge state="ready" size="sm" />)
    expect(smContainer.firstChild).toHaveClass("text-xs")

    const { container: mdContainer } = render(<SemaforoBadge state="ready" size="md" />)
    expect(mdContainer.firstChild).toHaveClass("text-sm")

    const { container: lgContainer } = render(<SemaforoBadge state="ready" size="lg" />)
    expect(lgContainer.firstChild).toHaveClass("text-base")
  })

  it("includes icon element for visual redundancy", () => {
    const { container } = render(<SemaforoBadge state="ready" />)
    const icon = container.querySelector("svg")
    expect(icon).toBeInTheDocument()
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(<SemaforoBadge state="caution" size="lg" />)
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })

  it("renders sr-only label for screen readers", () => {
    const { container } = render(<SemaforoBadge state="ready" />)
    const srOnly = container.querySelector(".sr-only")
    expect(srOnly).toBeInTheDocument()
    expect(srOnly).toHaveTextContent("Estado: pronto")
  })

  it("has proper semantic role", () => {
    const { getByRole } = render(<SemaforoBadge state="ready" />)
    const badge = getByRole("img")
    expect(badge).toBeInTheDocument()
  })
})
