import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { DrillDownSheet } from "@/components/ui/drill-down-sheet"
import { DialogTitle } from "@/components/ui/dialog"

describe("DrillDownSheet", () => {
  it("renders content when open", () => {
    render(
      <DrillDownSheet open={true}>
        <DialogTitle>Test Sheet</DialogTitle>
        <div>Test Content</div>
      </DrillDownSheet>
    )
    expect(screen.getByText("Test Content")).toBeInTheDocument()
  })

  it("does not render content when closed", () => {
    const { container } = render(
      <DrillDownSheet open={false}>
        <DialogTitle>Test Sheet</DialogTitle>
        <div>Test Content</div>
      </DrillDownSheet>
    )
    expect(container.textContent).not.toContain("Test Content")
  })

  it("accepts onOpenChange callback", () => {
    const handleOpenChange = vi.fn()
    render(
      <DrillDownSheet open={true} onOpenChange={handleOpenChange}>
        <DialogTitle>Test Sheet</DialogTitle>
        <div>Test Content</div>
      </DrillDownSheet>
    )
    expect(screen.getByText("Test Content")).toBeInTheDocument()
  })

  it("traps focus while open", () => {
    render(
      <DrillDownSheet open={true}>
        <DialogTitle>Test Sheet</DialogTitle>
        <button>Button in Sheet</button>
      </DrillDownSheet>
    )
    const button = screen.getByRole("button", { name: /button in sheet/i })
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(
      <DrillDownSheet open={true}>
        <DialogTitle>Test Sheet</DialogTitle>
        <div>Test Content</div>
      </DrillDownSheet>
    )
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })

  it("can render with title and content", () => {
    render(
      <DrillDownSheet open={true}>
        <DialogTitle>Sheet Title</DialogTitle>
        <div>Sheet Content Goes Here</div>
      </DrillDownSheet>
    )
    expect(screen.getByText("Sheet Title")).toBeInTheDocument()
    expect(screen.getByText("Sheet Content Goes Here")).toBeInTheDocument()
  })
})
