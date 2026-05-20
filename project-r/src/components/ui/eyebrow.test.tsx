import { render, screen } from "@testing-library/react"
import { Eyebrow } from "./eyebrow"

describe("Eyebrow", () => {
  it("renders children", () => {
    render(<Eyebrow>Secção</Eyebrow>)
    expect(screen.getByText("Secção")).toBeInTheDocument()
  })

  it("applies extra className", () => {
    const { container } = render(<Eyebrow className="mt-4">Texto</Eyebrow>)
    expect(container.firstChild).toHaveClass("mt-4")
  })
})
