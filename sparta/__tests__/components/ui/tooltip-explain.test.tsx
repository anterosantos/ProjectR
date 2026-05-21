import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "vitest-axe"
import { TooltipExplain } from "@/components/ui/tooltip-explain"

describe("TooltipExplain", () => {
  it("renders term with icon", () => {
    render(
      <TooltipExplain term="ACWR" definition="Definição de teste" />
    )
    expect(screen.getByText("ACWR")).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("shows definition on click", () => {
    render(
      <TooltipExplain term="ACWR" definition="Acute Chronic Workload Ratio" />
    )
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(screen.getByText("Acute Chronic Workload Ratio")).toBeInTheDocument()
  })

  it("shows definition on hover", () => {
    render(
      <TooltipExplain term="ACWR" definition="Test definition" />
    )
    const button = screen.getByRole("button")
    fireEvent.mouseEnter(button)
    expect(screen.getByText("Test definition")).toBeInTheDocument()
  })

  it("displays formula when provided", () => {
    render(
      <TooltipExplain
        term="ACWR"
        definition="Definition"
        formula="sRPE × dias / 28"
      />
    )
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(screen.getByText("sRPE × dias / 28")).toBeInTheDocument()
  })

  it("toggles visibility on click", () => {
    render(
      <TooltipExplain term="ACWR" definition="Test definition" />
    )
    const button = screen.getByRole("button")
    expect(screen.queryByText("Test definition")).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(screen.getByText("Test definition")).toBeInTheDocument()
    fireEvent.click(button)
    expect(screen.queryByText("Test definition")).not.toBeInTheDocument()
  })

  it("closes on unhover", () => {
    render(
      <TooltipExplain term="ACWR" definition="Test definition" />
    )
    const button = screen.getByRole("button")
    fireEvent.mouseEnter(button)
    expect(screen.getByText("Test definition")).toBeInTheDocument()
    fireEvent.mouseLeave(button)
    expect(screen.queryByText("Test definition")).not.toBeInTheDocument()
  })

  it("has aria-expanded attribute", () => {
    render(
      <TooltipExplain term="ACWR" definition="Test definition" />
    )
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(button)
    expect(button).toHaveAttribute("aria-expanded", "true")
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(
      <TooltipExplain term="ACWR" definition="Test definition" />
    )
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })
})
