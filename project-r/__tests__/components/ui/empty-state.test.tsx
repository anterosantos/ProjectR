import { render, screen, fireEvent } from "@testing-library/react"
import { axe } from "vitest-axe"
import { EmptyState } from "@/components/ui/empty-state"
import { Package } from "lucide-react"

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={<Package />}
        title="Nenhum item"
        description="Adicione um novo item para começar"
      />
    )
    expect(screen.getByText("Nenhum item")).toBeInTheDocument()
    expect(screen.getByText("Adicione um novo item para começar")).toBeInTheDocument()
  })

  it("renders icon element", () => {
    const { container } = render(
      <EmptyState icon={<Package />} title="Test" description="Test description" />
    )
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders CTA button when provided", () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        icon={<Package />}
        title="Test"
        description="Test description"
        cta={{ label: "Adicionar", onClick: handleClick }}
      />
    )
    const button = screen.getByRole("button", { name: /adicionar/i })
    expect(button).toBeInTheDocument()
  })

  it("does not render CTA button when not provided", () => {
    const { container } = render(
      <EmptyState icon={<Package />} title="Test" description="Test description" />
    )
    expect(container.querySelectorAll("button").length).toBe(0)
  })

  it("calls CTA handler when clicked", () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        icon={<Package />}
        title="Test"
        description="Test description"
        cta={{ label: "Adicionar", onClick: handleClick }}
      />
    )
    const button = screen.getByRole("button", { name: /adicionar/i })
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalled()
  })

  it("has zero accessibility violations", async () => {
    const { container } = render(
      <EmptyState icon={<Package />} title="Test" description="Test description" />
    )
    const results = await axe(container)
    expect(results.violations.length).toBe(0)
  })

  it("uses semantic heading and text elements", () => {
    render(
      <EmptyState icon={<Package />} title="Test Title" description="Test description" />
    )
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading).toHaveTextContent("Test Title")
  })
})
