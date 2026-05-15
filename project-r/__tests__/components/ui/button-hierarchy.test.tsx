import { render, screen } from "@testing-library/react"
import { axe } from "vitest-axe"
import { Button } from "@/components/ui/button"

describe("Button Hierarchy (AC #9)", () => {
  describe("Variant system - exactly 3 variants", () => {
    it("renders primary variant for main actions", () => {
      render(<Button variant="primary">Guardar</Button>)
      const button = screen.getByRole("button", { name: /guardar/i })
      expect(button).toHaveClass("bg-primary")
      expect(button).toHaveClass("text-primary-foreground")
    })

    it("renders ghost variant for secondary actions", () => {
      render(<Button variant="ghost">Cancelar</Button>)
      const button = screen.getByRole("button", { name: /cancelar/i })
      expect(button).toHaveClass("border")
      expect(button).toHaveClass("border-border")
    })

    it("renders destructive variant for irreversible actions", () => {
      render(<Button variant="destructive">Apagar</Button>)
      const button = screen.getByRole("button", { name: /apagar/i })
      expect(button).toHaveClass("bg-signal-alert")
      expect(button).toHaveClass("text-white")
    })
  })

  describe("Size variants", () => {
    it("renders sm size", () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-9")
    })

    it("renders default size", () => {
      render(<Button size="default">Default</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-11")
    })

    it("renders lg size", () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-12")
    })
  })

  describe("Touch target size (NFR40: ≥44×44px)", () => {
    it("has minimum touch target for default size", () => {
      const { container } = render(<Button>Touch Target</Button>)
      const button = container.querySelector("button")
      expect(button).toHaveClass("min-h-11")
      expect(button).toHaveClass("min-w-11")
    })
  })

  describe("Accessibility", () => {
    it("has proper button semantics", () => {
      render(<Button>Test</Button>)
      expect(screen.getByRole("button")).toBeInTheDocument()
    })

    it("supports disabled state", () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })

    it("has zero accessibility violations", async () => {
      const { container } = render(
        <Button variant="primary">Click me</Button>
      )
      const results = await axe(container)
      expect(results.violations.length).toBe(0)
    })
  })

  describe("Hover and focus states", () => {
    it("applies hover state to primary variant", () => {
      const { container } = render(<Button variant="primary">Primary</Button>)
      const button = container.querySelector("button")
      expect(button).toHaveClass("hover:bg-primary/90")
    })

    it("applies focus visible ring", () => {
      const { container } = render(<Button>Focus</Button>)
      const button = container.querySelector("button")
      expect(button).toHaveClass("focus-visible:ring-3")
    })
  })

  describe("Content and text rendering", () => {
    it("preserves text in loading state context", () => {
      render(<Button>Processando...</Button>)
      expect(screen.getByText("Processando...")).toBeInTheDocument()
    })

    it("supports icon and text together", () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Label</span>
        </Button>
      )
      expect(screen.getByText("Label")).toBeInTheDocument()
    })
  })

  describe("No unsupported variants", () => {
    it("does not accept warning variant", () => {
      const { container } = render(
        <Button variant="warning" as any>
          Warning
        </Button>
      )
      const button = container.querySelector("button")
      expect(button).not.toHaveClass("bg-warning")
    })

    it("does not accept info variant", () => {
      const { container } = render(
        <Button variant="info" as any>
          Info
        </Button>
      )
      const button = container.querySelector("button")
      expect(button).not.toHaveClass("bg-info")
    })
  })
})
